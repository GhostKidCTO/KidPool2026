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
const AUTH_RULES_PROGRAM_ID = new PublicKey('auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg');

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

  // Account order based on Anchor error logs.
  // The program expects the legacy ATA program at the associated_token_program slot.
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
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },           // #16
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },// #17
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },    // #18
    { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false }, // #19
    { pubkey: AUTH_RULES_PROGRAM_ID, isSigner: false, isWritable: false },      // #20
  ];

  return new TransactionInstruction({
    keys,
    programId: GHOSTKID_PROGRAM_ID,
    data: instructionData,
  });
}

export interface DepositNftsAccounts {
  nftReceipt: PublicKey;
  vault: PublicKey;
  vaultTokenAccount: PublicKey;
  authority: PublicKey;
  depositor: PublicKey;
  depositorTokenAccount: PublicKey;
  sourceNftTokenAccount: PublicKey;
  mint: PublicKey;
  destinationNftTokenAccount: PublicKey;
  sourceTokenRecord: PublicKey;
  destinationTokenRecord: PublicKey;
  edition: PublicKey;
  metadata: PublicKey;
  tokenMint: PublicKey;
  metaplexRuleset: PublicKey;
  metadataProgram: PublicKey;
}

/**
 * Creates a deposit NFTs instruction for the GhostKid program (wrap: NFT → $KID)
 * Reverse engineered from successful transaction:
 * Signature: 5oV7kLDoEVoppfoPM6x54ynDAPMu7ryVJmEDapTyfu3NKBQQ83txxhhaKox1Nofd4VT4AmH8FKHfa6fQ9QgJ8u34
 * Note: ATA and TOKEN program IDs are swapped vs withdraw (#16=AToken, #17=Token)
 */
export function getDepositNftsInstruction(
  accounts: DepositNftsAccounts
): TransactionInstruction {
  // Discriminator verified from on-chain tx: 5oV7kLDoEVoppfoPM6x54ynDAPMu7ryVJmEDapTyfu3NKBQQ83txxhhaKox1Nofd4VT4AmH8FKHfa6fQ9QgJ8u34
  const instructionData = Buffer.from('a1353b929459d5ca', 'hex');

  const keys = [
    { pubkey: accounts.nftReceipt, isSigner: false, isWritable: true },               // #0
    { pubkey: accounts.vault, isSigner: false, isWritable: true },                     // #1
    { pubkey: accounts.vaultTokenAccount, isSigner: false, isWritable: true },         // #2
    { pubkey: accounts.authority, isSigner: false, isWritable: true },                 // #3
    { pubkey: accounts.depositor, isSigner: true, isWritable: true },                  // #4
    { pubkey: accounts.depositorTokenAccount, isSigner: false, isWritable: true },     // #5 (receives $KID)
    { pubkey: accounts.sourceNftTokenAccount, isSigner: false, isWritable: true },     // #6 (user's NFT account)
    { pubkey: accounts.mint, isSigner: false, isWritable: false },                     // #7
    { pubkey: accounts.destinationNftTokenAccount, isSigner: false, isWritable: true },// #8 (vault's NFT account)
    { pubkey: accounts.sourceTokenRecord, isSigner: false, isWritable: true },         // #9 (user's token record)
    { pubkey: accounts.destinationTokenRecord, isSigner: false, isWritable: true },    // #10 (vault's token record)
    { pubkey: accounts.edition, isSigner: false, isWritable: true },                   // #11
    { pubkey: accounts.metadata, isSigner: false, isWritable: true },                  // #12
    { pubkey: accounts.tokenMint, isSigner: false, isWritable: false },                // #13 $KID token mint
    { pubkey: accounts.metaplexRuleset, isSigner: false, isWritable: false },          // #14
    { pubkey: accounts.metadataProgram, isSigner: false, isWritable: false },          // #15
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },       // #16 (swapped vs withdraw)
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },                  // #17 (swapped vs withdraw)
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },           // #18
    { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },        // #19
    { pubkey: AUTH_RULES_PROGRAM_ID, isSigner: false, isWritable: false },             // #20
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
