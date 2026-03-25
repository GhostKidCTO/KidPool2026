'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import type { VaultNFT } from './VaultNFTs';

interface UserNFT {
  mint: string;
  name: string;
  image: string;
  rarity: 'common' | 'rare' | 'legendary';
}

const GHOST_KID_COLLECTION = 'FSw4cZhK5pMmhEDenDpa3CauJ9kLt5agr2U1oQxaH2cv';

export function SwapSection({
  connection,
  selectedVaultNFT,
  onSuccess,
}: {
  connection: Connection;
  selectedVaultNFT: VaultNFT | null;
  onSuccess?: () => void;
}) {
  const { publicKey, signTransaction } = useWallet();
  const [userNFTs, setUserNFTs] = useState<UserNFT[]>([]);
  const [selectedUserNFT, setSelectedUserNFT] = useState<UserNFT | null>(null);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (publicKey) {
      fetchUserNFTs();
    } else {
      setUserNFTs([]);
      setSelectedUserNFT(null);
    }
  }, [publicKey]);

  // Clear status when vault selection changes
  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [selectedVaultNFT]);

  async function fetchUserNFTs() {
    if (!publicKey) return;
    try {
      setLoading(true);
      setError(null);

      const rpcEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
      const response = await fetch(rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'gk-swap-user',
          method: 'getAssetsByOwner',
          params: {
            ownerAddress: publicKey.toBase58(),
            page: 1,
            limit: 1000,
            displayOptions: { showFungible: false, showNativeBalance: false },
          },
        }),
      });

      const data = await response.json();
      const assets: any[] = data.result?.items || [];

      const ghostKidAssets = assets.filter((asset: any) =>
        asset.grouping?.some(
          (g: any) => g.group_key === 'collection' && g.group_value === GHOST_KID_COLLECTION
        )
      );

      const nfts: UserNFT[] = ghostKidAssets.map((asset: any) => {
        const attributes: any[] = asset.content?.metadata?.attributes || [];
        const rarityAttr = attributes.find((attr: any) =>
          attr.trait_type?.toLowerCase() === 'rarity' ||
          attr.trait_type?.toLowerCase() === 'tier'
        );
        let rarity: 'common' | 'rare' | 'legendary' = 'common';
        if (rarityAttr) {
          const v = rarityAttr.value?.toLowerCase();
          if (v === 'legendary' || v === 'mythic') rarity = 'legendary';
          else if (v === 'rare' || v === 'epic') rarity = 'rare';
        }
        const image = asset.content?.links?.image || asset.content?.files?.[0]?.uri || '';
        const name = asset.content?.metadata?.name || `GhostKid #${asset.id?.slice(0, 4)}`;
        return { mint: asset.id, name, image, rarity };
      });

      setUserNFTs(nfts);
    } catch (err: any) {
      setError(err?.message || 'Failed to load NFTs');
    } finally {
      setLoading(false);
    }
  }

  async function handleSwap() {
    if (!publicKey || !selectedUserNFT || !selectedVaultNFT || !signTransaction) return;

    if (selectedUserNFT.rarity !== selectedVaultNFT.rarity) {
      setError('Rarity mismatch — you can only swap for a vault NFT of the same rarity tier.');
      return;
    }

    try {
      setSwapping(true);
      setError(null);
      setSuccess(null);

      const resp = await fetch('/api/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMintAddress: selectedUserNFT.mint,
          vaultMintAddress: selectedVaultNFT.mint,
          userAddress: publicKey.toBase58(),
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Server error' }));
        throw new Error(err.error || `Server error ${resp.status}`);
      }

      const { transaction: txBase64 } = await resp.json();
      const transaction = Transaction.from(Buffer.from(txBase64, 'base64'));

      const signed = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: true,
        preflightCommitment: 'confirmed',
      });

      await connection.confirmTransaction(signature, 'confirmed');

      setSuccess(signature);
      setSelectedUserNFT(null);
      if (onSuccess) onSuccess();
      fetchUserNFTs();
    } catch (err: any) {
      if (err?.message?.includes('User rejected') || err?.message?.includes('rejected')) {
        setError('Transaction rejected by user');
      } else {
        setError(err?.message || err?.toString() || 'Unknown error');
      }
    } finally {
      setSwapping(false);
    }
  }

  const rarityIcon = (r: string) =>
    r === 'legendary' ? '💎' : r === 'rare' ? '⭐' : '🔵';

  const rarityBadgeClass = (r: string) =>
    r === 'legendary' ? 'bg-yellow-500/90 text-black' :
    r === 'rare' ? 'bg-purple-500/90 text-white' :
    'bg-blue-500/90 text-white';

  const rarityMismatch =
    selectedUserNFT && selectedVaultNFT &&
    selectedUserNFT.rarity !== selectedVaultNFT.rarity;

  const canSwap =
    !!selectedUserNFT && !!selectedVaultNFT && !rarityMismatch && !swapping && !!publicKey;

  return (
    <div className="bg-gradient-to-br from-green-900/20 to-teal-900/20 rounded-lg p-8 border border-green-500/30">
      <h2 className="text-2xl font-bold mb-2">Swap GhostKid ↔ GhostKid</h2>
      <p className="text-gray-400 text-sm mb-6">
        Exchange your GhostKid for one from the vault of the same rarity tier. No $KID tokens required.
      </p>

      {!publicKey ? (
        <div className="bg-gray-800/50 rounded-lg p-8 text-center">
          <p className="text-gray-400">Connect your wallet to swap NFTs</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left column: user's NFT to give up */}
          <div>
            <p className="text-sm font-medium text-gray-300 mb-3">Your NFT to swap away</p>

            {loading ? (
              <div className="bg-gray-800/50 rounded-lg p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto mb-2"></div>
                <p className="text-sm text-gray-400">Loading your NFTs...</p>
              </div>
            ) : userNFTs.length === 0 ? (
              <div className="bg-gray-800/50 rounded-lg p-6 text-center">
                <p className="text-gray-400 text-sm">No GhostKid NFTs in your wallet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto bg-gray-800/30 rounded-lg p-2">
                {userNFTs.map((nft) => (
                  <button
                    key={nft.mint}
                    onClick={() => {
                      setSelectedUserNFT(nft.mint === selectedUserNFT?.mint ? null : nft);
                      setError(null);
                      setSuccess(null);
                    }}
                    className={`relative aspect-square rounded-lg border-2 transition-all overflow-hidden ${
                      selectedUserNFT?.mint === nft.mint
                        ? 'border-green-500 ring-2 ring-green-500 scale-105'
                        : 'border-gray-600 hover:border-green-400'
                    } bg-gray-900`}
                  >
                    {nft.image ? (
                      <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">👻</div>
                    )}
                    <div className="absolute top-1 right-1 text-sm">{rarityIcon(nft.rarity)}</div>
                  </button>
                ))}
              </div>
            )}

            {selectedUserNFT && (
              <div className="mt-3 bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">Giving:</p>
                <p className="font-bold text-green-400 text-sm truncate">{selectedUserNFT.name}</p>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold mt-1 ${rarityBadgeClass(selectedUserNFT.rarity)}`}>
                  {rarityIcon(selectedUserNFT.rarity)} {selectedUserNFT.rarity.toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Right column: selected vault NFT to receive */}
          <div>
            <p className="text-sm font-medium text-gray-300 mb-3">Vault NFT to receive</p>

            {!selectedVaultNFT ? (
              <div className="bg-gray-800/50 rounded-lg p-6 text-center border-2 border-dashed border-gray-700 h-full flex flex-col items-center justify-center min-h-[120px]">
                <p className="text-gray-500 text-sm">Select a vault NFT from the display above</p>
              </div>
            ) : (
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="aspect-square max-w-[100px] mx-auto rounded-lg overflow-hidden bg-gray-900 mb-3">
                  {selectedVaultNFT.image ? (
                    <img src={selectedVaultNFT.image} alt={selectedVaultNFT.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">👻</div>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-1 text-center">Receiving:</p>
                <p className="font-bold text-green-400 text-sm text-center truncate">{selectedVaultNFT.name}</p>
                <div className="flex justify-center mt-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${rarityBadgeClass(selectedVaultNFT.rarity)}`}>
                    {rarityIcon(selectedVaultNFT.rarity)} {selectedVaultNFT.rarity.toUpperCase()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rarity mismatch warning */}
      {rarityMismatch && (
        <div className="mt-4 bg-orange-900/30 border border-orange-500/50 rounded-lg p-3">
          <p className="text-orange-400 text-sm font-bold">Rarity mismatch</p>
          <p className="text-xs text-gray-400 mt-1">
            Your selected NFT is <strong>{selectedUserNFT!.rarity}</strong> but the vault NFT is{' '}
            <strong>{selectedVaultNFT!.rarity}</strong>. Select a vault NFT of the same rarity tier.
          </p>
        </div>
      )}

      {publicKey && (
        <button
          onClick={handleSwap}
          disabled={!canSwap}
          className={`w-full py-4 rounded-lg font-bold text-lg transition-all mt-6 ${
            !canSwap
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-green-500 to-teal-500 hover:opacity-90 text-white shadow-lg'
          }`}
        >
          {swapping ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Swapping...
            </span>
          ) : !selectedUserNFT || !selectedVaultNFT ? (
            'Select both NFTs to swap'
          ) : rarityMismatch ? (
            'Rarity mismatch — select matching tier'
          ) : (
            `↔ Swap ${selectedUserNFT.name} for ${selectedVaultNFT.name}`
          )}
        </button>
      )}

      {error && (
        <div className="mt-4 bg-red-900/30 border border-red-500/50 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mt-4 bg-green-900/30 border border-green-500/50 rounded-lg p-4">
          <p className="text-green-400 text-sm mb-2">NFT Swap Successful!</p>
          <a
            href={`https://solscan.io/tx/${success}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:underline"
          >
            View transaction on Solscan →
          </a>
        </div>
      )}

      <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 text-sm mt-6">
        <p className="text-green-400 font-bold mb-2">ℹ️ How it works</p>
        <p className="text-gray-400 text-xs">
          Your NFT is deposited into the vault and the selected vault NFT is transferred to you — in
          a single atomic transaction. Both NFTs must share the same rarity tier. The $KID credited
          by your deposit cancels out the $KID debited by the withdrawal, so your token balance is
          unaffected.
        </p>
      </div>
    </div>
  );
}
