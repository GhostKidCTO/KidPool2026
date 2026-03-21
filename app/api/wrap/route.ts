import { NextRequest, NextResponse } from 'next/server';
import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import bs58 from 'bs58';
import {
  getDepositNftsInstruction,
  getNftReceiptPDA,
  getTokenRecordPDA,
  getMetadataPDA,
  getEditionPDA,
} from '@/lib/ghostkid-program/instructions';

const ADDRESSES = {
  kidsTokenMint: new PublicKey('4peG5vF6VXbUt8PPA5LDbtdeRAPBGGrspDMW3ot6TdeX'),
  ghostKidVault: new PublicKey('JCSbaLqdn6nKtTVTUjAaxsv28TBhmpypcY3VAqdGKWLA'),
  ghostKidVaultTokenAccount: new PublicKey('6koxtKZV3LxSrS8dMpkMj1xLmSzMSTrRY1KCTsXTPvCC'),
  ghostKidAuthority: new PublicKey('qgDDcomgjASwB27LaxMFXyzhpuzvRpkCSzbdDJcoEks'),
  metaplexTokenMetadataProgram: new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'),
  metaplexRuleset: new PublicKey('eBJLFYPxJmMGKuFwpDWkzxZeUrad92kZRC5BJLpzyT9'),
};

export async function POST(request: NextRequest) {
  try {
    const { mintAddress, depositorAddress } = await request.json();

    if (!mintAddress || !depositorAddress) {
      return NextResponse.json({ error: 'Missing mintAddress or depositorAddress' }, { status: 400 });
    }

    // Load authority keypair from environment (NEVER expose to client)
    const authorityKeyRaw = process.env.AUTHORITY_PRIVATE_KEY;
    if (!authorityKeyRaw) {
      return NextResponse.json({ error: 'Authority key not configured' }, { status: 503 });
    }

    let authorityKeypair: Keypair;
    try {
      // Support both base58 string and JSON uint8array formats
      if (authorityKeyRaw.startsWith('[')) {
        const bytes = JSON.parse(authorityKeyRaw) as number[];
        authorityKeypair = Keypair.fromSecretKey(Uint8Array.from(bytes));
      } else {
        authorityKeypair = Keypair.fromSecretKey(bs58.decode(authorityKeyRaw));
      }
    } catch {
      return NextResponse.json({ error: 'Invalid authority key format' }, { status: 503 });
    }

    // Verify the authority matches the expected address
    if (authorityKeypair.publicKey.toBase58() !== ADDRESSES.ghostKidAuthority.toBase58()) {
      return NextResponse.json({ error: 'Authority key mismatch' }, { status: 503 });
    }

    const rpcEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcEndpoint, 'confirmed');

    const nftMint = new PublicKey(mintAddress);
    const depositor = new PublicKey(depositorAddress);

    // Derive all accounts
    const userNftAta = await getAssociatedTokenAddress(nftMint, depositor, false);
    const vaultNftAta = await getAssociatedTokenAddress(nftMint, ADDRESSES.ghostKidVault, true);
    const userKidAta = await getAssociatedTokenAddress(ADDRESSES.kidsTokenMint, depositor, false);

    const [nftReceipt] = await getNftReceiptPDA(nftMint);
    const [metadataPDA] = await getMetadataPDA(nftMint);
    const [editionPDA] = await getEditionPDA(nftMint);
    const [sourceTokenRecord] = await getTokenRecordPDA(nftMint, userNftAta);
    const [destinationTokenRecord] = await getTokenRecordPDA(nftMint, vaultNftAta);

    const transaction = new Transaction();

    // Create vault's NFT ATA if it doesn't exist
    const vaultNftAtaInfo = await connection.getAccountInfo(vaultNftAta);
    if (!vaultNftAtaInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          depositor,
          vaultNftAta,
          ADDRESSES.ghostKidVault,
          nftMint
        )
      );
    }

    transaction.add(
      getDepositNftsInstruction({
        nftReceipt,
        vault: ADDRESSES.ghostKidVault,
        vaultTokenAccount: ADDRESSES.ghostKidVaultTokenAccount,
        authority: ADDRESSES.ghostKidAuthority,
        depositor,
        depositorTokenAccount: userKidAta,
        sourceNftTokenAccount: userNftAta,
        mint: nftMint,
        destinationNftTokenAccount: vaultNftAta,
        sourceTokenRecord,
        destinationTokenRecord,
        edition: editionPDA,
        metadata: metadataPDA,
        tokenMint: ADDRESSES.kidsTokenMint,
        metaplexRuleset: ADDRESSES.metaplexRuleset,
        metadataProgram: ADDRESSES.metaplexTokenMetadataProgram,
      })
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = depositor;

    // Authority pre-signs server-side (their signature is required by the program)
    transaction.partialSign(authorityKeypair);

    // Serialize for client — client will add their signature and broadcast
    const serialized = transaction.serialize({ requireAllSignatures: false });

    return NextResponse.json({
      transaction: Buffer.from(serialized).toString('base64'),
      blockhash,
      lastValidBlockHeight,
    });
  } catch (err: any) {
    console.error('Wrap API error:', err);
    return NextResponse.json({ error: err.message || 'Failed to build transaction' }, { status: 500 });
  }
}
