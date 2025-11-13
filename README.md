# Permissionless.js POC

TypeScript implementation of Account Abstraction (ERC-4337) tests using permissionless.js SDK with EntryPoint v0.6 on Fuse Network.

## Features

- ✅ EtherspotWallet support (compatible with Fuse SDK addresses)
- ✅ EntryPoint v0.6 implementation
- ✅ Native token transfers via user operations
- ✅ ERC-20 token transfers via user operations
- ✅ Fuse bundler and paymaster integration

## Quick Start

```bash
cd test-permissionless
cp env.example .env
# Edit .env with your credentials
npm install
npm test
```

## Configuration

Copy `env.example` to `.env` and configure:

```env
PRIVATE_KEY=0x...
PUBLIC_API_KEY=your_api_key
TOKEN_ADDRESS=0x34Ef2Cc892a88415e9f02b91BfA9c91fC0bE6bD4
SPONSOR_ID=your_sponsor_id
PAYMASTER_ADDRESS=0x...
RPC_URL=https://rpc.fuse.io
BUNDLER_URL=https://api.fuse.io/api/v0/bundler?apiKey=YOUR_KEY
PAYMASTER_URL=https://api.fuse.io/api/v0/paymaster?apiKey=YOUR_KEY
USE_ETHERSPOT=true
```

**Note:** RPC_URL must be HTTP/HTTPS (not WebSocket).

## Tests

1. **Paymaster Funds** - Verify sponsor balance
2. **AA Authentication** - Create and validate smart account
3. **Native Token Transaction** - Send FUSE tokens
4. **ERC-20 Token Transaction** - Send ERC-20 tokens

## Account Types

By default, tests use EtherspotWallet which generates the same addresses as Fuse SDK:

```bash
# Use Etherspot (matches Fuse SDK)
USE_ETHERSPOT=true npm test

# Use SimpleAccount
USE_ETHERSPOT=false npm test
```

## Architecture

```text
EOA (Private Key)
    ↓
EtherspotWallet / SimpleAccount (EntryPoint v0.6)
    ↓
Bundler → EntryPoint → Fuse Network
    ↓
Paymaster (Gas Sponsorship)
```

## Implementation Details

- **Factory:** `0x7f6d8F107fE8551160BD5351d5F1514A6aD5d40E` (EtherspotWallet)
- **EntryPoint:** `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` (v0.6)
- **Chain:** Fuse Network (Chain ID: 122)

## Files

- `aa_tests.ts` - Main test suite
- `etherspot_account.ts` - EtherspotWallet adapter for permissionless.js
- `fuse_bundler_transport.ts` - Custom transport for Fuse bundler compatibility
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration

## Requirements

- Node.js 18+
- TypeScript 5+
- Valid private key with sufficient balance
- Fuse API key
