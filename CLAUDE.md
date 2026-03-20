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
- **`app/components/WrapSection.tsx`** — Coming-soon placeholder for the reverse flow (deposit NFT → receive $KID).
- **`app/api/metadata/route.ts`** — CORS proxy for Arweave metadata URLs with 24-hour in-memory cache.
- **`app/polyfills.ts`** — Injects `Buffer` globally for Solana library compatibility.
- **`lib/ghostkid-program/instructions.ts`** — Builds the Solana `withdraw` instruction. The discriminator (`f3c0e4b775d6f067`) and 22-account layout were reverse-engineered from on-chain transactions.

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

### Webpack / Browser Polyfills

`next.config.js` aliases `crypto → crypto-browserify`, `stream → stream-browserify`, and `buffer → buffer`, and disables `fs`, `net`, `tls` for browser builds. This is required for `@solana/web3.js` to work client-side.
