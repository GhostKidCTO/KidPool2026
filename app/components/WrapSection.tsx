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

      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      const nftAccounts = tokenAccounts.value.filter(({ account }) => {
        const data = account.data.parsed.info;
        return data.tokenAmount.decimals === 0 && data.tokenAmount.uiAmount === 1;
      });

      setLoadingProgress({ current: 0, total: nftAccounts.length });

      const nfts: UserNFT[] = [];
      const METAPLEX_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

      for (let i = 0; i < nftAccounts.length; i++) {
        const { account } = nftAccounts[i];
        const mintAddress = account.data.parsed.info.mint;

        try {
          // Derive on-chain Metaplex metadata PDA
          const mintPubkey = new PublicKey(mintAddress);
          const [metadataPDA] = await PublicKey.findProgramAddress(
            [Buffer.from('metadata'), METAPLEX_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()],
            METAPLEX_PROGRAM_ID
          );

          const metadataAccount = await connection.getAccountInfo(metadataPDA);
          if (!metadataAccount) {
            setLoadingProgress({ current: i + 1, total: nftAccounts.length });
            continue;
          }

          // Parse on-chain metadata to get the URI
          const parsed = parseMetaplexMetadata(metadataAccount.data);

          // Filter: must be a GhostKid by name or collection
          const isGhostKid =
            parsed.name?.toLowerCase().includes('ghost') ||
            parsed.collection === ADDRESSES.ghostKidCollection.toBase58();

          if (!isGhostKid || !parsed.uri) {
            setLoadingProgress({ current: i + 1, total: nftAccounts.length });
            continue;
          }

          // Fetch off-chain JSON (Arweave/IPFS) via CORS proxy
          const response = await fetch(`/api/metadata?url=${encodeURIComponent(parsed.uri)}`);
          if (!response.ok) {
            setLoadingProgress({ current: i + 1, total: nftAccounts.length });
            continue;
          }

          const json = await response.json();
          const attributes = json.attributes || [];
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

          nfts.push({
            mint: mintAddress,
            name: json.name || parsed.name || `GhostKid #${mintAddress.slice(0, 4)}`,
            image: json.image || '',
            rarity,
          });

          setLoadingProgress({ current: i + 1, total: nftAccounts.length });
        } catch {
          setLoadingProgress({ current: i + 1, total: nftAccounts.length });
          continue;
        }

        // Small delay to avoid hammering RPC
        if (i < nftAccounts.length - 1 && i % 5 === 4) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

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

      // Vault's NFT token account (destination)
      const vaultNftAccount = await getAssociatedTokenAddress(nftMint, ADDRESSES.ghostKidVault);

      // User's $KID account (receives $KID)
      const userKidAccount = await getAssociatedTokenAddress(ADDRESSES.kidsTokenMint, publicKey);

      // PDAs
      const [nftReceipt] = await getNftReceiptPDA(nftMint);
      const [metadataPDA] = await getMetadataPDA(nftMint);
      const [editionPDA] = await getEditionPDA(nftMint);
      const [sourceTokenRecord] = await getTokenRecordPDA(nftMint, userNftAccount);
      const [destinationTokenRecord] = await getTokenRecordPDA(nftMint, vaultNftAccount);

      const transaction = new Transaction();

      // Create vault's ATA for this NFT if needed
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

      // Create user's $KID ATA if needed
      const userKidAccountInfo = await connection.getAccountInfo(userKidAccount);
      if (!userKidAccountInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            userKidAccount,
            publicKey,
            ADDRESSES.kidsTokenMint
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

      // Simulate first
      const simulation = await connection.simulateTransaction(transaction);
      if (simulation.value.err) {
        setSimulationResult({
          success: false,
          message: `Transaction would fail: ${JSON.stringify(simulation.value.err)}\nLogs: ${simulation.value.logs?.join('\n') || 'No logs'}`,
        });
        throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
      }

      setSimulationResult({
        success: true,
        message: `✅ Simulation successful. You will deposit ${selectedNFT.name} and receive ${WRAP_VALUES[selectedNFT.rarity].toLocaleString()} $KID.`,
      });

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
      if (!err.message?.includes('Simulation failed')) {
        setError(err.message || 'Failed to wrap NFT');
      }
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
