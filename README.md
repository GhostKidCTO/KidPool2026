# GhostKid $KID Pool

Spend $KID tokens to claim a GhostKid NFT from the vault — fully on-chain, no intermediaries.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Solana](https://img.shields.io/badge/Solana-Mainnet-purple)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)

---

## How It Works

1. Browse the vault — see every GhostKid NFT available with rarity filters (Common / Rare / Legendary)
2. Select the NFT you want
3. Click **Unwrap** — your wallet prompts you to approve
4. $KID is transferred to the vault; the NFT lands in your wallet

No server required. No authority key. The transaction is built entirely client-side and signed in your wallet.

---

## $KID Cost by Rarity

| Tier | $KID Required |
|------|--------------|
| Common | 10,000 |
| Rare | 15,000 |
| Legendary | 25,000 |

These amounts are enforced on-chain by the program — the UI checks your balance as a pre-flight only.

---

## Quick Start

### Prerequisites

- Node.js 18+
- Phantom or Solflare wallet extension
- $KID tokens in your wallet
- A Helius RPC endpoint (recommended — public RPC is heavily rate-limited)

### Install

```bash
git clone https://github.com/GhostKidCTO/KidPool2026.git
cd KidPool2026
npm install
```

### Configure

Create `.env.local`:

```env
NEXT_PUBLIC_RPC_ENDPOINT=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
```

The public Solana RPC works but will hit rate limits under load. A free Helius key is recommended.

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
├── page.tsx                    # Root — wallet providers, $KID balance, layout
├── polyfills.ts                # Buffer global for Solana libs
├── components/
│   ├── VaultNFTs.tsx           # Vault NFT browser with rarity filter + progressive load
│   └── UnwrapSection.tsx       # $KID → NFT transaction (fully client-side, no server)
└── api/
    └── metadata/route.ts       # CORS proxy for Arweave metadata (24h cache)

lib/
└── ghostkid-program/
    └── instructions.ts         # withdraw_nfts instruction builder + PDA helpers
```

---

## On-Chain Addresses

| Name | Address |
|------|---------|
| Program | `4BTy6FpUakBpNNTJFF6V7BK4fKR2bds6Sh523Z3gxy4k` |
| $KID Mint | `4peG5vF6VXbUt8PPA5LDbtdeRAPBGGrspDMW3ot6TdeX` |
| Vault | `JCSbaLqdn6nKtTVTUjAaxsv28TBhmpypcY3VAqdGKWLA` |
| Vault Token Account | `6koxtKZV3LxSrS8dMpkMj1xLmSzMSTrRY1KCTsXTPvCC` |
| Authority | `qgDDcomgjASwB27LaxMFXyzhpuzvRpkCSzbdDJcoEks` |
| Metaplex Ruleset | `eBJLFYPxJmMGKuFwpDWkzxZeUrad92kZRC5BJLpzyT9` |

---

## Transaction Flow (Unwrap)

1. `UnwrapSection` verifies the NFT receipt PDA exists for the selected mint
2. If the user's NFT token account doesn't exist, a separate ATA creation tx is sent first (confirmed before proceeding)
3. Builds the `withdraw_nfts` instruction with all 21 accounts client-side
4. Simulates the transaction (inconclusive simulations still proceed — on-chain program validates)
5. User signs in wallet; $KID is debited, NFT is transferred to user

The `withdraw_nfts` instruction does **not** require the program authority as a signer. The entire flow works without any server-side keypair.

---

## Troubleshooting

**Rate limit (429) errors**
Set `NEXT_PUBLIC_RPC_ENDPOINT` to a Helius or other dedicated RPC. The public endpoint allows only a few requests/sec.

**"NFT Receipt account does not exist"**
The selected NFT was not deposited through this program, or the deposit failed. Check the mint on Solscan.

**"Insufficient $KID balance"**
Your wallet doesn't hold enough $KID for the selected rarity tier. Get $KID on a DEX before unwrapping.

**Transaction simulation inconclusive**
The app proceeds to wallet anyway. If the on-chain tx also fails, check logs on Solscan for the specific program error code.

---

## Security

- Private keys never leave the wallet extension
- No authority keypair required — `withdraw_nfts` is signer-free on the authority account
- Transaction simulation runs before any wallet prompt
- `NEXT_PUBLIC_RPC_ENDPOINT` is the only env var needed; no server secrets

---

## Links

- [Vault on Solscan](https://solscan.io/account/JCSbaLqdn6nKtTVTUjAaxsv28TBhmpypcY3VAqdGKWLA)
- [$KID Token on Solscan](https://solscan.io/token/4peG5vF6VXbUt8PPA5LDbtdeRAPBGGrspDMW3ot6TdeX)
- [Program on Solscan](https://solscan.io/account/4BTy6FpUakBpNNTJFF6V7BK4fKR2bds6Sh523Z3gxy4k)
