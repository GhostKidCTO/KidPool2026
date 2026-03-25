import { NextRequest, NextResponse } from 'next/server';
import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import bs58 from 'bs58';
import {
  getDepositNftsInstruction,
  getWithdrawNftsInstruction,
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
    const { userMintAddress, vaultMintAddress, userAddress } = await request.json();

    if (!userMintAddress || !vaultMintAddress || !userAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (userMintAddress === vaultMintAddress) {
      return NextResponse.json({ error: 'Cannot swap an NFT for itself' }, { status: 400 });
    }

    const authorityKeyRaw = process.env.AUTHORITY_PRIVATE_KEY;
    if (!authorityKeyRaw) {
      return NextResponse.json({ error: 'Authority key not configured' }, { status: 503 });
    }

    let authorityKeypair: Keypair;
    try {
      if (authorityKeyRaw.startsWith('[')) {
        authorityKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(authorityKeyRaw)));
      } else {
        authorityKeypair = Keypair.fromSecretKey(bs58.decode(authorityKeyRaw));
      }
    } catch {
      return NextResponse.json({ error: 'Invalid authority key format' }, { status: 503 });
    }

    if (authorityKeypair.publicKey.toBase58() !== ADDRESSES.ghostKidAuthority.toBase58()) {
      return NextResponse.json({ error: 'Authority key mismatch' }, { status: 503 });
    }

    const rpcEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcEndpoint, 'confirmed');

    const userMint = new PublicKey(userMintAddress);
    const vaultMint = new PublicKey(vaultMintAddress);
    const user = new PublicKey(userAddress);

    // ── Deposit accounts (user NFT → vault) ──────────────────────────────────
    const userNftAta = await getAssociatedTokenAddress(userMint, user, false);
    const vaultNftAta = await getAssociatedTokenAddress(userMint, ADDRESSES.ghostKidVault, true);
    const userKidAta = await getAssociatedTokenAddress(ADDRESSES.kidsTokenMint, user, false);

    const [depositReceipt] = await getNftReceiptPDA(userMint);
    const [depositMetadata] = await getMetadataPDA(userMint);
    const [depositEdition] = await getEditionPDA(userMint);
    const [depositSrcRecord] = await getTokenRecordPDA(userMint, userNftAta);
    const [depositDstRecord] = await getTokenRecordPDA(userMint, vaultNftAta);

    // ── Withdraw accounts (vault NFT → user) ─────────────────────────────────
    // Locate the vault's token account that currently holds the vault NFT
    const vaultNftTokenAccounts = await connection.getParsedTokenAccountsByOwner(
      ADDRESSES.ghostKidVault,
      { mint: vaultMint },
      'confirmed'
    );
    if (vaultNftTokenAccounts.value.length === 0) {
      return NextResponse.json(
        { error: 'Vault NFT token account not found — NFT may not be in the vault' },
        { status: 400 }
      );
    }
    const vaultNftTokenAccount = vaultNftTokenAccounts.value[0].pubkey;

    const userReceiveNftAta = await getAssociatedTokenAddress(vaultMint, user, false);

    const [withdrawReceipt] = await getNftReceiptPDA(vaultMint);
    const [withdrawMetadata] = await getMetadataPDA(vaultMint);
    const [withdrawEdition] = await getEditionPDA(vaultMint);
    const [withdrawSrcRecord] = await getTokenRecordPDA(vaultMint, vaultNftTokenAccount);
    const [withdrawDstRecord] = await getTokenRecordPDA(vaultMint, userReceiveNftAta);

    // Verify the vault NFT receipt exists (confirms it was properly deposited)
    const withdrawReceiptInfo = await connection.getAccountInfo(withdrawReceipt);
    if (!withdrawReceiptInfo) {
      return NextResponse.json(
        { error: 'Vault NFT receipt not found — the vault NFT may not be properly deposited' },
        { status: 400 }
      );
    }

    const transaction = new Transaction();

    // Create vault's ATA for the user's incoming NFT if needed
    const vaultNftAtaInfo = await connection.getAccountInfo(vaultNftAta);
    if (!vaultNftAtaInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(user, vaultNftAta, ADDRESSES.ghostKidVault, userMint)
      );
    }

    // Create user's $KID ATA if needed (deposit credits it, withdraw debits it — net zero for same rarity)
    const userKidAtaInfo = await connection.getAccountInfo(userKidAta);
    if (!userKidAtaInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(user, userKidAta, user, ADDRESSES.kidsTokenMint)
      );
    }

    // Create user's ATA for the vault NFT being received if needed
    const userReceiveNftAtaInfo = await connection.getAccountInfo(userReceiveNftAta);
    if (!userReceiveNftAtaInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(user, userReceiveNftAta, user, vaultMint)
      );
    }

    // Instruction 1: deposit user's NFT into vault (credits $KID to user)
    transaction.add(
      getDepositNftsInstruction({
        nftReceipt: depositReceipt,
        vault: ADDRESSES.ghostKidVault,
        vaultTokenAccount: ADDRESSES.ghostKidVaultTokenAccount,
        authority: ADDRESSES.ghostKidAuthority,
        depositor: user,
        depositorTokenAccount: userKidAta,
        sourceNftTokenAccount: userNftAta,
        mint: userMint,
        destinationNftTokenAccount: vaultNftAta,
        sourceTokenRecord: depositSrcRecord,
        destinationTokenRecord: depositDstRecord,
        edition: depositEdition,
        metadata: depositMetadata,
        tokenMint: ADDRESSES.kidsTokenMint,
        metaplexRuleset: ADDRESSES.metaplexRuleset,
        metadataProgram: ADDRESSES.metaplexTokenMetadataProgram,
      })
    );

    // Instruction 2: withdraw vault NFT to user (debits $KID from user — same amount, net zero)
    transaction.add(
      getWithdrawNftsInstruction({
        nftReceipt: withdrawReceipt,
        vault: ADDRESSES.ghostKidVault,
        vaultTokenAccount: ADDRESSES.ghostKidVaultTokenAccount,
        authority: ADDRESSES.ghostKidAuthority,
        withdrawer: user,
        withdrawerTokenAccount: userKidAta,
        nftTokenAccount: vaultNftTokenAccount,
        mint: vaultMint,
        token: userReceiveNftAta,
        record: withdrawSrcRecord,
        destinationRecord: withdrawDstRecord,
        edition: withdrawEdition,
        metadata: withdrawMetadata,
        metadataProgram: ADDRESSES.metaplexTokenMetadataProgram,
        tokenMint: ADDRESSES.kidsTokenMint,
        metaplexRuleset: ADDRESSES.metaplexRuleset,
      })
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = user;

    // Authority pre-signs — required by deposit_nfts
    transaction.partialSign(authorityKeypair);

    const serialized = transaction.serialize({ requireAllSignatures: false });

    return NextResponse.json({
      transaction: Buffer.from(serialized).toString('base64'),
      blockhash,
      lastValidBlockHeight,
    });
  } catch (err: any) {
    console.error('Swap API error:', err);
    return NextResponse.json({ error: err.message || 'Failed to build swap transaction' }, { status: 500 });
  }
}
