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

// ── Rarity helpers (single source of truth) ─────────────────────────────────

export type Rarity = 'common' | 'rare' | 'legendary';

export function rarityFromAttributes(attributes: any[]): Rarity {
  if (!attributes || attributes.length === 0) return 'common';
  const t = attributes.find(
    a => a.trait_type?.toLowerCase() === 'rarity' || a.trait_type?.toLowerCase() === 'tier'
  );
  if (t) {
    const v = t.value?.toLowerCase();
    if (v === 'legendary' || v === 'mythic') return 'legendary';
    if (v === 'rare' || v === 'epic') return 'rare';
    return 'common';
  }
  const special = attributes.filter(a => {
    const v = (a.value || '').toLowerCase();
    return v.includes('gold') || v.includes('diamond') || v.includes('legendary') || v.includes('laser');
  });
  if (special.length >= 3) return 'legendary';
  if (special.length >= 1) return 'rare';
  return 'common';
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common:    'Common',
  rare:      'Rare',
  legendary: 'Legendary',
};

export const RARITY_ICON: Record<Rarity, string> = {
  common:    '◆',
  rare:      '★',
  legendary: '◈',
};

// ── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="skeleton aspect-square" aria-hidden="true" />
  );
}

// ── Filter tab ───────────────────────────────────────────────────────────────

type Filter = 'all' | Rarity;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'common',    label: 'Common' },
  { value: 'rare',      label: 'Rare' },
  { value: 'legendary', label: 'Legendary' },
];

const FILTER_ACTIVE: Record<Filter, string> = {
  all:       'bg-gk-purple text-white shadow-gk-purple',
  common:    'bg-gk-common/20 text-blue-300 border border-gk-common/40',
  rare:      'bg-gk-rare/20 text-purple-300 border border-gk-rare/40',
  legendary: 'bg-gk-legendary/20 text-amber-300 border border-gk-legendary/40',
};

interface VaultNFTsProps {
  connection: Connection;
  onNFTSelect?: (nft: VaultNFT | null) => void;
}

export function VaultNFTs({ connection, onNFTSelect }: VaultNFTsProps) {
  const [nfts, setNfts]     = useState<VaultNFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<VaultNFT | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => { fetchVaultNFTs(); }, []);

  async function fetchVaultNFTs() {
    try {
      setLoading(true);
      setError(null);

      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        new PublicKey(VAULT_ADDRESS),
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
      );

      const total = tokenAccounts.value.length;
      setProgress({ current: 0, total });

      const result: VaultNFT[] = [];
      const BATCH = 3;
      const DELAY = 3000;
      let errors = 0;

      for (let i = 0; i < total; i += BATCH) {
        const batch = tokenAccounts.value.slice(i, i + BATCH);

        await Promise.all(batch.map(async ({ account }) => {
          const info = account.data.parsed.info;
          if (info.tokenAmount.decimals !== 0 || info.tokenAmount.uiAmount !== 1) return;

          try {
            const mint = new PublicKey(info.mint);
            const [metaPDA] = await PublicKey.findProgramAddress(
              [Buffer.from('metadata'), new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(), mint.toBuffer()],
              new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
            );
            const metaAccount = await connection.getAccountInfo(metaPDA).catch(() => null);
            if (!metaAccount) return;

            const parsed = parseMetadata(metaAccount.data);
            if (!parsed.uri) {
              result.push({ mint: info.mint, name: parsed.name || 'GhostKid NFT', image: '', rarity: 'common', attributes: [] });
              return;
            }

            const resp = await fetch(`/api/metadata?url=${encodeURIComponent(parsed.uri)}`);
            if (!resp.ok) return;
            const json = await resp.json();
            result.push({
              mint: info.mint,
              name: json.name || parsed.name || 'GhostKid NFT',
              image: json.image || '',
              rarity: rarityFromAttributes(json.attributes || []),
              attributes: json.attributes || [],
            });
          } catch { /* skip failed entries silently */ }
        }));

        setProgress({ current: Math.min(i + BATCH, total), total });
        setNfts([...result]);

        if (i + BATCH < total) {
          const backoff = Math.min(Math.pow(1.5, errors), 5);
          await new Promise(r => setTimeout(r, DELAY * backoff));
          errors = 0;
        }
      }

      setNfts(result);
    } catch (e: any) {
      setError(e.message || 'Failed to load vault');
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(nft: VaultNFT) {
    const next = selected?.mint === nft.mint ? null : nft;
    setSelected(next);
    onNFTSelect?.(next);
  }

  const displayed = filter === 'all' ? nfts : nfts.filter(n => n.rarity === filter);

  const counts = {
    common:    nfts.filter(n => n.rarity === 'common').length,
    rare:      nfts.filter(n => n.rarity === 'rare').length,
    legendary: nfts.filter(n => n.rarity === 'legendary').length,
  };

  // ── Error state ────────────────────────────────────────────────────────────
  if (error && nfts.length === 0) {
    return (
      <div className="gk-panel p-8 text-center animate-fade-up">
        <p className="text-gk-error font-semibold mb-2">Failed to load vault</p>
        <p className="text-sm text-gk-muted mb-5">{error}</p>
        <button
          onClick={fetchVaultNFTs}
          className="px-5 py-2 rounded-lg bg-gk-surface-3 hover:bg-gk-surface-2 border border-gk-border-bright text-sm font-medium transition-all"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      {/* Header row */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">

        {/* Filter tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                filter === f.value
                  ? FILTER_ACTIVE[f.value]
                  : 'bg-gk-surface-2 text-gk-muted hover:text-white hover:bg-gk-surface-3 border border-gk-border'
              }`}
            >
              {f.label}
              {f.value !== 'all' && (
                <span className="ml-1.5 opacity-60">{counts[f.value as Rarity]}</span>
              )}
              {f.value === 'all' && (
                <span className="ml-1.5 opacity-60">{nfts.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Loading progress */}
        {loading && progress.total > 0 && (
          <div className="flex items-center gap-2 text-xs text-gk-muted">
            <div className="w-24 h-1 bg-gk-surface-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-gk-purple rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <span>{progress.current}/{progress.total}</span>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {/* Real NFTs */}
        {displayed.map(nft => (
          <button
            key={nft.mint}
            onClick={() => handleSelect(nft)}
            className={`nft-card selected-${nft.rarity} ${selected?.mint === nft.mint ? `selected-${nft.rarity}` : ''}`}
            aria-label={`${nft.name} – ${RARITY_LABEL[nft.rarity]}${selected?.mint === nft.mint ? ' (selected)' : ''}`}
            aria-pressed={selected?.mint === nft.mint}
          >
            {nft.image ? (
              <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl text-gk-dim">👻</div>
            )}
            <span className={`rarity-badge ${nft.rarity}`}>
              {RARITY_ICON[nft.rarity]}
            </span>
            {selected?.mint === nft.mint && (
              <div className="absolute inset-0 bg-gk-purple/10 flex items-end justify-center pb-1.5 pointer-events-none">
                <span className="text-[10px] font-bold text-white bg-gk-purple px-2 py-0.5 rounded-full">
                  Selected
                </span>
              </div>
            )}
          </button>
        ))}

        {/* Skeleton placeholders while loading */}
        {loading && Array.from({ length: Math.max(0, 12 - displayed.length) }).map((_, i) => (
          <SkeletonCard key={`sk-${i}`} />
        ))}
      </div>

      {/* Empty state */}
      {!loading && displayed.length === 0 && (
        <div className="gk-panel p-12 text-center mt-4">
          <p className="text-4xl mb-3">👻</p>
          <p className="text-gk-muted">
            {filter === 'all'
              ? 'No NFTs in vault'
              : `No ${filter} NFTs in vault right now`}
          </p>
        </div>
      )}

      {/* Selected NFT confirmation strip */}
      {selected && (
        <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-gk-surface-2 border border-gk-border-accent animate-fade-up">
          {selected.image && (
            <img src={selected.image} alt={selected.name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{selected.name}</p>
            <p className="text-xs text-gk-muted">{selected.mint.slice(0,6)}…{selected.mint.slice(-4)}</p>
          </div>
          <span className={`rarity-pill ${selected.rarity}`}>
            {RARITY_ICON[selected.rarity]} {RARITY_LABEL[selected.rarity]}
          </span>
          <button
            onClick={() => { setSelected(null); onNFTSelect?.(null); }}
            className="text-gk-dim hover:text-gk-muted transition-colors ml-1 text-lg leading-none"
            aria-label="Deselect NFT"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

// ── Metadata parser ──────────────────────────────────────────────────────────

function parseMetadata(data: Buffer): { name: string; uri?: string } {
  try {
    let offset = 1 + 32 + 32;
    const nameLen = data.readUInt32LE(offset); offset += 4;
    const name = data.slice(offset, offset + nameLen).toString('utf8').replace(/\0/g, '');
    offset += nameLen;
    const symLen = data.readUInt32LE(offset); offset += 4 + symLen;
    const uriLen = data.readUInt32LE(offset); offset += 4;
    const uri = data.slice(offset, offset + uriLen).toString('utf8').replace(/\0/g, '');
    return { name: name || 'GhostKid NFT', uri: uri || undefined };
  } catch {
    return { name: 'GhostKid NFT' };
  }
}
