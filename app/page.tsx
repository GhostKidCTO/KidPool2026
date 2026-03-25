'use client';

import './polyfills';
import { useMemo, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ConnectionProvider, WalletProvider, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { clusterApiUrl, PublicKey } from '@solana/web3.js';
import type { VaultNFT } from './components/VaultNFTs';

const VaultNFTs = dynamic(
  async () => (await import('./components/VaultNFTs')).VaultNFTs,
  { ssr: false }
);
const UnwrapSection = dynamic(
  async () => (await import('./components/UnwrapSection')).UnwrapSection,
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

const KID_MINT = '4peG5vF6VXbUt8PPA5LDbtdeRAPBGGrspDMW3ot6TdeX';

// ── Main app (inner) ─────────────────────────────────────────────────────────

function GhostKidApp() {
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
              $KID Pool
            </span>
            {publicKey && (
              <span
                className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                style={{
                  background: 'rgba(59,130,246,0.15)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59,130,246,0.3)',
                }}
              >
                {kidBalance.toLocaleString()} $KID
              </span>
            )}
          </div>
          <WalletMultiButton />
        </div>
      </nav>

      {/* ── Disconnected hero ─────────────────────────────────────────────── */}
      {!publicKey && (
        <div className="max-w-6xl mx-auto px-5 pt-20 pb-12 text-center animate-fade-up">
          <div className="text-6xl mb-6">👻</div>
          <h1 className="text-5xl font-black tracking-tight mb-4" style={{ letterSpacing: '-0.03em' }}>
            Get a GhostKid
          </h1>
          <p className="text-lg mb-8 max-w-md mx-auto leading-relaxed" style={{ color: 'var(--gk-muted)' }}>
            Spend $KID tokens to claim a GhostKid NFT directly from the vault — fully on-chain, no intermediaries.
          </p>
          <div className="flex justify-center mb-16">
            <WalletMultiButton />
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3">
            {['Spend $KID · Get NFT', 'Common · Rare · Legendary', 'Phantom & Solflare', 'Fully on-chain'].map(f => (
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

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-5 py-8">

        {/* Vault browser */}
        <section className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--gk-muted)' }}>
            Choose a GhostKid from the vault
            {selectedNFT && (
              <span className="ml-3 normal-case font-medium" style={{ color: 'var(--gk-success)' }}>
                — {selectedNFT.name} selected
              </span>
            )}
          </p>
          {connection && (
            <VaultNFTs connection={connection} onNFTSelect={setSelectedNFT} />
          )}
        </section>

        <div
          className="h-px my-10"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.2), transparent)' }}
        />

        {/* Unwrap */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--gk-muted)' }}>
            Spend $KID to receive selected NFT
          </p>
          {connection && (
            <UnwrapSection
              connection={connection}
              kidBalance={kidBalance}
              selectedNFT={selectedNFT}
              onSuccess={() => { fetchKidBalance(); setSelectedNFT(null); }}
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
