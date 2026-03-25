import { NextResponse } from 'next/server';

/**
 * Returns whether the authority keypair is configured server-side.
 * The key itself is never exposed — only a boolean.
 */
export async function GET() {
  const key = process.env.AUTHORITY_PRIVATE_KEY;
  const configured = typeof key === 'string' && key.trim().length > 0;
  return NextResponse.json({ authorityConfigured: configured });
}
