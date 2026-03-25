'use client';

import '../polyfills';
import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { clusterApiUrl } from '@solana/web3.js';
import Link from 'next/link';

if (typeof window !== 'undefined') {
  require('@solana/wallet-adapter-react-ui/styles.css');
}

// ─── Coming Soon ────────────────────────────────────────────────────────────
// The $KID Pool (Wrap / Unwrap) is feature-complete but requires the
// program authority keypair to co-sign transactions. It will go live once
// the authority wallet is restored.
//
// All code is preserved below — just uncomment to re-enable.
// ────────────────────────────────────────────────────────────────────────────

/*
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import type { VaultNFT } from '../components/VaultNFTs';

const VaultNFTs = dynamic(
  async () => (await import('../components/VaultNFTs')).VaultNFTs,
  { ssr: false }
);
const UnwrapSection = dynamic(
  async () => (await import('../components/UnwrapSection')).UnwrapSection,
  { ssr: false }
);
const WrapSection = dynamic(
  async () => (await import('../components/WrapSection')).WrapSection,
  { ssr: false }
);
const WalletModalProvider = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletModalProvider,
  { ssr: false }
);
const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

const KID_MINT = '4peG5vF6VXbUt8PPA5LDbtdeRAPBGGrspDMW3ot6TdeX';

function KidPoolApp() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [kidBalance, setKidBalance] = useState(0);
  const [selectedNFT, setSelectedNFT] = useState<VaultNFT | null>(null);

  useEffect(() => {
    if (publicKey) fetchKidBalance();
    else setKidBalance(0);
  }, [publicKey]);

  async function fetchKidBalance() {
    if (!publicKey) return;
    try {
      const accounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { mint: new PublicKey(KID_MINT) }
      );
      setKidBalance(
        accounts.value.length > 0
          ? accounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0
          : 0
      );
    } catch {
      setKidBalance(0);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <nav className="border-b border-gray-800 bg-black/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/" className="text-gray-500 hover:text-gray-300 text-sm">← Swap</a>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              $KID Pool
            </h1>
            {publicKey && (
              <div className="text-sm bg-gray-800/50 px-4 py-2 rounded-lg">
                $KID: <span className="font-bold text-blue-400">{kidBalance.toLocaleString()}</span>
              </div>
            )}
          </div>
          <WalletMultiButton />
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {connection && <VaultNFTs connection={connection} onNFTSelect={setSelectedNFT} />}
        <div className="grid md:grid-cols-2 gap-8">
          {connection && (
            <UnwrapSection
              connection={connection}
              kidBalance={kidBalance}
              selectedNFT={selectedNFT}
              onSuccess={() => { fetchKidBalance(); setSelectedNFT(null); }}
            />
          )}
          {connection && <WrapSection connection={connection} onSuccess={fetchKidBalance} />}
        </div>
      </main>
    </div>
  );
}
*/

function ComingSoon() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex flex-col">
      <nav className="border-b border-gray-800 bg-black/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-gray-400 hover:text-white text-sm transition-colors">
            ← Back to Swap
          </Link>
          <h1 className="text-xl font-bold text-gray-300">$KID Pool</h1>
          <div className="w-24" />
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-lg">
          <div className="text-7xl mb-6">👻</div>

          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Coming Soon
          </h2>

          <p className="text-gray-400 text-lg mb-8 leading-relaxed">
            The $KID Pool — wrap your GhostKid NFTs for $KID tokens, or spend $KID to pull NFTs from the vault — is built and ready.
          </p>

          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-8 text-left space-y-4">
            <p className="text-sm font-semibold text-gray-300 mb-2">What's coming:</p>
            <div className="flex items-start gap-3">
              <span className="text-blue-400 mt-0.5">→</span>
              <div>
                <p className="text-sm font-medium text-white">Unwrap</p>
                <p className="text-xs text-gray-500">Spend $KID to receive a GhostKid NFT from the vault (10k / 15k / 25k by rarity)</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-cyan-400 mt-0.5">→</span>
              <div>
                <p className="text-sm font-medium text-white">Wrap</p>
                <p className="text-xs text-gray-500">Deposit your GhostKid NFT into the vault and receive $KID tokens</p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg px-5 py-4 text-sm text-yellow-300/80">
            Pending authority wallet restoration. NFT-for-NFT swaps are live now on the main page.
          </div>

          <Link
            href="/"
            className="inline-block mt-8 px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 rounded-lg font-semibold transition-all"
          >
            Go Swap NFTs →
          </Link>
        </div>
      </div>

      <footer className="border-t border-gray-800 py-6 text-center text-gray-600 text-xs">
        GhostKid DAO · SPL-404
      </footer>
    </div>
  );
}

export default function KidPoolPage() {
  const endpoint = useMemo(() => {
    return process.env.NEXT_PUBLIC_RPC_ENDPOINT || clusterApiUrl(WalletAdapterNetwork.Mainnet);
  }, []);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <ComingSoon />
      </WalletProvider>
    </ConnectionProvider>
  );
}
