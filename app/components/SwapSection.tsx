'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, Transaction } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';
import type { VaultNFT } from './VaultNFTs';
import { rarityFromAttributes, RARITY_LABEL, RARITY_ICON, type Rarity } from './VaultNFTs';

interface UserNFT {
  mint: string;
  name: string;
  image: string;
  rarity: Rarity;
}

const COLLECTION = 'FSw4cZhK5pMmhEDenDpa3CauJ9kLt5agr2U1oQxaH2cv';

// ── NFT deal card (used in both "giving" and "receiving" slots) ──────────────

function DealSlot({
  nft,
  label,
  placeholder,
  emptyIcon,
}: {
  nft: { name: string; image: string; rarity: Rarity } | null;
  label: string;
  placeholder: string;
  emptyIcon?: string;
}) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold uppercase tracking-widest text-gk-muted mb-2">{label}</p>
      {nft ? (
        <div className="gk-panel-inner p-3 animate-fade-up">
          <div className="aspect-square w-full rounded-lg overflow-hidden bg-gk-surface mb-3">
            {nft.image ? (
              <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl">👻</div>
            )}
          </div>
          <p className="text-sm font-semibold truncate mb-1.5">{nft.name}</p>
          <span className={`rarity-pill ${nft.rarity}`}>
            {RARITY_ICON[nft.rarity]} {RARITY_LABEL[nft.rarity]}
          </span>
        </div>
      ) : (
        <div className="gk-panel-inner p-6 flex flex-col items-center justify-center gap-2 aspect-square opacity-50">
          <span className="text-3xl">{emptyIcon || '?'}</span>
          <p className="text-xs text-gk-muted text-center leading-snug">{placeholder}</p>
        </div>
      )}
    </div>
  );
}

// ── Rarity match indicator ───────────────────────────────────────────────────

function MatchIndicator({ a, b }: { a: Rarity | null; b: Rarity | null }) {
  if (!a || !b) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 px-3 pt-6">
        <span className="text-2xl text-gk-dim">⇄</span>
        <span className="text-[10px] text-gk-dim uppercase tracking-wider">Same<br/>rarity</span>
      </div>
    );
  }
  const match = a === b;
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-3 pt-6 animate-fade-up">
      {match ? (
        <>
          <span className="text-2xl text-gk-success">✓</span>
          <span className="text-[10px] text-gk-success uppercase tracking-wider font-bold text-center">
            Match
          </span>
        </>
      ) : (
        <>
          <span className="text-2xl text-gk-error">✕</span>
          <span className="text-[10px] text-gk-error uppercase tracking-wider font-bold text-center">
            Mismatch
          </span>
        </>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

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
  const [myNFT, setMyNFT]       = useState<UserNFT | null>(null);
  const [loading, setLoading]   = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);
  const [authorityReady, setAuthorityReady] = useState<boolean | null>(null);

  // Check whether the server has the authority key configured
  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(d => setAuthorityReady(d.authorityConfigured === true))
      .catch(() => setAuthorityReady(false));
  }, []);

  useEffect(() => {
    if (publicKey) fetchUserNFTs();
    else { setUserNFTs([]); setMyNFT(null); }
  }, [publicKey]);

  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [selectedVaultNFT, myNFT]);

  async function fetchUserNFTs() {
    if (!publicKey) return;
    try {
      setLoading(true);
      const rpc = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 'gk-swap', method: 'getAssetsByOwner',
          params: {
            ownerAddress: publicKey.toBase58(),
            page: 1, limit: 1000,
            displayOptions: { showFungible: false, showNativeBalance: false },
          },
        }),
      });
      const data = await res.json();
      const assets: any[] = data.result?.items || [];
      const mine = assets
        .filter((a: any) => a.grouping?.some((g: any) => g.group_key === 'collection' && g.group_value === COLLECTION))
        .map((a: any) => ({
          mint:   a.id,
          name:   a.content?.metadata?.name || `GhostKid #${a.id.slice(0,4)}`,
          image:  a.content?.links?.image || a.content?.files?.[0]?.uri || '',
          rarity: rarityFromAttributes(a.content?.metadata?.attributes || []),
        }));
      setUserNFTs(mine);
    } catch (e: any) {
      setError(e?.message || 'Failed to load your NFTs');
    } finally {
      setLoading(false);
    }
  }

  async function handleSwap() {
    if (!publicKey || !myNFT || !selectedVaultNFT || !signTransaction) return;
    if (myNFT.rarity !== selectedVaultNFT.rarity) {
      setError('Rarity mismatch — select a vault NFT of the same tier.');
      return;
    }
    try {
      setSwapping(true);
      setError(null);
      setSuccess(null);

      const res = await fetch('/api/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMintAddress:  myNFT.mint,
          vaultMintAddress: selectedVaultNFT.mint,
          userAddress:      publicKey.toBase58(),
        }),
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: 'Server error' }));
        throw new Error(e.error || `Server error ${res.status}`);
      }

      const { transaction: b64 } = await res.json();
      const tx = Transaction.from(Buffer.from(b64, 'base64'));
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: true, preflightCommitment: 'confirmed',
      });
      await connection.confirmTransaction(sig, 'confirmed');

      setSuccess(sig);
      setMyNFT(null);
      onSuccess?.();
      fetchUserNFTs();
    } catch (e: any) {
      const msg = e?.message || '';
      setError(msg.includes('rejected') ? 'Transaction rejected.' : msg || 'Swap failed.');
    } finally {
      setSwapping(false);
    }
  }

  const rarityMismatch = myNFT && selectedVaultNFT && myNFT.rarity !== selectedVaultNFT.rarity;
  const canSwap = !!myNFT && !!selectedVaultNFT && !rarityMismatch && !swapping && !!publicKey && !!authorityReady;

  // Filter user's NFTs to same rarity as vault selection for quick discovery
  const suggestedNFTs = selectedVaultNFT
    ? userNFTs.filter(n => n.rarity === selectedVaultNFT.rarity)
    : userNFTs;

  const otherNFTs = selectedVaultNFT
    ? userNFTs.filter(n => n.rarity !== selectedVaultNFT.rarity)
    : [];

  // ── Authority not configured — show maintenance banner ──────────────────
  if (authorityReady === false) {
    return (
      <div className="gk-panel p-8 text-center animate-fade-up">
        <div className="text-4xl mb-4">🔧</div>
        <h3 className="text-base font-semibold mb-2">Swap temporarily unavailable</h3>
        <p className="text-sm mb-4 max-w-sm mx-auto leading-relaxed" style={{ color: 'var(--gk-muted)' }}>
          The program authority wallet is being restored. NFT swaps will be live again shortly.
        </p>
        <a
          href="/kidpool"
          className="inline-block text-xs px-4 py-2 rounded-lg transition-colors"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'var(--gk-muted)',
          }}
        >
          Check $KID Pool status →
        </a>
      </div>
    );
  }

  // Loading status check
  if (authorityReady === null) {
    return (
      <div className="gk-panel p-8 text-center animate-fade-up">
        <div className="skeleton h-4 w-32 rounded mx-auto mb-3" />
        <div className="skeleton h-3 w-48 rounded mx-auto" />
      </div>
    );
  }

  return (
    <div className="gk-panel p-6 animate-fade-up">

      {/* ── Deal preview ──────────────────────────────────────────────────── */}
      <div className="flex items-stretch gap-2 mb-6">
        <DealSlot
          nft={myNFT}
          label="You give"
          placeholder="Select from your NFTs below"
          emptyIcon="👤"
        />
        <MatchIndicator
          a={myNFT?.rarity ?? null}
          b={selectedVaultNFT?.rarity ?? null}
        />
        <DealSlot
          nft={selectedVaultNFT}
          label="You receive"
          placeholder="Select from vault above"
          emptyIcon="🏦"
        />
      </div>

      {/* ── Swap button ───────────────────────────────────────────────────── */}
      {publicKey && (
        <button
          onClick={handleSwap}
          disabled={!canSwap}
          className={`btn-swap ${canSwap ? 'ready' : 'disabled'} mb-5`}
        >
          {swapping ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Confirming swap…
            </span>
          ) : !publicKey ? (
            'Connect wallet'
          ) : !myNFT || !selectedVaultNFT ? (
            'Select both NFTs to swap'
          ) : rarityMismatch ? (
            `Rarity mismatch — ${myNFT.rarity} ≠ ${selectedVaultNFT.rarity}`
          ) : (
            `⇄ Swap ${myNFT.name} for ${selectedVaultNFT.name}`
          )}
        </button>
      )}

      {/* ── Status messages ───────────────────────────────────────────────── */}
      {error && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-950/40 border border-red-800/50 text-sm text-red-300 animate-fade-up">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-emerald-950/40 border border-emerald-700/50 animate-fade-up">
          <p className="text-sm font-semibold text-emerald-400 mb-1">Swap confirmed!</p>
          <a
            href={`https://solscan.io/tx/${success}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-600 hover:text-emerald-400 underline underline-offset-2 transition-colors"
          >
            View on Solscan →
          </a>
        </div>
      )}

      {/* ── Your NFTs picker ──────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gk-muted mb-3">
          Your GhostKids
        </p>

        {!publicKey ? (
          <div className="gk-panel-inner p-8 text-center">
            <p className="text-gk-muted text-sm">Connect your wallet to see your GhostKids</p>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton aspect-square" aria-hidden="true" />
            ))}
          </div>
        ) : userNFTs.length === 0 ? (
          <div className="gk-panel-inner p-8 text-center">
            <p className="text-gk-muted text-sm mb-1">No GhostKids in this wallet</p>
            <p className="text-xs text-gk-dim">Make sure you're connected to the right wallet</p>
          </div>
        ) : (
          <>
            {/* Matching rarity group (prominent) */}
            {suggestedNFTs.length > 0 && (
              <div className="mb-4">
                {selectedVaultNFT && (
                  <p className="text-xs text-gk-muted mb-2">
                    Matching {selectedVaultNFT.rarity} ({suggestedNFTs.length})
                  </p>
                )}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {suggestedNFTs.map(nft => (
                    <button
                      key={nft.mint}
                      onClick={() => setMyNFT(myNFT?.mint === nft.mint ? null : nft)}
                      className={`nft-card ${myNFT?.mint === nft.mint ? `selected-${nft.rarity}` : ''}`}
                      aria-label={`${nft.name} – ${RARITY_LABEL[nft.rarity]}`}
                      aria-pressed={myNFT?.mint === nft.mint}
                    >
                      {nft.image ? (
                        <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">👻</div>
                      )}
                      <span className={`rarity-badge ${nft.rarity}`}>{RARITY_ICON[nft.rarity]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Other rarities (dimmed when vault selection active) */}
            {otherNFTs.length > 0 && (
              <div className={selectedVaultNFT ? 'opacity-35' : ''}>
                {selectedVaultNFT && (
                  <p className="text-xs text-gk-dim mb-2">Other rarities (incompatible with current selection)</p>
                )}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {otherNFTs.map(nft => (
                    <button
                      key={nft.mint}
                      onClick={() => setMyNFT(myNFT?.mint === nft.mint ? null : nft)}
                      className={`nft-card ${myNFT?.mint === nft.mint ? `selected-${nft.rarity}` : ''}`}
                      aria-label={`${nft.name} – ${RARITY_LABEL[nft.rarity]}`}
                      aria-pressed={myNFT?.mint === nft.mint}
                    >
                      {nft.image ? (
                        <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">👻</div>
                      )}
                      <span className={`rarity-badge ${nft.rarity}`}>{RARITY_ICON[nft.rarity]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
