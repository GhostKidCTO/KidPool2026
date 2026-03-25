# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm start        # Start production server
```

No lint or test scripts are configured.

Set `NEXT_PUBLIC_RPC_ENDPOINT` env var to override the default Solana RPC endpoint.

## App Structure

This is a Next.js 14 (App Router) dApp for **GhostKid NFT-for-NFT swapping** on Solana.

### Pages

- **`/` (`app/page.tsx`)** — NFT swap only. Two-step flow: browse vault (VaultNFTs) → pick your NFT and confirm (SwapSection). No $KID required.
- **`/kidpool` (`app/kidpool/page.tsx`)** — Coming-soon screen. Full Wrap/Unwrap $KID ↔ NFT code is preserved in commented-out blocks for future use.

### Core Components

- **`app/components/VaultNFTs.tsx`** — Browses NFTs held in the program vault. Skeleton loading, rarity filter tabs, deselectable cards with colored rings. Exports `VaultNFT`, `Rarity`, `rarityFromAttributes`, `RARITY_LABEL`, `RARITY_ICON` (single source of truth for rarity).
- **`app/components/SwapSection.tsx`** — NFT-for-NFT swap: deal preview (You give ⇄ You receive), rarity match indicator, user's NFT picker with matching rarity surfaced first. Posts to `/api/swap`.
- **`app/components/WrapSection.tsx`** — Wrap flow (NFT → $KID). Preserved, used only on `/kidpool`. Calls `/api/wrap`.
- **`app/components/UnwrapSection.tsx`** — Unwrap flow ($KID → NFT). Preserved, used only on `/kidpool`. Builds transaction client-side (authority not required as signer).
- **`app/api/swap/route.ts`** — Builds atomic deposit_nfts + withdraw_nfts transaction. Authority pre-signs server-side. **Blocked until `AUTHORITY_PRIVATE_KEY` is set.**
- **`app/api/wrap/route.ts`** — Builds deposit_nfts transaction. Same blocker.
- **`app/api/metadata/route.ts`** — CORS proxy for Arweave metadata URLs with 24-hour in-memory cache.
- **`app/polyfills.ts`** — Injects `Buffer` globally for Solana library compatibility.
- **`lib/ghostkid-program/instructions.ts`** — Builds `withdraw_nfts` and `deposit_nfts` instructions with correct account layouts.

### Key On-Chain Addresses

| Name | Address |
|------|---------|
| Program | `4BTy6FpUakBpNNTJFF6V7BK4fKR2bds6Sh523Z3gxy4k` |
| $KID Mint | `4peG5vF6VXbUt8PPA5LDbtdeRAPBGGrspDMW3ot6TdeX` |
| Vault | `JCSbaLqdn6nKtTVTUjAaxsv28TBhmpypcY3VAqdGKWLA` |
| Vault Token Account | `6koxtKZV3LxSrS8dMpkMj1xLmSzMSTrRY1KCTsXTPvCC` |
| Collection | `FSw4cZhK5pMmhEDenDpa3CauJ9kLt5agr2U1oQxaH2cv` |
| Authority | `qgDDcomgjASwB27LaxMFXyzhpuzvRpkCSzbdDJcoEks` |
| Metaplex Ruleset | `eBJLFYPxJmMGKuFwpDWkzxZeUrad92kZRC5BJLpzyT9` |

### Transaction Flow (NFT Swap)

1. User selects a vault NFT (VaultNFTs component, step 1).
2. User selects one of their own NFTs with matching rarity (SwapSection, step 2).
3. Client POSTs `{userMintAddress, vaultMintAddress, userAddress}` to `/api/swap`.
4. Server builds two-instruction transaction: `deposit_nfts` (user NFT → vault) + `withdraw_nfts` (vault NFT → user). Net $KID = 0.
5. Server pre-signs with authority keypair, returns base64 transaction.
6. Client deserializes, user signs with wallet, broadcasts.

### THE BLOCKER — Authority Signer Requirement

**`deposit_nfts` requires the authority keypair (`qgDDcomgjASwB27LaxMFXyzhpuzvRpkCSzbdDJcoEks`) as a signer.** This is enforced at the Solana VM level — the runtime verifies `authority.is_signer` before executing. There is no client-side bypass.

- **`withdraw_nfts`**: authority account #3 is `isSigner: false` — works without the key ✅
- **`deposit_nfts`**: authority account #3 is `isSigner: true` — requires the key ❌

**Confirmed via:** IDL (`gkd_program_idl.json`), auto-generated Codama client (`depositNfts.ts`), and binary RE.

**Bypass investigation result:** Fully confirmed impossible. No workaround exists at the instruction level.

**To unblock:** Set `AUTHORITY_PRIVATE_KEY` in `.env.local` to the base58-encoded private key of `qgDDcomgjASwB27LaxMFXyzhpuzvRpkCSzbdDJcoEks`.

```
AUTHORITY_PRIVATE_KEY=<base58 private key>
NEXT_PUBLIC_RPC_ENDPOINT=https://mainnet.helius-rpc.com/?api-key=<key>
```

**Alternative if key is unrecoverable:** Float wallet approach — server-controlled wallet holds $KID reserve, uses `withdraw_nfts` to pull vault NFT → server → user via Metaplex transfer, user sends NFT to server wallet → admin batch-deposits later. Custodial, non-atomic, requires trust. Implement only as last resort.

### RE Session — Program Binary Analysis

**Source author:** Built by `/Users/dmitri/work/git/platform-tools/...` (original dev's Mac path embedded in binary).

**All 4 instructions:**

| Instruction | Discriminator | Authority signer? |
|-------------|--------------|-------------------|
| `initialize_vault` | `30bfa32c47813fa4` | yes (admin only) |
| `withdraw_from_vault` | `b422252e9c00d3ee` | yes (admin only) |
| `deposit_nfts` | `a1353b929459d5ca` | **yes — BLOCKER** |
| `withdraw_nfts` | `f3c0e4b775d6f067` | no ✅ |

**IDL source:** `KidPool-main/lib/ghostkid-program/clients/gkd_program_idl.json` — full program IDL with all account layouts.

**Deposit account order (21 accounts, confirmed from IDL):**
```
#0  nft_receipt          PDA: ["nft_receipt", mint]           writable
#1  vault                JCSbaLqdn6nKtTVTUjAaxsv28TBhmpypcY3VAqdGKWLA  writable
#2  vault_token_account  6koxtKZV3LxSrS8dMpkMj1xLmSzMSTrRY1KCTsXTPvCC  writable
#3  authority            qgDDcomgjASwB27LaxMFXyzhpuzvRpkCSzbdDJcoEks  writable SIGNER
#4  depositor            user wallet                          writable signer
#5  nft_token_account    user NFT ATA                         writable
#6  depositor_token_acct user $KID ATA                        writable
#7  mint                 NFT mint                             readonly
#8  token                vault NFT ATA                        writable
#9  record               PDA: metaplex token record (user)    writable
#10 destination_record   PDA: metaplex token record (vault)   writable
#11 edition              PDA: metaplex edition                writable
#12 metadata             PDA: metaplex metadata               writable
#13 token_mint           $KID mint                            readonly
#14 metaplex_ruleset     eBJLFYPxJmMGKuFwpDWkzxZeUrad92kZRC5BJLpzyT9  readonly
#15 metadata_program     metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s  readonly
#16 associated_token_program  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe8bv  readonly
#17 token_program        TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA  readonly
#18 system_program       11111111111111111111111111111111             readonly
#19 sysvar_instructions  Sysvar1nstructions1111111111111111111111111  readonly
#20 authorization_rules_program  auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg  readonly
```

**Instruction data:** `a1353b929459d5ca01` (discriminator + `0x01` u8 arg)

**Key reference transactions:**
- `4UzocBCH3tK8sVVD5XQ6JQeGN4MQEuRkkX78McunBserVMJGsWNCX9Mp9Qddz7119RwCiHnESqpp1M5bCaJ1tTTV` — withdraw reference
- `5oV7kLDoEVoppfoPM6x54ynDAPMu7ryVJmEDapTyfu3NKBQQ83txxhhaKox1Nofd4VT4AmH8FKHfa6fQ9QgJ8u34` — deposit reference

### Design System

`app/globals.css` defines:
- CSS custom properties: `--gk-bg`, `--gk-surface`, `--gk-surface-2/3`, `--gk-border*`, `--gk-purple*`, `--gk-common/rare/legendary`, `--gk-success/error/text/muted/dim`
- Full wallet adapter override (gradient purple button, dark glass modal, styled wallet rows)
- `.nft-card` + `.selected-common/rare/legendary` (rarity-colored selection rings, legendary glow animation)
- `.skeleton` shimmer, `.rarity-badge` (card overlay), `.rarity-pill` (inline)
- `.step-dot.pending/active/complete`, `.gk-panel`, `.gk-panel-inner`, `.btn-swap.ready/disabled`

`tailwind.config.ts` extends with `colors.gk.*` matching the CSS variables above.

### Webpack / Browser Polyfills

`next.config.js` aliases `crypto → crypto-browserify`, `stream → stream-browserify`, and `buffer → buffer`, and disables `fs`, `net`, `tls` for browser builds. Required for `@solana/web3.js` client-side.
