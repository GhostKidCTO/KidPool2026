# GhostKid SPL-404 Swap UI

A secure, user-friendly interface for swapping between GhostKid NFTs and $KID tokens using the SPL-404 hybrid token standard on Solana.

![Security](https://img.shields.io/badge/security-audited-green)
![Next.js](https://img.shields.io/badge/Next.js-14.2.35-black)
![React](https://img.shields.io/badge/React-18.3.1-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)

## Features

### 🔄 Bi-Directional Swapping
- **Unwrap**: Exchange $KID tokens for GhostKid NFTs from the vault
- **Wrap**: Deposit GhostKid NFTs to receive $KID tokens (coming soon)

### 🎨 NFT Management
- View all GhostKid NFTs in the vault with images and rarity
- Browse your owned GhostKid NFTs
- Filter by rarity: Common, Rare, Legendary
- Real-time rarity-based pricing

### 💰 Rarity-Based Pricing
- **Common**: 10,000 $KID
- **Rare**: 15,000 $KID
- **Legendary**: 25,000 $KID

### 🔐 Security Features
- **Zero-Trust Architecture**: Private keys never leave your wallet
- **Transaction Simulation**: Verify transactions before signing
- **Encrypted Communication**: All RPC traffic over HTTPS
- **Wallet Integration**: Phantom, Solflare, and more
- **Security Audited**: All critical CVEs patched (see SECURITY_AUDIT.md)

## Getting Started

### Prerequisites
- Node.js 18.x or higher
- npm or yarn
- A Solana wallet (Phantom, Solflare, etc.)
- **RPC Endpoint** (free from Helius, Alchemy, or QuickNode)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/Swap2NFT.git
cd Swap2NFT

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
```

### Configure RPC Endpoint (Required)

The public Solana RPC is rate-limited. Get a **free** endpoint:

**Helius (Recommended - 100k requests/day free)**
1. Visit https://www.helius.dev/
2. Sign up for free account
3. Create API key
4. Copy your endpoint

**Other Options:**
- Alchemy: https://www.alchemy.com/solana
- QuickNode: https://www.quicknode.com/

Add to `.env.local`:
```bash
NEXT_PUBLIC_RPC_ENDPOINT=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY
```

### Run the App

```bash
# Development
npm run dev

# Production build
npm run build
npm start
```

Visit [http://localhost:3000](http://localhost:3000)

## Project Structure

```
Swap2NFT/
├── app/
│   ├── components/
│   │   ├── VaultNFTs.tsx       # Vault NFT browser with rarity filtering
│   │   ├── UnwrapSection.tsx   # $KID → NFT swapping
│   │   └── WrapSection.tsx     # NFT → $KID swapping
│   ├── api/
│   │   └── metadata/
│   │       └── route.ts        # Metadata proxy (CORS fix)
│   ├── page.tsx                # Main app page
│   └── layout.tsx              # App layout and providers
├── lib/
│   └── ghostkid-program/
│       └── instructions.ts     # Program instruction builders
├── SECURITY_AUDIT.md           # Comprehensive security audit
└── package.json
```

## Smart Contract Integration

### GhostKid Program
- **Program ID**: `4BTy6FpUakBpNNTJFF6V7BK4fKR2bds6Sh523Z3gxy4k`
- **Network**: Solana Mainnet
- **Standard**: SPL-404 (Hybrid NFT/Fungible)

### Key Addresses
- **$KID Token**: `4peG5vF6VXbUt8PPA5LDbtdeRAPBGGrspDMW3ot6TdeX`
- **Vault**: `JCSbaLqdn6nKtTVTUjAaxsv28TBhmpypcY3VAqdGKWLA`
- **Collection**: `FSw4cZhK5pMmhEDenDpa3CauJ9kLt5agr2U1oQxaH2cv`
- **Vault Token Account**: `6koxtKZV3LxSrS8dMpkMj1xLmSzMSTrRY1KCTsXTPvCC`
- **Authority**: `qgDDcomgjASwB27LaxMFXyzhpuzvRpkCSzbdDJcoEks`
- **Metaplex Ruleset**: `eBJLFYPxJmMGKuFwpDWkzxZeUrad92kZRC5BJLpzyT9`

## Security

### Audited & Secure
✅ All critical CVEs patched
✅ React2Shell vulnerabilities verified clean
✅ Next.js authorization bypass fixed
✅ Zero-trust key management

See [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) for full audit report.

### Security Best Practices
1. **Never share your private keys**
2. **Always review transactions** in your wallet before signing
3. **Use a hardware wallet** for large amounts
4. **Verify contract addresses** before transacting
5. **Start with small amounts** when testing

## Development

### Key Technologies
- **Framework**: Next.js 14.2.35 (App Router)
- **Blockchain**: Solana Web3.js v1.95
- **Wallet**: Solana Wallet Adapter
- **Styling**: Tailwind CSS
- **Language**: TypeScript 5.x

### Rate Limiting
The app implements conservative rate limiting to avoid RPC 429 errors:
- Batch size: 3 NFTs per request
- Delay: 3 seconds between batches
- Exponential backoff on errors

For production, use a paid RPC endpoint for better performance.

## Troubleshooting

### Common Issues

**"Rate limit exceeded (429)"**
- Set `NEXT_PUBLIC_RPC_ENDPOINT` to a paid RPC provider
- Reduce batch size in VaultNFTs.tsx if needed

**"Transaction simulation failed"**
- Ensure you have enough SOL for transaction fees (~0.001 SOL)
- Verify your wallet is connected
- Check that you have sufficient $KID tokens (for unwrap)

**"NFT not found in vault"**
- Refresh the page to reload NFTs
- Verify the NFT is actually deposited in the vault
- Check Solscan for vault contents

**Wallet Connection Issues**
- Clear browser cache and reload
- Check browser console (F12) for errors
- Ensure wallet extension is installed and unlocked

## Transaction Flow

### Unwrap ($KID → NFT)
1. User selects NFT from vault
2. UI builds transaction with:
   - Create ATA for NFT (if needed)
   - Withdraw instruction with correct accounts
3. Transaction simulated (no keys exposed)
4. User reviews in wallet and signs
5. NFT transferred to user, $KID transferred to vault

### Wrap (NFT → $KID) - Coming Soon
1. User selects owned GhostKid NFT
2. UI builds deposit transaction
3. NFT transferred to vault
4. $KID tokens minted to user based on rarity

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details

## Disclaimer

This software is provided "as is" without warranty. Use at your own risk. Always verify transactions before signing.

## Links

- **Solscan (Vault)**: [View Vault](https://solscan.io/account/JCSbaLqdn6nKtTVTUjAaxsv28TBhmpypcY3VAqdGKWLA)
- **Solscan ($KID Token)**: [View Token](https://solscan.io/token/4peG5vF6VXbUt8PPA5LDbtdeRAPBGGrspDMW3ot6TdeX)

---

**Built with ❤️ for the GhostKid community**
