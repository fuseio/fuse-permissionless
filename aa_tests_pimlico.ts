/*
 * PIMLICO BUNDLER REFERENCE IMPLEMENTATION (NOT WORKING)
 * 
 * This implementation demonstrates how to use Pimlico's bundler with EntryPoint v0.6 on Fuse.
 * However, there's a compatibility issue: permissionless.js doesn't correctly pass the
 * entryPoint address as params[1] in RPC calls to Pimlico's API, resulting in errors like:
 * "Validation error: Invalid input: expected string, received null at params[1]"
 * 
 * This affects calls to:
 * - pm_getPaymasterStubData
 * - pm_sponsorUserOperation  
 * - eth_estimateUserOperationGas
 * 
 * Use the Fuse bundler/paymaster implementation (aa_tests.ts) instead, which works correctly.
 * This file is kept as reference for future compatibility fixes in permissionless.js.
 */

import 'dotenv/config';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http, encodeFunctionData, type Address } from 'viem';
import { fuse } from 'viem/chains';
import { entryPoint06Address } from 'viem/account-abstraction';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { toEtherspotSmartAccount } from './etherspot_account';

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY as string;
const TOKEN_ADDRESS = (process.env.TOKEN_ADDRESS || '0x34Ef2Cc892a88415e9f02b91BfA9c91fC0bE6bD4') as Address;
const USE_ETHERSPOT = process.env.USE_ETHERSPOT !== 'false';
const RPC_URL = process.env.RPC_URL || 'https://rpc.fuse.io';

const PIMLICO_BUNDLER_URL = `https://api.pimlico.io/v2/122/rpc?apikey=${PIMLICO_API_KEY}`;

if (!PRIVATE_KEY || !PIMLICO_API_KEY) {
    throw new Error('Missing required environment variables: PRIVATE_KEY, PIMLICO_API_KEY');
}

interface TestResult {
    name: string;
    value: string;
    duration: number;
}

const testResults: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<string>): Promise<void> {
    const startTime = Date.now();
    let result = '0';
    
    try {
        result = await testFn();
        console.log(`✅ Test "${name}" passed\n`);
    } catch (error) {
        console.error(`❌ Test "${name}" failed`);
        if (error instanceof Error) {
            console.error(`   ${error.message}\n`);
        }
    }

    testResults.push({
        name,
        value: result,
        duration: Date.now() - startTime,
    });
}

async function main() {
    console.log('🚀 Starting Permissionless.js Tests (Pimlico)\n');
    console.log(`Using ${USE_ETHERSPOT ? 'Etherspot' : 'SimpleAccount'} account type\n`);
    console.log('⚠️  KNOWN ISSUE: Pimlico bundler with EntryPoint v0.6 has compatibility issues');
    console.log('   permissionless.js doesn\'t pass entryPoint address correctly in RPC calls');
    console.log('   Use Fuse bundler/paymaster (npm test) instead\n');

    const owner = privateKeyToAccount(PRIVATE_KEY);
    const publicClient = createPublicClient({
        transport: http(RPC_URL),
        chain: fuse,
    });

    const testName = 'paymaster_funds';
    await runTest(testName, async () => {
        console.log('💰 Checking account balance...');
        
        const smartAccount = USE_ETHERSPOT
            ? await toEtherspotSmartAccount({
                owner,
                client: publicClient,
                entryPoint: {
                    address: entryPoint06Address,
                    version: '0.6',
                },
            })
            : await toSimpleSmartAccount({
                owner,
                client: publicClient,
                entryPoint: {
                    address: entryPoint06Address,
                    version: '0.6',
                },
            });

        const balance = await publicClient.getBalance({
            address: smartAccount.address,
        });

        console.log(`Smart Account: ${smartAccount.address}`);
        console.log(`Balance: ${balance} wei`);
        
        if (balance === 0n) {
            console.warn('⚠️  Warning: Account has no balance for gas fees');
        }
        
        return '1';
    });

    await runTest('aa-authentication-test', async () => {
        console.log('🔐 Test: AA Authentication');
        
        const smartAccount = USE_ETHERSPOT
            ? await toEtherspotSmartAccount({
                owner,
                client: publicClient,
                entryPoint: {
                    address: entryPoint06Address,
                    version: '0.6',
                },
            })
            : await toSimpleSmartAccount({
                owner,
                client: publicClient,
                entryPoint: {
                    address: entryPoint06Address,
                    version: '0.6',
                },
            });

        console.log(`✅ Smart account created: ${smartAccount.address}`);
        return '1';
    });

    await runTest('aa-native-token-transaction', async () => {
        console.log('💸 Test: Native Token Transaction');

        const smartAccount = USE_ETHERSPOT
            ? await toEtherspotSmartAccount({
                owner,
                client: publicClient,
                entryPoint: {
                    address: entryPoint06Address,
                    version: '0.6',
                },
            })
            : await toSimpleSmartAccount({
                owner,
                client: publicClient,
                entryPoint: {
                    address: entryPoint06Address,
                    version: '0.6',
                },
            });

        const smartAccountClient = createSmartAccountClient({
            account: smartAccount,
            chain: fuse,
            bundlerTransport: http(PIMLICO_BUNDLER_URL),
            userOperation: {
                estimateGas: async () => ({
                    callGasLimit: 200000n,
                    verificationGasLimit: 500000n,
                    preVerificationGas: 100000n,
                }),
            },
        } as any);

        console.log(`📤 Sending native token from: ${smartAccount.address}`);

        const userOpHash = await smartAccountClient.sendUserOperation({
            account: smartAccount,
            calls: [{
                to: smartAccount.address,
                value: BigInt(100),
                data: '0x',
            }],
        });

        console.log(`⏳ Waiting for user operation: ${userOpHash}`);

        const receipt = await smartAccountClient.waitForUserOperationReceipt({
            hash: userOpHash,
        });

        console.log(`✅ Transaction confirmed: ${receipt.receipt.transactionHash}`);
        return '1';
    });

    await runTest('aa-erc20-token-transaction', async () => {
        console.log('🪙 Test: ERC-20 Token Transaction');

        const smartAccount = USE_ETHERSPOT
            ? await toEtherspotSmartAccount({
                owner,
                client: publicClient,
                entryPoint: {
                    address: entryPoint06Address,
                    version: '0.6',
                },
            })
            : await toSimpleSmartAccount({
                owner,
                client: publicClient,
                entryPoint: {
                    address: entryPoint06Address,
                    version: '0.6',
                },
            });

        const smartAccountClient = createSmartAccountClient({
            account: smartAccount,
            chain: fuse,
            bundlerTransport: http(PIMLICO_BUNDLER_URL),
            userOperation: {
                estimateGas: async () => ({
                    callGasLimit: 200000n,
                    verificationGasLimit: 500000n,
                    preVerificationGas: 100000n,
                }),
            },
        } as any);

        console.log(`📤 Sending ERC-20 token from: ${smartAccount.address}`);

        const userOpHash = await smartAccountClient.sendUserOperation({
            account: smartAccount,
            calls: [{
                to: TOKEN_ADDRESS,
                value: 0n,
                data: encodeFunctionData({
                    abi: [{
                        name: 'transfer',
                        type: 'function',
                        stateMutability: 'nonpayable',
                        inputs: [
                            { name: 'to', type: 'address' },
                            { name: 'amount', type: 'uint256' },
                        ],
                        outputs: [{ type: 'bool' }],
                    }],
                    functionName: 'transfer',
                    args: [smartAccount.address, BigInt(10000000)],
                }),
            }],
        });

        console.log(`⏳ Waiting for user operation: ${userOpHash}`);

        const receipt = await smartAccountClient.waitForUserOperationReceipt({
            hash: userOpHash,
        });

        console.log(`✅ Transaction confirmed: ${receipt.receipt.transactionHash}`);
        return '1';
    });

    console.log('\n════════════════════════════════════════════════════════════\n');
    console.log('📊 Test Summary:');
    
    const passed = testResults.filter(r => r.value !== '0').length;
    const failed = testResults.filter(r => r.value === '0').length;
    
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📈 Total: ${testResults.length}`);
    console.log('\n════════════════════════════════════════════════════════════');
    
    testResults.forEach(result => {
        const icon = result.value === '0' ? '❌' : '✅';
        console.log(`${icon} ${result.name}: ${result.value} (${result.duration}ms)`);
    });

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
