import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

const GHOSTKID_PROGRAM_ID = new PublicKey('4BTy6FpUakBpNNTJFF6V7BK4fKR2bds6Sh523Z3gxy4k');
const METAPLEX_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

export interface WithdrawNftsAccounts {
  nftReceipt: PublicKey;
  vault: PublicKey;
  vaultTokenAccount: PublicKey;
  authority: PublicKey;
  withdrawer: PublicKey;
  withdrawerTokenAccount: PublicKey;
  nftTokenAccount: PublicKey;
  mint: PublicKey;
  token: PublicKey;
  record: PublicKey;
  destinationRecord: PublicKey;
  edition: PublicKey;
  metadata: PublicKey;
  tokenMint: PublicKey;
  metaplexRuleset: PublicKey;
  metadataProgram: PublicKey;
}

/**
 * Creates a withdraw NFTs instruction for the GhostKid program
 * Reverse engineered from successful transaction:
 * Signature: 4UzocBCH3tK8sVVD5XQ6JQeGN4MQEuRkkX78McunBserVMJGsWNCX9Mp9Qddz7119RwCiHnESqpp1M5bCaJ1tTTV
 */
export function getWithdrawNftsInstruction(
  accounts: WithdrawNftsAccounts
): TransactionInstruction {
  // Use the EXACT discriminator from the successful transaction
  // This is the 8-byte instruction discriminator that the program expects
  const instructionData = Buffer.from('f3c0e4b775d6f067', 'hex');
  console.log('Using discriminator from successful tx:', instructionData.toString('hex'));

  // Account order attempting to match Anchor IDL requirements
  // Based on error logs showing metadata_program expected at different position
  const keys = [
    { pubkey: accounts.nftReceipt, isSigner: false, isWritable: true },        // #0
    { pubkey: accounts.vault, isSigner: false, isWritable: true },              // #1
    { pubkey: accounts.vaultTokenAccount, isSigner: false, isWritable: true },  // #2
    { pubkey: accounts.authority, isSigner: false, isWritable: true },          // #3
    { pubkey: accounts.withdrawer, isSigner: true, isWritable: true },          // #4
    { pubkey: accounts.withdrawerTokenAccount, isSigner: false, isWritable: true }, // #5
    { pubkey: accounts.nftTokenAccount, isSigner: false, isWritable: true },    // #6 (magic account)
    { pubkey: accounts.mint, isSigner: false, isWritable: false },              // #7
    { pubkey: accounts.token, isSigner: false, isWritable: true },              // #8 (destination)
    { pubkey: accounts.record, isSigner: false, isWritable: true },             // #9 (source token record)
    { pubkey: accounts.destinationRecord, isSigner: false, isWritable: true },  // #10
    { pubkey: accounts.edition, isSigner: false, isWritable: true },            // #11
    { pubkey: accounts.metadata, isSigner: false, isWritable: true },           // #12
    { pubkey: accounts.tokenMint, isSigner: false, isWritable: false },         // #13 $KID token mint
    { pubkey: accounts.metaplexRuleset, isSigner: false, isWritable: false },   // #14
    { pubkey: accounts.metadataProgram, isSigner: false, isWritable: false },   // #15 Token Metadata Program
    { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false }, // #16
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },           // #17
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },// #18
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },    // #19
  ];

  return new TransactionInstruction({
    keys,
    programId: GHOSTKID_PROGRAM_ID,
    data: instructionData,
  });
}

/**
 * Helper to derive NFT receipt PDA
 */
export async function getNftReceiptPDA(
  nftMint: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddress(
    [Buffer.from('nft_receipt'), nftMint.toBuffer()],
    GHOSTKID_PROGRAM_ID
  );
}

/**
 * Helper to derive token record PDA
 */
export async function getTokenRecordPDA(
  mint: PublicKey,
  tokenAccount: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddress(
    [
      Buffer.from('metadata'),
      METAPLEX_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
      Buffer.from('token_record'),
      tokenAccount.toBuffer(),
    ],
    METAPLEX_PROGRAM_ID
  );
}

/**
 * Helper to derive metadata PDA
 */
export async function getMetadataPDA(
  mint: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddress(
    [
      Buffer.from('metadata'),
      METAPLEX_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    METAPLEX_PROGRAM_ID
  );
}

/**
 * Helper to derive edition PDA
 */
export async function getEditionPDA(
  mint: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddress(
    [
      Buffer.from('metadata'),
      METAPLEX_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
      Buffer.from('edition'),
    ],
    METAPLEX_PROGRAM_ID
  );
}
