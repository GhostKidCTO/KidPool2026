'use client';

import { useState, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';

export interface VaultNFT {
  mint: string;
  name: string;
  image: string;
  rarity: 'common' | 'rare' | 'legendary';
  attributes?: any[];
}

const VAULT_ADDRESS = 'JCSbaLqdn6nKtTVTUjAaxsv28TBhmpypcY3VAqdGKWLA';

function determineRarity(attributes: any[]): 'common' | 'rare' | 'legendary' {
  // Check for specific rare/legendary traits
  // This logic can be customized based on your NFT trait structure

  if (!attributes || attributes.length === 0) return 'common';

  // Look for rarity indicators in attributes
  const rarityTrait = attributes.find(attr =>
    attr.trait_type?.toLowerCase() === 'rarity' ||
    attr.trait_type?.toLowerCase() === 'tier'
  );

  if (rarityTrait) {
    const value = rarityTrait.value?.toLowerCase();
    if (value === 'legendary' || value === 'mythic') return 'legendary';
    if (value === 'rare' || value === 'epic') return 'rare';
    return 'common';
  }

  // Alternative: count rare traits (customize based on your collection)
  const rareTraits = attributes.filter(attr => {
    const value = attr.value?.toLowerCase() || '';
    return value.includes('gold') ||
           value.includes('diamond') ||
           value.includes('legendary') ||
           value.includes('laser');
  });

  if (rareTraits.length >= 3) return 'legendary';
  if (rareTraits.length >= 1) return 'rare';

  return 'common';
}

interface VaultNFTsProps {
  connection: Connection;
  onNFTSelect?: (nft: VaultNFT | null) => void;
}

export function VaultNFTs({ connection, onNFTSelect }: VaultNFTsProps) {
  const [nfts, setNfts] = useState<VaultNFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rarityFilter, setRarityFilter] = useState<'all' | 'common' | 'rare' | 'legendary'>('all');
  const [selectedNFT, setSelectedNFT] = useState<VaultNFT | null>(null);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });
  const [rateLimitWarning, setRateLimitWarning] = useState(false);

  const handleNFTSelect = (nft: VaultNFT) => {
    setSelectedNFT(nft);
    if (onNFTSelect) {
      onNFTSelect(nft);
    }
  };

  useEffect(() => {
    fetchVaultNFTs();
  }, []);

  async function fetchVaultNFTs() {
    try {
      setLoading(true);
      setError(null);

      // Get all token accounts owned by vault
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        new PublicKey(VAULT_ADDRESS),
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
      );

      const nftList: VaultNFT[] = [];
      const totalAccounts = tokenAccounts.value.length;
      setLoadingProgress({ current: 0, total: totalAccounts });

      // Process in batches to avoid rate limits
      const BATCH_SIZE = 3; // Very conservative to avoid 429s
      const DELAY_MS = 3000; // 3 seconds between batches
      let consecutiveErrors = 0;

      for (let i = 0; i < totalAccounts; i += BATCH_SIZE) {
        const batch = tokenAccounts.value.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async ({ account }) => {
            const data = account.data.parsed.info;

            // Only include NFTs (amount = 1, decimals = 0)
            if (data.tokenAmount.decimals === 0 && data.tokenAmount.uiAmount === 1) {
              try {
                // Fetch metadata
                const mintPubkey = new PublicKey(data.mint);
                const metadataPDA = await getMetadataPDA(mintPubkey);

                let metadataAccount;
                try {
                  metadataAccount = await connection.getAccountInfo(metadataPDA);
                } catch (rpcError: any) {
                  // Detect rate limiting
                  if (rpcError.message?.includes('429') || rpcError.code === 429) {
                    consecutiveErrors++;
                    setRateLimitWarning(true);
                    console.warn(`Rate limit hit (429). Consecutive errors: ${consecutiveErrors}`);
                  }
                  throw rpcError;
                }

                if (metadataAccount) {
                  // Parse metadata to get URI
                  const metadata = parseMetadata(metadataAccount.data);

                  // Fetch off-chain metadata JSON via API route (bypasses CORS)
                  let imageUrl = '';
                  let nftName = metadata.name || `GhostKid #${nftList.length + 1}`;

                  if (metadata.uri) {
                    try {
                      const response = await fetch(`/api/metadata?url=${encodeURIComponent(metadata.uri)}`);
                      if (response.ok) {
                        const json = await response.json();
                        imageUrl = json.image || '';
                        nftName = json.name || nftName;
                        const attributes = json.attributes || [];
                        const rarity = determineRarity(attributes);

                        nftList.push({
                          mint: data.mint,
                          name: nftName,
                          image: imageUrl,
                          rarity,
                          attributes
                        });
                      }
                    } catch (err) {
                      console.error(`Error fetching metadata for ${data.mint}:`, err);
                    }
                  } else {
                    // No URI, add with default rarity
                    nftList.push({
                      mint: data.mint,
                      name: nftName,
                      image: imageUrl,
                      rarity: 'common',
                      attributes: []
                    });
                  }
                }
              } catch (err) {
                console.error('Error processing NFT:', err);
              }
            }
          })
        );

        const processed = i + batch.length;
        setLoadingProgress({ current: processed, total: totalAccounts });
        setNfts([...nftList]); // Update UI progressively

        // Add delay between batches to avoid rate limits
        if (i + BATCH_SIZE < totalAccounts) {
          // Exponential backoff if we're hitting errors
          const backoffMultiplier = Math.min(Math.pow(1.5, consecutiveErrors), 5);
          const delayWithBackoff = DELAY_MS * backoffMultiplier;

          console.log(`Waiting ${delayWithBackoff}ms before next batch (backoff: ${backoffMultiplier.toFixed(1)}x)`);
          await new Promise(resolve => setTimeout(resolve, delayWithBackoff));

          // Reset consecutive errors if we had a successful batch
          consecutiveErrors = 0;
        }
      }

      setNfts(nftList);
    } catch (err: any) {
      console.error('Error fetching vault NFTs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading && nfts.length === 0) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
        <p className="text-gray-400">Loading vault NFTs...</p>
        {loadingProgress.total > 0 && (
          <div className="mt-4">
            <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-500">
              {loadingProgress.current} / {loadingProgress.total} accounts processed
            </p>
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6">
        <h3 className="text-red-400 font-bold mb-2">Error Loading Vault</h3>
        <p className="text-sm text-gray-400">{error}</p>
        <button
          onClick={fetchVaultNFTs}
          className="mt-4 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  const filteredNFTs = rarityFilter === 'all'
    ? nfts
    : nfts.filter(nft => nft.rarity === rarityFilter);

  const rarityCounts = {
    common: nfts.filter(n => n.rarity === 'common').length,
    rare: nfts.filter(n => n.rarity === 'rare').length,
    legendary: nfts.filter(n => n.rarity === 'legendary').length,
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Available in Vault</h2>
        <div className="bg-purple-900/30 px-4 py-2 rounded-lg">
          <span className="text-purple-400 font-bold">{nfts.length}</span>
          <span className="text-gray-400 ml-2">NFTs</span>
        </div>
      </div>

      {/* Rate Limit Warning */}
      {rateLimitWarning && (
        <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4 mb-6">
          <p className="text-yellow-400 font-bold mb-2">⚠️ RPC Rate Limit Detected</p>
          <p className="text-sm text-gray-400 mb-2">
            Loading is slower to avoid hitting rate limits. For faster loading:
          </p>
          <ul className="text-xs text-gray-400 list-disc list-inside space-y-1">
            <li>Set NEXT_PUBLIC_RPC_ENDPOINT in your .env.local to use a paid RPC</li>
            <li>Or wait - we're using exponential backoff (3-15 seconds between batches)</li>
          </ul>
        </div>
      )}

      {/* Rarity Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setRarityFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            rarityFilter === 'all'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700'
          }`}
        >
          All ({nfts.length})
        </button>
        <button
          onClick={() => setRarityFilter('common')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            rarityFilter === 'common'
              ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700'
          }`}
        >
          🔵 Common ({rarityCounts.common})
        </button>
        <button
          onClick={() => setRarityFilter('rare')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            rarityFilter === 'rare'
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700'
          }`}
        >
          ⭐ Rare ({rarityCounts.rare})
        </button>
        <button
          onClick={() => setRarityFilter('legendary')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            rarityFilter === 'legendary'
              ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700'
          }`}
        >
          💎 Legendary ({rarityCounts.legendary})
        </button>
      </div>

      {filteredNFTs.length === 0 ? (
        <div className="bg-gray-800/50 rounded-lg p-12 text-center">
          <p className="text-gray-400">No {rarityFilter !== 'all' ? rarityFilter : ''} NFTs currently in vault</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredNFTs.map((nft, i) => (
            <div
              key={nft.mint}
              onClick={() => handleNFTSelect(nft)}
              className={`bg-gray-800/50 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                selectedNFT?.mint === nft.mint
                  ? 'border-purple-500 ring-2 ring-purple-500 ring-offset-2 ring-offset-gray-900'
                  : 'border-gray-700 hover:border-purple-400'
              }`}
            >
              <div className="aspect-square bg-gray-900 relative">
                {nft.image && (
                  <img
                    src={nft.image}
                    alt={nft.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
                {/* Rarity badge */}
                <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold ${
                  nft.rarity === 'legendary' ? 'bg-yellow-500/90 text-black' :
                  nft.rarity === 'rare' ? 'bg-purple-500/90 text-white' :
                  'bg-blue-500/90 text-white'
                }`}>
                  {nft.rarity === 'legendary' ? '💎' : nft.rarity === 'rare' ? '⭐' : '🔵'}
                </div>
              </div>
              <div className="p-2">
                <p className="text-xs text-gray-400 truncate">{nft.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Progressive Loading Indicator */}
      {loading && nfts.length > 0 && (
        <div className="mt-6 bg-gray-800/50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400"></div>
            <div className="flex-1">
              <p className="text-sm text-gray-400">Loading more NFTs...</p>
              {loadingProgress.total > 0 && (
                <div className="mt-2">
                  <div className="w-full bg-gray-700 rounded-full h-1.5">
                    <div
                      className="bg-purple-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {nfts.length} loaded • {loadingProgress.current} / {loadingProgress.total} processed
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selected NFT Info */}
      {selectedNFT && (
        <div className="mt-6 bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-2">Selected for unwrap:</p>
          <p className="text-lg font-bold text-purple-400">{selectedNFT.name}</p>
          <p className="text-sm text-gray-500">Mint: {selectedNFT.mint.slice(0, 8)}...</p>
        </div>
      )}
    </div>
  );
}

async function getMetadataPDA(mint: PublicKey): Promise<PublicKey> {
  const [pda] = await PublicKey.findProgramAddress(
    [
      Buffer.from('metadata'),
      new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
      mint.toBuffer(),
    ],
    new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
  );
  return pda;
}

function parseMetadata(data: Buffer): { name: string; uri?: string } {
  // Parse Metaplex metadata structure
  // Reference: https://docs.metaplex.com/programs/token-metadata/accounts
  try {
    let offset = 1 + 32 + 32; // Skip: key (1) + update_authority (32) + mint (32)

    // Read name (string with 4-byte length prefix)
    const nameLen = data.readUInt32LE(offset);
    offset += 4;
    const name = data.slice(offset, offset + nameLen).toString('utf8').replace(/\0/g, '');
    offset += nameLen;

    // Read symbol (string with 4-byte length prefix)
    const symbolLen = data.readUInt32LE(offset);
    offset += 4 + symbolLen;

    // Read URI (string with 4-byte length prefix)
    const uriLen = data.readUInt32LE(offset);
    offset += 4;
    const uri = data.slice(offset, offset + uriLen).toString('utf8').replace(/\0/g, '');

    return { name: name || 'GhostKid NFT', uri: uri || undefined };
  } catch (err) {
    console.error('Error parsing metadata:', err);
    return { name: 'GhostKid NFT' };
  }
}
