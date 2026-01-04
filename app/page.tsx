'use client';

import './polyfills';
import { useMemo, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ConnectionProvider, WalletProvider, useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl, PublicKey, Connection } from '@solana/web3.js';
import { VaultNFTs, type VaultNFT } from './components/VaultNFTs';
import { UnwrapSection } from './components/UnwrapSection';
import { WrapSection } from './components/WrapSection';

// Dynamically import wallet UI components to avoid SSR issues
const WalletModalProvider = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletModalProvider,
  { ssr: false }
);
const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

if (typeof window !== 'undefined') {
  require('@solana/wallet-adapter-react-ui/styles.css');
}

const ADDRESSES = {
  kidsTokenMint: '4peG5vF6VXbUt8PPA5LDbtdeRAPBGGrspDMW3ot6TdeX',
  ghostKidCollection: 'FSw4cZhK5pMmhEDenDpa3CauJ9kLt5agr2U1oQxaH2cv',
  ghostKidVault: 'JCSbaLqdn6nKtTVTUjAaxsv28TBhmpypcY3VAqdGKWLA',
  ghostKidProgram: '4BTy6FpUakBpNNTJFF6V7BK4fKR2bds6Sh523Z3gxy4k',
  ghostKidAuthority: 'qgDDcomgjASwB27LaxMFXyzhpuzvRpkCSzbdDJcoEks',
};

function GhostKidApp() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [kidBalance, setKidBalance] = useState<number>(0);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [selectedNFT, setSelectedNFT] = useState<VaultNFT | null>(null);

  useEffect(() => {
    if (publicKey) {
      fetchKidBalance();
    } else {
      setKidBalance(0);
      setBalanceError(null);
    }
  }, [publicKey]);

  async function fetchKidBalance() {
    if (!publicKey) return;

    try {
      setBalanceError(null);
      // Get associated token account for $KID
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { mint: new PublicKey(ADDRESSES.kidsTokenMint) }
      );

      if (tokenAccounts.value.length > 0) {
        const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
        setKidBalance(balance || 0);
      } else {
        setKidBalance(0);
      }
    } catch (err: any) {
      console.error('Error fetching $KID balance:', err);
      setBalanceError(err?.message || 'Failed to fetch balance');
      setKidBalance(0);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <nav className="border-b border-gray-800 bg-black/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
              GhostKid SPL-404
            </h1>
            {publicKey && (
              <div className="text-sm bg-gray-800/50 px-4 py-2 rounded-lg">
                $KID Balance: <span className="font-bold text-purple-400">{kidBalance.toFixed(2)}</span>
              </div>
            )}
          </div>
          <WalletMultiButton />
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {!publicKey ? (
          <div className="text-center py-20">
            <h2 className="text-4xl font-bold mb-4">Welcome to GhostKid SPL-404</h2>
            <p className="text-gray-400 mb-8">Connect your wallet to view vault NFTs and unwrap $KID tokens</p>
            <div className="flex justify-center">
              <WalletMultiButton />
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {balanceError && (
              <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4">
                <p className="text-yellow-400 text-sm">⚠️ Error loading balance: {balanceError}</p>
              </div>
            )}
            {connection && <VaultNFTs connection={connection} onNFTSelect={setSelectedNFT} />}
            <div className="grid md:grid-cols-2 gap-8">
              {connection && <UnwrapSection connection={connection} kidBalance={kidBalance} selectedNFT={selectedNFT} onSuccess={() => { fetchKidBalance(); setSelectedNFT(null); }} />}
              {connection && <WrapSection connection={connection} />}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-800 mt-20 py-8 text-center text-gray-500 text-sm">
        <p>GhostKid DAO • SPL-404 Hybrid Token System</p>
        <p className="mt-2">Program: {ADDRESSES.ghostKidProgram.slice(0, 8)}...</p>
      </footer>
    </div>
  );
}

export default function Home() {
  // Use RPC endpoint from environment variable or fallback to clusterApiUrl
  const endpoint = useMemo(() => {
    const envEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT;
    if (envEndpoint) {
      return envEndpoint;
    }
    // Fallback to Solana public endpoint (may be rate limited)
    return clusterApiUrl(WalletAdapterNetwork.Mainnet);
  }, []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          <GhostKidApp />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
