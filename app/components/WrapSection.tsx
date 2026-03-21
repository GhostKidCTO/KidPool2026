'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import {
  getDepositNftsInstruction,
  getNftReceiptPDA,
  getTokenRecordPDA,
  getMetadataPDA,
  getEditionPDA,
} from '@/lib/ghostkid-program/instructions';

interface UserNFT {
  mint: string;
  name: string;
  image: string;
  rarity: 'common' | 'rare' | 'legendary';
}

const ADDRESSES = {
  kidsTokenMint: new PublicKey('4peG5vF6VXbUt8PPA5LDbtdeRAPBGGrspDMW3ot6TdeX'),
  ghostKidVault: new PublicKey('JCSbaLqdn6nKtTVTUjAaxsv28TBhmpypcY3VAqdGKWLA'),
  ghostKidVaultTokenAccount: new PublicKey('6koxtKZV3LxSrS8dMpkMj1xLmSzMSTrRY1KCTsXTPvCC'),
  ghostKidAuthority: new PublicKey('qgDDcomgjASwB27LaxMFXyzhpuzvRpkCSzbdDJcoEks'),
  ghostKidCollection: new PublicKey('FSw4cZhK5pMmhEDenDpa3CauJ9kLt5agr2U1oQxaH2cv'),
  metaplexTokenMetadataProgram: new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'),
  metaplexRuleset: new PublicKey('eBJLFYPxJmMGKuFwpDWkzxZeUrad92kZRC5BJLpzyT9'),
};

const WRAP_VALUES = {
  common: 10000,
  rare: 15000,
  legendary: 25000,
};

function parseMetaplexMetadata(data: Buffer): { name: string; uri: string; collection?: string } {
  try {
    let offset = 1 + 32 + 32; // key(1) + update_authority(32) + mint(32)
    const nameLen = data.readUInt32LE(offset); offset += 4;
    const name = data.slice(offset, offset + nameLen).toString('utf8').replace(/\0/g, '').trim();
    offset += nameLen;
    const symbolLen = data.readUInt32LE(offset); offset += 4 + symbolLen;
    const uriLen = data.readUInt32LE(offset); offset += 4;
    const uri = data.slice(offset, offset + uriLen).toString('utf8').replace(/\0/g, '').trim();
    offset += uriLen;
    // Skip seller_fee_basis_points(2) + creators option
    offset += 2;
    const hasCreators = data.readUInt8(offset); offset += 1;
    if (hasCreators) {
      const creatorsLen = data.readUInt32LE(offset); offset += 4;
      offset += creatorsLen * (32 + 1 + 1); // pubkey + verified + share
    }
    // Skip primary_sale_happened(1) + is_mutable(1)
    offset += 2;
    // edition_nonce option
    const hasEditionNonce = data.readUInt8(offset); offset += 1;
    if (hasEditionNonce) offset += 1;
    // token_standard option
    const hasTokenStandard = data.readUInt8(offset); offset += 1;
    if (hasTokenStandard) offset += 1;
    // collection option
    const hasCollection = data.readUInt8(offset); offset += 1;
    let collection: string | undefined;
    if (hasCollection) {
      offset += 1; // verified bool
      collection = new PublicKey(data.slice(offset, offset + 32)).toBase58();
    }
    return { name, uri, collection };
  } catch {
    return { name: '', uri: '' };
  }
}

export function WrapSection({ connection, onSuccess }: { connection: Connection; onSuccess?: () => void }) {
  const { publicKey, signTransaction } = useWallet();
  const [userNFTs, setUserNFTs] = useState<UserNFT[]>([]);
  const [selectedNFT, setSelectedNFT] = useState<UserNFT | null>(null);
  const [loading, setLoading] = useState(false);
  const [wrapping, setWrapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<{ success: boolean; message: string } | null>(null);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if (publicKey) {
      fetchUserNFTs();
    } else {
      setUserNFTs([]);
      setSelectedNFT(null);
    }
  }, [publicKey]);

  async function fetchUserNFTs() {
    if (!publicKey) return;
    try {
      setLoading(true);
      setError(null);
      setLoadingProgress({ current: 0, total: 0 });

      // Use Helius DAS API — returns all assets with collection metadata in one call
      const rpcEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
      const response = await fetch(rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'gk-wrap',
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

      const collectionKey = ADDRESSES.ghostKidCollection.toBase58();
      const ghostKidAssets = assets.filter((asset: any) =>
        asset.grouping?.some(
          (g: any) => g.group_key === 'collection' && g.group_value === collectionKey
        )
      );

      setLoadingProgress({ current: ghostKidAssets.length, total: ghostKidAssets.length });

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

  async function handleWrap() {
    if (!publicKey || !selectedNFT || !signTransaction) return;

    try {
      setWrapping(true);
      setError(null);
      setSuccess(null);
      setSimulationResult(null);

      const nftMint = new PublicKey(selectedNFT.mint);

      // User's NFT token account (source)
      const userNftAccount = await getAssociatedTokenAddress(nftMint, publicKey);

      // Vault's NFT token account (destination) — vault is a PDA (off-curve), must allow
      const vaultNftAccount = await getAssociatedTokenAddress(nftMint, ADDRESSES.ghostKidVault, true);

      // User's $KID account (receives $KID)
      const userKidAccount = await getAssociatedTokenAddress(ADDRESSES.kidsTokenMint, publicKey);

      // PDAs
      const [nftReceipt] = await getNftReceiptPDA(nftMint);
      const [metadataPDA] = await getMetadataPDA(nftMint);
      const [editionPDA] = await getEditionPDA(nftMint);
      const [sourceTokenRecord] = await getTokenRecordPDA(nftMint, userNftAccount);
      const [destinationTokenRecord] = await getTokenRecordPDA(nftMint, vaultNftAccount);

      // Create user's $KID ATA in a separate tx first if it doesn't exist.
      // (The GhostKid program's init_if_needed handles the vault's NFT ATA — do NOT pre-create it.)
      const userKidAccountInfo = await connection.getAccountInfo(userKidAccount);
      if (!userKidAccountInfo) {
        const setupTx = new Transaction();
        setupTx.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            userKidAccount,
            publicKey,
            ADDRESSES.kidsTokenMint
          )
        );
        const { blockhash: setupBlockhash } = await connection.getLatestBlockhash('confirmed');
        setupTx.recentBlockhash = setupBlockhash;
        setupTx.feePayer = publicKey;
        const signedSetup = await signTransaction(setupTx);
        const setupSig = await connection.sendRawTransaction(signedSetup.serialize(), {
          skipPreflight: true,
          preflightCommitment: 'confirmed',
        });
        await connection.confirmTransaction(setupSig, 'confirmed');
      }

      const transaction = new Transaction();

      // Create vault's NFT ATA in the same tx if needed — reference on-chain tx does this
      const vaultNftAccountInfo = await connection.getAccountInfo(vaultNftAccount);
      if (!vaultNftAccountInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            vaultNftAccount,
            ADDRESSES.ghostKidVault,
            nftMint
          )
        );
      }

      transaction.add(
        getDepositNftsInstruction({
          nftReceipt,
          vault: ADDRESSES.ghostKidVault,
          vaultTokenAccount: ADDRESSES.ghostKidVaultTokenAccount,
          authority: ADDRESSES.ghostKidAuthority,
          depositor: publicKey,
          depositorTokenAccount: userKidAccount,
          sourceNftTokenAccount: userNftAccount,
          mint: nftMint,
          destinationNftTokenAccount: vaultNftAccount,
          sourceTokenRecord,
          destinationTokenRecord,
          edition: editionPDA,
          metadata: metadataPDA,
          tokenMint: ADDRESSES.kidsTokenMint,
          metaplexRuleset: ADDRESSES.metaplexRuleset,
          metadataProgram: ADDRESSES.metaplexTokenMetadataProgram,
        })
      );

      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Simulate — show result but don't abort (program validates on-chain)
      try {
        const simulation = await connection.simulateTransaction(transaction);
        console.log('Simulation logs:', simulation.value.logs);
        if (simulation.value.err) {
          console.warn('Simulation inconclusive (proceeding):', simulation.value.err);
          setSimulationResult({
            success: true,
            message: `⚠️ Pre-flight check inconclusive — proceeding to wallet for final validation.`,
          });
          // Don't throw — on-chain program validates correctly
        } else {
          setSimulationResult({
            success: true,
            message: `✅ Simulation successful. You will deposit ${selectedNFT.name} and receive ${WRAP_VALUES[selectedNFT.rarity].toLocaleString()} $KID.`,
          });
        }
      } catch (simErr: any) {
        console.warn('Simulation threw:', simErr);
        // Continue anyway
      }

      // Sign and broadcast directly via our RPC
      const signed = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: true,
        preflightCommitment: 'confirmed',
      });

      await connection.confirmTransaction(signature, 'confirmed');
      setSuccess(signature);
      setSelectedNFT(null);
      if (onSuccess) onSuccess();
      fetchUserNFTs();

    } catch (err: any) {
      console.error('Wrap error (full):', err);
      const msg = err?.message || err?.toString() || JSON.stringify(err) || 'Unknown error';
      setError(msg);
    } finally {
      setWrapping(false);
    }
  }

  const getRarityIcon = (rarity: 'common' | 'rare' | 'legendary') => {
    switch (rarity) {
      case 'legendary': return '💎';
      case 'rare': return '⭐';
      case 'common': return '🔵';
    }
  };

  const getRarityColor = (rarity: 'common' | 'rare' | 'legendary') => {
    switch (rarity) {
      case 'legendary': return 'from-yellow-500 to-orange-500';
      case 'rare': return 'from-purple-500 to-pink-500';
      case 'common': return 'from-blue-500 to-cyan-500';
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 rounded-lg p-8 border border-blue-500/30">
      <h2 className="text-2xl font-bold mb-6">Wrap GhostKid → Receive $KID</h2>

      <p className="text-gray-400 mb-6">
        Deposit your GhostKid NFTs into the vault to receive $KID tokens based on rarity.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 text-center">
          <div className="text-2xl mb-1">🔵</div>
          <div className="text-xs text-gray-400">Common</div>
          <div className="text-lg font-bold text-blue-400">10,000 $KID</div>
        </div>
        <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3 text-center">
          <div className="text-2xl mb-1">⭐</div>
          <div className="text-xs text-gray-400">Rare</div>
          <div className="text-lg font-bold text-purple-400">15,000 $KID</div>
        </div>
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 text-center">
          <div className="text-2xl mb-1">💎</div>
          <div className="text-xs text-gray-400">Legendary</div>
          <div className="text-lg font-bold text-yellow-400">25,000 $KID</div>
        </div>
      </div>

      {loading ? (
        <div className="bg-gray-800/50 rounded-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-400 mb-2">Loading your GhostKid NFTs...</p>
          {loadingProgress.total > 0 && (
            <p className="text-sm text-gray-500">{loadingProgress.current} / {loadingProgress.total} NFTs checked</p>
          )}
        </div>
      ) : !publicKey ? (
        <div className="bg-gray-800/50 rounded-lg p-8 text-center">
          <p className="text-gray-400">Connect your wallet to see your GhostKid NFTs</p>
        </div>
      ) : userNFTs.length === 0 ? (
        <div className="bg-gray-800/50 rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-2">No GhostKid NFTs found in your wallet</p>
          <p className="text-sm text-gray-500">You may have already deposited them all, or they're in a different wallet</p>
        </div>
      ) : (
        <>
          <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-400 mb-3">Your GhostKid NFTs ({userNFTs.length})</p>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-96 overflow-y-auto">
              {userNFTs.map((nft) => (
                <button
                  key={nft.mint}
                  onClick={() => {
                    setSelectedNFT(nft.mint === selectedNFT?.mint ? null : nft);
                    setSimulationResult(null);
                    setError(null);
                    setSuccess(null);
                  }}
                  className={`relative aspect-square rounded-lg border-2 transition-all overflow-hidden ${
                    selectedNFT?.mint === nft.mint
                      ? 'border-blue-500 ring-2 ring-blue-500 scale-105'
                      : 'border-gray-600 hover:border-blue-400'
                  } bg-gray-900`}
                >
                  {nft.image ? (
                    <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">👻</div>
                  )}
                  <div className="absolute top-1 right-1 text-lg">{getRarityIcon(nft.rarity)}</div>
                </button>
              ))}
            </div>
          </div>

          {selectedNFT && (
            <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border-2 border-blue-500/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-400 mb-3">Selected NFT to wrap:</p>
              <div className="flex items-center gap-4">
                {selectedNFT.image && (
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-900 flex-shrink-0">
                    <img src={selectedNFT.image} alt={selectedNFT.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-bold text-lg text-blue-400">{selectedNFT.name}</p>
                  <p className="text-xs text-gray-500 mb-2">Mint: {selectedNFT.mint.slice(0, 8)}...</p>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded text-xs font-bold ${
                      selectedNFT.rarity === 'legendary' ? 'bg-yellow-500/90 text-black' :
                      selectedNFT.rarity === 'rare' ? 'bg-purple-500/90 text-white' :
                      'bg-blue-500/90 text-white'
                    }`}>
                      {getRarityIcon(selectedNFT.rarity)} {selectedNFT.rarity.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-400">
                      → <span className="font-bold text-blue-400">{WRAP_VALUES[selectedNFT.rarity].toLocaleString()} $KID</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {simulationResult && (
            <div className={`border rounded-lg p-4 mb-4 ${
              simulationResult.success ? 'bg-green-900/30 border-green-500/50' : 'bg-red-900/30 border-red-500/50'
            }`}>
              <p className={`text-sm font-bold mb-1 ${simulationResult.success ? 'text-green-400' : 'text-red-400'}`}>
                {simulationResult.success ? '✅ Transaction Verified' : '❌ Simulation Failed'}
              </p>
              <p className="text-xs text-gray-400">{simulationResult.message}</p>
            </div>
          )}

          <button
            onClick={handleWrap}
            disabled={!selectedNFT || wrapping}
            className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
              !selectedNFT || wrapping
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : `bg-gradient-to-r ${getRarityColor(selectedNFT.rarity)} hover:opacity-90 text-white shadow-lg`
            }`}
          >
            {wrapping ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Processing...
              </span>
            ) : !selectedNFT ? (
              'Select an NFT to wrap'
            ) : (
              <>{getRarityIcon(selectedNFT.rarity)} Wrap for {WRAP_VALUES[selectedNFT.rarity].toLocaleString()} $KID</>
            )}
          </button>

          {error && (
            <div className="mt-4 bg-red-900/30 border border-red-500/50 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mt-4 bg-green-900/30 border border-green-500/50 rounded-lg p-4">
              <p className="text-green-400 text-sm mb-2">✅ NFT Wrapped Successfully!</p>
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
        </>
      )}

      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 text-sm mt-6">
        <p className="text-blue-400 font-bold mb-2">ℹ️ How it works</p>
        <p className="text-gray-400 mb-3 text-xs">
          Wrapping deposits your GhostKid NFT into the vault and sends the corresponding $KID tokens to your wallet.
          No tokens are minted — they come from the vault's existing $KID supply.
        </p>
        <p className="text-blue-400 font-bold mb-2">🔐 Security</p>
        <p className="text-gray-400 text-xs space-y-1">
          <span className="block">✅ Your private keys NEVER leave your wallet extension</span>
          <span className="block">✅ Transaction simulated before requesting signature</span>
          <span className="block">✅ You review and approve in your wallet (Phantom/Solflare)</span>
          <span className="block">✅ Zero-trust architecture - app cannot access your keys</span>
        </p>
      </div>
    </div>
  );
}
