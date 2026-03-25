'use client';

import './polyfills';
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ConnectionProvider, WalletProvider, useConnection } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { clusterApiUrl } from '@solana/web3.js';
import type { VaultNFT } from './components/VaultNFTs';

const VaultNFTs = dynamic(
  async () => (await import('./components/VaultNFTs')).VaultNFTs,
  { ssr: false }
);
const SwapSection = dynamic(
  async () => (await import('./components/SwapSection')).SwapSection,
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

if (typeof window !== 'undefined') {
  require('@solana/wallet-adapter-react-ui/styles.css');
}

function GhostKidApp() {
  const { connection } = useConnection();
  const [selectedNFT, setSelectedNFT] = useState<VaultNFT | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <nav className="border-b border-gray-800 bg-black/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
              GhostKid Swap
            </h1>
            <span className="text-xs bg-purple-900/50 text-purple-300 border border-purple-500/30 px-2 py-1 rounded-full">
              NFT ↔ NFT
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/kidpool"
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              $KID Pool →
            </a>
            <WalletMultiButton />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-bold mb-3">
            Swap GhostKids
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Browse the vault, pick a GhostKid you want, then select one of yours of the same rarity to swap for it. No tokens needed.
          </p>
        </div>

        <div className="space-y-8">
          {/* Step 1: Pick from vault */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
              <h3 className="text-lg font-semibold text-gray-200">Choose a GhostKid from the vault</h3>
              {selectedNFT && (
                <span className="ml-auto text-xs text-green-400 bg-green-900/30 border border-green-500/30 px-3 py-1 rounded-full">
                  Selected: {selectedNFT.name}
                </span>
              )}
            </div>
            {connection && (
              <VaultNFTs connection={connection} onNFTSelect={setSelectedNFT} />
            )}
          </div>

          {/* Step 2: Swap */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
              <h3 className="text-lg font-semibold text-gray-200">Select your GhostKid to swap away</h3>
            </div>
            {connection && (
              <SwapSection
                connection={connection}
                selectedVaultNFT={selectedNFT}
                onSuccess={() => setSelectedNFT(null)}
              />
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-800 mt-20 py-6 text-center text-gray-600 text-xs">
        GhostKid DAO · SPL-404 · <a href="https://solscan.io/account/JCSbaLqdn6nKtTVTUjAaxsv28TBhmpypcY3VAqdGKWLA" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400">Vault</a>
      </footer>
    </div>
  );
}

export default function Home() {
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
        <WalletModalProvider>
          <GhostKidApp />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
