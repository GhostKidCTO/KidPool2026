'use client';

import './polyfills';
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ConnectionProvider, WalletProvider, useConnection, useWallet } from '@solana/wallet-adapter-react';
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

// ── Step indicator ───────────────────────────────────────────────────────────

function Step({ n, state, children }: { n: number; state: 'pending' | 'active' | 'complete'; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className={`step-dot ${state}`} aria-hidden="true">
        {state === 'complete' ? '✓' : n}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ── Main app (inner) ─────────────────────────────────────────────────────────

function GhostKidApp() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [selectedNFT, setSelectedNFT] = useState<VaultNFT | null>(null);

  const step1State = selectedNFT ? 'complete' : 'active';
  const step2State = selectedNFT ? 'active' : 'pending';

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #07071a 0%, #030309 100%)' }}>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-20 border-b"
        style={{
          background: 'rgba(7,7,26,0.85)',
          borderColor: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black tracking-tight bg-gradient-to-r from-purple-400 to-fuchsia-500 bg-clip-text text-transparent">
              GhostKid
            </span>
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{
                background: 'rgba(147,51,234,0.15)',
                color: '#c084fc',
                border: '1px solid rgba(168,85,247,0.3)',
              }}
            >
              NFT Swap
            </span>
          </div>
          <div className="flex items-center gap-5">
            <a
              href="/kidpool"
              className="text-xs font-medium transition-colors"
              style={{ color: 'var(--gk-dim)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--gk-muted)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--gk-dim)')}
            >
              $KID Pool
            </a>
            <WalletMultiButton />
          </div>
        </div>
      </nav>

      {/* ── Disconnected hero ─────────────────────────────────────────────── */}
      {!publicKey && (
        <div className="max-w-6xl mx-auto px-5 pt-20 pb-12 text-center animate-fade-up">
          <div className="text-6xl mb-6">👻</div>
          <h1 className="text-5xl font-black tracking-tight mb-4" style={{ letterSpacing: '-0.03em' }}>
            Swap GhostKids
          </h1>
          <p className="text-lg mb-8 max-w-md mx-auto leading-relaxed" style={{ color: 'var(--gk-muted)' }}>
            Trade your GhostKid NFT for one from the vault — same rarity, no tokens, fully on-chain.
          </p>
          <div className="flex justify-center mb-16">
            <WalletMultiButton />
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3">
            {['Same-rarity swap', 'No $KID required', 'Atomic transaction', 'Phantom & Solflare'].map(f => (
              <span
                key={f}
                className="text-xs font-medium px-3 py-1.5 rounded-full"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'var(--gk-muted)',
                }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Connected main content ────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-5 py-8">

        {/* Step 1 – Browse vault */}
        <section className="mb-10">
          <Step n={1} state={step1State}>
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <h2 className="text-base font-semibold" style={{ color: 'var(--gk-text)' }}>
                Choose a GhostKid from the vault
              </h2>
              {selectedNFT && (
                <span className="text-xs font-medium" style={{ color: 'var(--gk-success)' }}>
                  {selectedNFT.name} selected
                </span>
              )}
            </div>
          </Step>
          {connection && (
            <VaultNFTs connection={connection} onNFTSelect={setSelectedNFT} />
          )}
        </section>

        {/* Divider */}
        <div
          className="h-px my-10"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.2), transparent)' }}
        />

        {/* Step 2 – Pick yours and swap */}
        <section>
          <Step n={2} state={step2State}>
            <h2 className="text-base font-semibold" style={{ color: step2State === 'pending' ? 'var(--gk-dim)' : 'var(--gk-text)' }}>
              Pick your GhostKid and confirm the swap
            </h2>
          </Step>
          {connection && (
            <SwapSection
              connection={connection}
              selectedVaultNFT={selectedNFT}
              onSuccess={() => setSelectedNFT(null)}
            />
          )}
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer
        className="border-t mt-20 py-6 text-center"
        style={{ borderColor: 'rgba(255,255,255,0.05)', color: 'var(--gk-dim)', fontSize: '0.75rem' }}
      >
        GhostKid DAO · SPL-404 ·{' '}
        <a
          href="https://solscan.io/account/JCSbaLqdn6nKtTVTUjAaxsv28TBhmpypcY3VAqdGKWLA"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:underline"
          style={{ color: 'var(--gk-dim)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--gk-muted)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--gk-dim)')}
        >
          Vault
        </a>
      </footer>
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_RPC_ENDPOINT || clusterApiUrl(WalletAdapterNetwork.Mainnet),
    []
  );
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

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
