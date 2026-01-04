'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

interface UserNFT {
  mint: string;
  name: string;
  image: string;
  rarity: 'common' | 'rare' | 'legendary';
}

const ADDRESSES = {
  kidsTokenMint: new PublicKey('4peG5vF6VXbUt8PPA5LDbtdeRAPBGGrspDMW3ot6TdeX'),
  ghostKidCollection: new PublicKey('FSw4cZhK5pMmhEDenDpa3CauJ9kLt5agr2U1oQxaH2cv'),
};

const WRAP_VALUES = {
  common: 10000,
  rare: 15000,
  legendary: 25000,
};

export function WrapSection({ connection }: { connection: Connection }) {
  const { publicKey } = useWallet();
  const [userNFTs, setUserNFTs] = useState<UserNFT[]>([]);
  const [selectedNFT, setSelectedNFT] = useState<UserNFT | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

      // Get all token accounts owned by user
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      // Filter for NFTs (decimals = 0, amount = 1)
      const nftAccounts = tokenAccounts.value.filter(({ account }) => {
        const data = account.data.parsed.info;
        return data.tokenAmount.decimals === 0 && data.tokenAmount.uiAmount === 1;
      });

      setLoadingProgress({ current: 0, total: nftAccounts.length });

      const nfts: UserNFT[] = [];

      for (let i = 0; i < nftAccounts.length; i++) {
        const { account } = nftAccounts[i];
        const mintAddress = account.data.parsed.info.mint;

        try {
          // Fetch metadata
          const metadataResponse = await fetch(`/api/metadata?url=https://api.ghostkid.io/metadata/${mintAddress}`);
          if (!metadataResponse.ok) continue;

          const metadata = await metadataResponse.json();

          // Check if it's from GhostKid collection
          if (metadata.collection?.key === ADDRESSES.ghostKidCollection.toBase58()) {
            // Determine rarity from attributes
            const attributes = metadata.attributes || [];
            const rarityAttr = attributes.find((attr: any) =>
              attr.trait_type?.toLowerCase() === 'rarity'
            );

            let rarity: 'common' | 'rare' | 'legendary' = 'common';
            if (rarityAttr) {
              const rarityValue = rarityAttr.value?.toLowerCase();
              if (rarityValue === 'rare') rarity = 'rare';
              else if (rarityValue === 'legendary') rarity = 'legendary';
            }

            nfts.push({
              mint: mintAddress,
              name: metadata.name || `GhostKid #${mintAddress.slice(0, 4)}`,
              image: metadata.image || '',
              rarity,
            });
          }

          setLoadingProgress({ current: i + 1, total: nftAccounts.length });
        } catch (metaError) {
          console.error(`Error fetching metadata for ${mintAddress}:`, metaError);
          continue;
        }

        // Rate limiting
        if (i < nftAccounts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      setUserNFTs(nfts);
    } catch (err: any) {
      console.error('Error fetching user NFTs:', err);
      setError(err?.message || 'Failed to load NFTs');
    } finally {
      setLoading(false);
    }
  }

  async function handleWrap() {
    if (!publicKey || !selectedNFT) {
      setError('Please select an NFT to wrap');
      return;
    }

    setError('🚧 Wrap feature coming soon! This will deposit your NFT into the vault and mint the corresponding $KID tokens based on rarity.');
    // TODO: Implement wrap transaction
    // 1. Transfer NFT to vault
    // 2. Create deposit receipt
    // 3. Mint $KID tokens to user
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

      {/* Wrap Values */}
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
            <p className="text-sm text-gray-500">
              {loadingProgress.current} / {loadingProgress.total} NFTs checked
            </p>
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
            <p className="text-sm text-gray-400 mb-3">
              Your GhostKid NFTs ({userNFTs.length})
            </p>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-96 overflow-y-auto">
              {userNFTs.map((nft) => (
                <button
                  key={nft.mint}
                  onClick={() => setSelectedNFT(nft.mint === selectedNFT?.mint ? null : nft)}
                  className={`relative aspect-square rounded-lg border-2 transition-all overflow-hidden ${
                    selectedNFT?.mint === nft.mint
                      ? 'border-blue-500 ring-2 ring-blue-500 scale-105'
                      : 'border-gray-600 hover:border-blue-400'
                  } bg-gray-900`}
                >
                  {nft.image ? (
                    <img
                      src={nft.image}
                      alt={nft.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      👻
                    </div>
                  )}
                  <div className="absolute top-1 right-1 text-lg">
                    {getRarityIcon(nft.rarity)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedNFT && (
            <div className={`bg-gradient-to-br ${getRarityColor(selectedNFT.rarity)}/20 border-2 border-${selectedNFT.rarity === 'legendary' ? 'yellow' : selectedNFT.rarity === 'rare' ? 'purple' : 'blue'}-500/50 rounded-lg p-4 mb-4`}>
              <p className="text-sm text-gray-400 mb-2">Selected NFT to wrap:</p>
              <div className="flex items-center gap-4">
                {selectedNFT.image && (
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-900 flex-shrink-0">
                    <img src={selectedNFT.image} alt={selectedNFT.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-bold text-lg">{selectedNFT.name}</p>
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

          <button
            onClick={handleWrap}
            disabled={!selectedNFT || loading}
            className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
              !selectedNFT || loading
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : `bg-gradient-to-r ${getRarityColor(selectedNFT.rarity)} hover:opacity-90 text-white shadow-lg`
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Processing...
              </span>
            ) : !selectedNFT ? (
              'Select an NFT to wrap'
            ) : (
              <>
                {getRarityIcon(selectedNFT.rarity)} Wrap for {WRAP_VALUES[selectedNFT.rarity].toLocaleString()} $KID
              </>
            )}
          </button>

          {error && (
            <div className="mt-4 bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4">
              <p className="text-yellow-400 text-sm">{error}</p>
            </div>
          )}
        </>
      )}

      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 text-sm mt-6">
        <p className="text-blue-400 font-bold mb-2">ℹ️ How it works</p>
        <p className="text-gray-400 text-xs">
          Wrapping deposits your GhostKid NFT into the vault and mints the corresponding amount of $KID tokens to your wallet based on rarity.
          The NFT will be held securely in the vault and can be unwrapped later by burning the $KID tokens.
        </p>
      </div>
    </div>
  );
}
