# GhostKid SPL-404 Swap UI

A dApp for swapping between GhostKid NFTs and $KID tokens on Solana using the SPL-404 hybrid token standard. Supports three swap modes: token-for-NFT (unwrap), NFT-for-token (wrap), and NFT-for-NFT (same-rarity swap).

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Solana](https://img.shields.io/badge/Solana-Mainnet-purple)

---

## Features

| Mode | Flow | Cost |
|------|------|------|
| **Unwrap** | $KID tokens → GhostKid NFT from vault | 10k / 15k / 25k $KID by rarity |
| **Wrap** | Your GhostKid NFT → $KID tokens | Receive 10k / 15k / 25k $KID |
| **Swap** | Your GhostKid NFT ↔ Vault GhostKid NFT | No $KID required — same rarity only |

- Vault browser with rarity filtering (Common / Rare / Legendary)
- Progressive NFT loading with rate-limit backoff
- Transaction simulation before wallet prompt
- Phantom and Solflare wallet support

---

## Rarity Pricing

| Tier | $KID Value |
|------|-----------|
| Common | 10,000 |
| Rare | 15,000 |
| Legendary | 25,000 |

---

## Quick Start

### Prerequisites

- Node.js 18+
- A Solana wallet browser extension (Phantom or Solflare)
- A Helius RPC endpoint (free tier works; public RPC is heavily rate-limited)

### Install

```bash
git clone https://github.com/GhostKidCTO/KidPool2026.git
cd KidPool2026
npm install
```

### Configure

```bash
cp .env.example .env.local   # or create .env.local manually
```

`.env.local` variables:

```env
# Required — Helius recommended (free at helius.dev), public RPC works but is rate-limited
NEXT_PUBLIC_RPC_ENDPOINT=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY

# Required for Wrap and Swap — server-side authority keypair (base58 or JSON uint8 array)
# The authority must match: qgDDcomgjASwB27LaxMFXyzhpuzvRpkCSzbdDJcoEks
AUTHORITY_PRIVATE_KEY=
```

> **Note:** `AUTHORITY_PRIVATE_KEY` is required for Wrap and NFT Swap. It is used server-side only and never exposed to the browser. Unwrap works without it.

### Run

```bash
npm run dev      # http://localhost:3000
npm run build    # production build
npm start        # serve production build
```

---

## Project Structure

```
app/
├── page.tsx                    # Root — wallet providers, balance fetch, layout
├── polyfills.ts                # Buffer global for Solana libs
├── components/
│   ├── VaultNFTs.tsx           # Vault NFT browser with rarity filter + progressive load
│   ├── UnwrapSection.tsx       # Unwrap: $KID → NFT (client-built tx)
│   ├── WrapSection.tsx         # Wrap: NFT → $KID (server pre-signed tx)
│   └── SwapSection.tsx         # Swap: NFT ↔ NFT same-rarity (server pre-signed tx)
└── api/
    ├── metadata/route.ts       # CORS proxy for Arweave metadata (24h cache)
    ├── wrap/route.ts           # Builds deposit tx, authority pre-signs
    └── swap/route.ts           # Builds deposit+withdraw tx, authority pre-signs

lib/
└── ghostkid-program/
    └── instructions.ts         # Instruction builders + PDA helpers (RE'd from on-chain binary)
```

---

## On-Chain Addresses

| Name | Address |
|------|---------|
| Program | `4BTy6FpUakBpNNTJFF6V7BK4fKR2bds6Sh523Z3gxy4k` |
| $KID Mint | `4peG5vF6VXbUt8PPA5LDbtdeRAPBGGrspDMW3ot6TdeX` |
| Vault | `JCSbaLqdn6nKtTVTUjAaxsv28TBhmpypcY3VAqdGKWLA` |
| Vault Token Account | `6koxtKZV3LxSrS8dMpkMj1xLmSzMSTrRY1KCTsXTPvCC` |
| Collection | `FSw4cZhK5pMmhEDenDpa3CauJ9kLt5agr2U1oQxaH2cv` |
| Authority | `qgDDcomgjASwB27LaxMFXyzhpuzvRpkCSzbdDJcoEks` |
| Metaplex Ruleset | `eBJLFYPxJmMGKuFwpDWkzxZeUrad92kZRC5BJLpzyT9` |

---

## Transaction Flows

### Unwrap ($KID → NFT)
1. User selects a vault NFT in the browser
2. `UnwrapSection` verifies the NFT receipt PDA exists
3. Creates the user's NFT ATA in a separate confirmed tx if needed
4. Builds the `withdraw_nfts` instruction (22 accounts) client-side
5. Simulates, then prompts wallet to sign
6. $KID debited from user; NFT transferred to user

### Wrap (NFT → $KID)
1. User selects one of their GhostKids (fetched via Helius `getAssetsByOwner`)
2. Client POSTs `{mintAddress, depositorAddress}` to `/api/wrap`
3. Server derives PDAs, optionally creates the vault's NFT ATA, builds `deposit_nfts`, authority pre-signs, returns base64 tx
4. User co-signs in wallet and broadcasts
5. NFT moves to vault; $KID credited to user

### NFT Swap (NFT ↔ Vault NFT — same rarity only)
1. User selects a vault NFT (same rarity filter enforced in UI)
2. User selects one of their GhostKids of the same rarity tier
3. Client POSTs `{userMintAddress, vaultMintAddress, userAddress}` to `/api/swap`
4. Server builds a single atomic transaction: `deposit_nfts` (user NFT → vault) followed by `withdraw_nfts` (vault NFT → user). The $KID credited by the deposit cancels the $KID debited by the withdraw — net zero
5. Authority pre-signs (required for deposit), user co-signs and broadcasts
6. NFTs are exchanged; $KID balance unchanged

---

## Troubleshooting

**Rate limit (429) errors**
Set `NEXT_PUBLIC_RPC_ENDPOINT` to a Helius or other paid RPC. Public mainnet RPC allows only a few requests/sec.

**Wrap / Swap returns 503 "Authority key not configured"**
`AUTHORITY_PRIVATE_KEY` is not set in `.env.local`. The authority keypair must correspond to `qgDDcomgjASwB27LaxMFXyzhpuzvRpkCSzbdDJcoEks`.

**"NFT Receipt account does not exist"**
The NFT may not have been deposited through this program, or the deposit failed. Check the mint on Solscan.

**"Transaction simulation failed" / simulation inconclusive**
The app proceeds to wallet anyway — the on-chain program performs final validation. If the on-chain tx also fails, check the logs on Solscan for the specific program error.

**Wallet not connecting**
Clear browser cache, ensure the extension is unlocked, and reload. Both Phantom and Solflare are supported.

---

## Security

- Private keys never leave the wallet extension — all signing happens in-browser
- `AUTHORITY_PRIVATE_KEY` is a server-only env var, never bundled into client JS
- Transaction simulation runs before any wallet prompt (unwrap path)
- Rarity match is enforced both client-side (UI) and is implicitly enforced on-chain by equal $KID debit/credit amounts

---

## Links

- [Vault on Solscan](https://solscan.io/account/JCSbaLqdn6nKtTVTUjAaxsv28TBhmpypcY3VAqdGKWLA)
- [$KID Token on Solscan](https://solscan.io/token/4peG5vF6VXbUt8PPA5LDbtdeRAPBGGrspDMW3ot6TdeX)
- [Program on Solscan](https://solscan.io/account/4BTy6FpUakBpNNTJFF6V7BK4fKR2bds6Sh523Z3gxy4k)
