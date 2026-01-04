// Browser polyfills for Solana wallet adapters
import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
  (global as any).Buffer = Buffer;
}
