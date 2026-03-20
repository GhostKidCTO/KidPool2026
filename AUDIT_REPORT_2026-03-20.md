# Dependency Security Audit Report
**Project:** GhostKid SPL-404 Swap UI
**Date:** 2026-03-20
**Auditor:** Claude Code (Automated)
**Scope:** Full dependency vulnerability scan and remediation

---

## Summary

| Category | Count |
|---|---|
| Vulnerabilities found | 39 |
| Fixed | 18 |
| Accepted risk (no upstream fix) | 2 families (21 advisory entries) |
| Remaining after remediation | 21 (18 low, 3 high — accepted) |

---

## Changes Made

### 1. `package.json` — Next.js version pin updated

**Change:** `"next": "^14.2.35"` → `"next": "^16.2.0"`
**Why:** The installed version was already 16.2.0 (confirmed via `next --version`). The package.json pin was stale from the initial commit, referencing 14.x. Corrected to match the actual installed version.

---

### 2. `package.json` — Added `overrides` block

```json
"overrides": {
  "elliptic": "6.6.1",
  "@walletconnect/utils": "2.23.8",
  "@walletconnect/universal-provider": "2.23.8",
  "@walletconnect/sign-client": "2.23.8",
  "@walletconnect/core": "2.23.8"
}
```

**Why:** `npm audit fix` cannot upgrade transitive WalletConnect packages automatically because the top-level dependent (`@solana/wallet-adapter-walletconnect`) pins older ranges. The only npm-native resolution path was `--force`, which would have downgraded `@solana/wallet-adapter-wallets` to 0.16.1 — a breaking change.

Root-cause analysis showed:
- **elliptic** (GHSA-848j-6mx2-7j84) entered via `@walletconnect/utils@2.19.1` and also via Torus/Trezor adapter chains
- **lodash** (GHSA-xxjr-mmjv-4gpg) entered via `@walletconnect/universal-provider@2.19.1`

`@walletconnect/utils@2.23.8` replaced `elliptic` with `@noble/curves` (modern, audited cryptography library). `@walletconnect/universal-provider@2.23.8` replaced `lodash` with `es-toolkit`. Forcing these versions via `overrides` eliminates both vulnerability chains from WalletConnect without any breaking API changes.

The `elliptic@6.6.1` override ensures all remaining elliptic instances (Torus/Trezor adapter chains) run the latest available code, even though GHSA-848j-6mx2-7j84 has no fixed version.

---

### 3. `package-lock.json` — Regenerated

**Why:** Automatically updated by `npm audit fix` and `npm install` to reflect patched transitive dependency versions and the new overrides.

---

### 4. `CLAUDE.md` — Created (new file)

**Why:** Added per-project guidance file for Claude Code. Contains build commands, architecture overview, and on-chain program constants. Does not affect runtime behavior.

---

### 5. `SECURITY_AUDIT.md` — Updated

**Why:** The existing audit document was dated 2026-01-03 and referenced Next.js 14.2.35. Updated to reflect:
- Current date (2026-03-20)
- Corrected Next.js version (16.2.0)
- All 18 newly fixed vulnerabilities documented with advisory IDs
- Two newly documented accepted-risk entries (elliptic all-versions, bigint-buffer all-versions)
- Updated Known CVEs table
- Updated next review date to 2026-04-20

---

## Vulnerabilities Fixed

### Fixed via `npm audit fix` (non-breaking)

| Advisory | Package | Severity | Description |
|---|---|---|---|
| GHSA-43fc-jf86-j433 | axios | High | DoS via `__proto__` key in `mergeConfig` |
| GHSA-mp2g-9vg9-f4cg | h3 | High | Request Smuggling (TE.TE) |
| GHSA-wr4h-v87w-p3r7 | h3 | High | Path traversal via percent-encoded dot segments |
| GHSA-22cc-p3c6-wpvm | h3 | High | SSE injection via unsanitized newlines |
| GHSA-677m-j7p3-52f9 | socket.io-parser | High | Unbounded binary attachments (DoS) |
| GHSA-3ppc-4f35-3m26 | minimatch | High | ReDoS via repeated wildcards |
| GHSA-7r86-cg39-jmmj | minimatch | High | ReDoS via multiple GLOBSTAR segments |
| GHSA-23c5-xmqv-rm74 | minimatch | High | ReDoS via nested `*()` extglobs |
| GHSA-378v-28hj-76wf | bn.js | Moderate | Infinite loop (DoS) |
| GHSA-xxjr-mmjv-4gpg | lodash-es | Moderate | Prototype pollution in `_.unset`/`_.omit` |

### Fixed via `package.json` overrides

| Advisory | Package | Severity | Description | Resolution |
|---|---|---|---|---|
| GHSA-848j-6mx2-7j84 | elliptic (via WalletConnect) | High | Risky cryptographic primitive (Ed25519 malleability) | WalletConnect 2.23.x switched to `@noble/curves` — elliptic no longer imported in that chain |
| GHSA-xxjr-mmjv-4gpg | lodash (via WalletConnect) | Moderate | Prototype pollution | WalletConnect 2.23.x replaced lodash with `es-toolkit` |

---

## Accepted Risk (No Upstream Fix Available)

### GHSA-3gc7-fjrx-p6mg — `bigint-buffer` Buffer Overflow
- **Severity:** High (CVSS 7.5)
- **Affected versions:** All (`*`) — library is unmaintained
- **Dependency path:** `@solana/spl-token ≥0.2.0` → `@solana/buffer-layout-utils` → `bigint-buffer`
- **Impact:** Denial of Service only (C:N, I:N, A:H). No confidentiality or integrity risk.
- **Why not fixed:** The only npm-provided resolution is `npm audit fix --force`, which downgrades `@solana/spl-token` to 0.1.8 — a version that lacks the APIs used throughout this codebase. This is a Solana ecosystem-wide issue with no patch available in any version.
- **Mitigation:** RPC-level rate limiting already implemented in `VaultNFTs.tsx`.

### GHSA-848j-6mx2-7j84 — `elliptic` Risky Cryptographic Primitive
- **Severity:** High
- **Affected versions:** All (`*`) — no fixed version published
- **Dependency paths (remaining after overrides):**
  - `@solana/wallet-adapter-torus` → `@toruslabs/eccrypto` → `elliptic`
  - `@solana/wallet-adapter-torus` → `crypto-browserify` → `browserify-sign` → `elliptic`
  - `@solana/wallet-adapter-trezor` → `@trezor/connect-web` → `tiny-secp256k1` → `elliptic`
  - `crypto-browserify` (direct project dep) → `create-ecdh` → `elliptic`
- **Why not fixed:** Advisory GHSA-848j-6mx2-7j84 marks all versions of elliptic as vulnerable. The npm-provided `--force` resolution would downgrade `crypto-browserify` to 3.3.0 (a 2014 release), breaking the Solana web3.js browser polyfill. All instances are pinned to the latest available (`6.6.1`) via overrides.
- **Exposure context:** These code paths run client-side, within wallet adapter initialization, triggered only when a user connects a Torus or Trezor hardware wallet. No server-side exposure.

---

## What Was NOT Changed

- Application source code (`app/`, `lib/`) — no functional changes
- `lib/ghostkid-program/instructions.ts` — modified prior to this session (pre-existing uncommitted change, not touched here)
- Runtime behavior — all changes are dependency version constraints only

---

## Verification

```
npm audit (post-remediation)
39 vulnerabilities → 21 remaining (18 low, 3 high)
All 3 remaining high severity = accepted risk documented above
```
