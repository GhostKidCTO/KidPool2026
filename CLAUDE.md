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

## Architecture

This is a Next.js 14 (App Router) dApp for swapping between GhostKid NFTs and $KID tokens on Solana using the SPL-404 hybrid token standard.

### Core Components

- **`app/page.tsx`** — Root page: initializes wallet adapters (Phantom, Solflare), fetches user's $KID balance on-chain, renders the main layout.
- **`app/components/VaultNFTs.tsx`** — Browses NFTs held in the program vault. Fetches metadata from Arweave via the local CORS proxy (`/api/metadata`). Applies rarity-based filtering (Common/Rare/Legendary) and price tiers (10k/15k/25k $KID).
- **`app/components/UnwrapSection.tsx`** — The primary swap flow: user selects a vault NFT, the component derives all PDAs, builds a 22-account withdraw instruction, simulates it, then prompts the user's wallet to sign. $KID tokens are debited; the NFT is transferred to the user.
- **`app/components/WrapSection.tsx`** — Wrap flow (deposit NFT → receive $KID). Calls `/api/wrap` which builds the transaction server-side and pre-signs with the authority keypair. User adds their signature and broadcasts.
- **`app/api/metadata/route.ts`** — CORS proxy for Arweave metadata URLs with 24-hour in-memory cache.
- **`app/polyfills.ts`** — Injects `Buffer` globally for Solana library compatibility.
- **`lib/ghostkid-program/instructions.ts`** — Builds both `withdraw_nfts` and `deposit_nfts` instructions. Discriminators and 22-account layouts reverse-engineered from on-chain transactions and the program binary (`/tmp/ghostkid.so`).
- **`app/api/wrap/route.ts`** — Server route that builds the deposit transaction, pre-signs with the authority keypair (`AUTHORITY_PRIVATE_KEY` env var), and returns base64 tx for the client to co-sign.

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

### Transaction Flow (Unwrap)

1. User selects an NFT from the vault display.
2. `UnwrapSection` creates an ATA for the NFT if needed.
3. Builds the withdraw instruction with 22 accounts and PDAs (NFT Receipt, Token Record, Metadata, Edition).
4. Simulates the transaction (no key exposure).
5. User signs in their wallet extension; $KID is debited from user, NFT is transferred to user.

### Transaction Flow (Wrap / Deposit)

1. User selects a GhostKid NFT they own (fetched via Helius DAS `getAssetsByOwner`).
2. `WrapSection` POSTs `{mintAddress, depositorAddress}` to `/api/wrap`.
3. Server derives all PDAs, optionally creates vault NFT ATA, builds the `deposit_nfts` instruction, pre-signs with the authority keypair, returns base64 tx.
4. Client deserializes transaction, user signs in wallet, broadcasts with `skipPreflight: true`.
5. $KID tokens are sent to user; NFT moves into the vault.

**Current blocker:** `AUTHORITY_PRIVATE_KEY` in `.env.local` is empty. Old program wallet is compromised — authority keypair must be re-derived or replaced (see RE Session below).

### RE Session — Program Binary Analysis (`/tmp/ghostkid.so`)

The on-chain program binary was dumped and analyzed. Key findings:

**All 4 instructions (confirmed via Anchor discriminator formula `sha256("global:<name>")[0:8]`):**

| Instruction | Discriminator | Status |
|-------------|--------------|--------|
| `initialize_vault` | `30bfa32c47813fa4` | admin only |
| `withdraw_from_vault` | `b422252e9c00d3ee` | admin only |
| `deposit_nfts` | `a1353b929459d5ca` | ✅ implemented |
| `withdraw_nfts` | `f3c0e4b775d6f067` | ✅ implemented |

**Deposit (`deposit_nfts`) account order (21 accounts):**
```
#0  nft_receipt          PDA: ["nft_receipt", mint]           writable
#1  vault                JCSbaLqdn6nKtTVTUjAaxsv28TBhmpypcY3VAqdGKWLA  writable
#2  vault_token_account  6koxtKZV3LxSrS8dMpkMj1xLmSzMSTrRY1KCTsXTPvCC  writable
#3  authority            qgDDcomgjASwB27LaxMFXyzhpuzvRpkCSzbdDJcoEks  writable (signer)
#4  depositor            user wallet                          writable signer
#5  depositor_token_acct user $KID ATA                       writable
#6  source_nft_token     user NFT ATA                        writable
#7  mint                 NFT mint                            readonly
#8  destination_nft      vault NFT ATA                       writable
#9  source_token_record  PDA: metaplex token record (user)   writable
#10 dest_token_record    PDA: metaplex token record (vault)  writable
#11 edition              PDA: metaplex edition               writable
#12 metadata             PDA: metaplex metadata              writable
#13 token_mint           $KID mint                           readonly
#14 metaplex_ruleset     eBJLFYPxJmMGKuFwpDWkzxZeUrad92kZRC5BJLpzyT9  readonly
#15 metadata_program     metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s  readonly
#16 assoc_token_program  ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe8bv  readonly
#17 token_program        TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA  readonly
#18 system_program       11111111111111111111111111111111            readonly
#19 sysvar_instructions  Sysvar1nstructions1111111111111111111111111  readonly
#20 auth_rules_program   auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg  readonly
```

**Instruction data:** `a1353b929459d5ca01` (discriminator + `0x01` boolean arg)

**Source paths in binary:**
- `programs/hybrid-nft-program/src/instructions/deposit_nfts.rs`
- `programs/hybrid-nft-program/src/instructions/withdraw_nfts.rs`  (wait: `withdraw_from_vault.rs` also exists)
- `programs/hybrid-nft-program/src/state/vault.rs` — `Vault` struct
- `programs/hybrid-nft-program/src/state/nft_receipt.rs` — `NftReceipt` struct
- Built by: `/Users/dmitri/work/git/platform-tools/...` (original dev's Mac path)

**Key on-chain transactions for RE:**
- `4UzocBCH3tK8sVVD5XQ6JQeGN4MQEuRkkX78McunBserVMJGsWNCX9Mp9Qddz7119RwCiHnESqpp1M5bCaJ1tTTV` — withdraw reference
- `5oV7kLDoEVoppfoPM6x54ynDAPMu7ryVJmEDapTyfu3NKBQQ83txxhhaKox1Nofd4VT4AmH8FKHfa6fQ9QgJ8u34` — deposit reference

### Webpack / Browser Polyfills

`next.config.js` aliases `crypto → crypto-browserify`, `stream → stream-browserify`, and `buffer → buffer`, and disables `fs`, `net`, `tls` for browser builds. This is required for `@solana/web3.js` to work client-side.
