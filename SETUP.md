# Setup Guide

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- Fuse Network API key
- Private key with ETH for gas (or sponsored paymaster)

## Installation

```bash
cd test-permissionless
npm install
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

### Required Variables

```env
PRIVATE_KEY=0x...                    # Your EOA private key
PUBLIC_API_KEY=your_fuse_api_key    # Fuse API key
```

### Optional Variables

```env
TOKEN_ADDRESS=0x34Ef2Cc892a88415e9f02b91BfA9c91fC0bE6bD4  # ERC-20 token for testing
SPONSOR_ID=your_sponsor_id                                # Paymaster sponsor ID
PAYMASTER_ADDRESS=0x...                                   # Paymaster contract
RPC_URL=https://rpc.fuse.io                              # HTTP RPC endpoint
BUNDLER_URL=https://api.fuse.io/api/v0/bundler?apiKey=...
PAYMASTER_URL=https://api.fuse.io/api/v0/paymaster?apiKey=...
USE_ETHERSPOT=true                                        # Use Etherspot (default)
```

## Running Tests

```bash
# Run all tests
npm test

# Run with watch mode
npm run test:dev

# Run specific test (if implemented)
npm test -- --grep "Native Token"
```

## Troubleshooting

### Common Issues

**1. WebSocket URL Error**
```
Error: HTTP request failed. URL: wss://...
```
**Solution:** Ensure `RPC_URL` is HTTP/HTTPS, not WebSocket (`wss://`).

**2. Invalid API Key**
```
Error: HTTP 403: Forbidden
```
**Solution:** Verify `PUBLIC_API_KEY` in `.env` is correct and active.

**3. Insufficient Balance**
```
Error: AA21 didn't pay prefund
```
**Solution:** Ensure account has ETH or paymaster is properly configured.

**4. Nonce Too High**
```
Error: AA25 invalid account nonce
```
**Solution:** Account state mismatch. Try with fresh private key or wait for pending operations.

## Testing Different Account Types

```bash
# Test with Etherspot (matches Fuse SDK)
USE_ETHERSPOT=true npm test

# Test with SimpleAccount
USE_ETHERSPOT=false npm test
```

## Verification

After successful test run, you should see:

```
📊 Test Summary:
   ✅ Passed: 4
   ❌ Failed: 0
   📈 Total: 4
```

## Next Steps

- Review test results in console
- Verify transactions on Fuse Explorer
- Integrate into your CI/CD pipeline
