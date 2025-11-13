import 'dotenv/config';
import { createPublicClient, http, formatEther, encodeFunctionData, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { entryPoint06Address } from 'viem/account-abstraction';
import { fuse } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { toEtherspotSmartAccount } from './etherspot_account.js';
import { fuseBundlerTransport } from './fuse_bundler_transport.js';

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const PUBLIC_API_KEY = process.env.PUBLIC_API_KEY || '';
const TOKEN_ADDRESS = (process.env.TOKEN_ADDRESS || '0x34Ef2Cc892a88415e9f02b91BfA9c91fC0bE6bD4') as Address;
const PAYMASTER_SPONSOR_ID = process.env.SPONSOR_ID || '';
const PAYMASTER_ADDRESS = process.env.PAYMASTER_ADDRESS as Address;
const RPC_URL = process.env.RPC_URL || 'https://rpc.fuse.io';
const BUNDLER_URL = process.env.BUNDLER_URL
    ? (process.env.BUNDLER_URL.startsWith('http') ? process.env.BUNDLER_URL : `https://${process.env.BUNDLER_URL}`)
    : `https://api.fuse.io/api/v0/bundler?apiKey=${PUBLIC_API_KEY}`;
const PAYMASTER_URL = process.env.PAYMASTER_URL || `https://api.fuse.io/api/v0/paymaster?apiKey=${PUBLIC_API_KEY}`;
const USE_ETHERSPOT = process.env.USE_ETHERSPOT !== 'false';

const PAYMASTER_ABI = [
    {
        inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        name: 'sponsorBalances',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
] as const;

const ERC20_ABI = [
    {
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        name: 'transfer',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const;

interface TestResult {
    name: string;
    value: string;
    duration: number;
    success: boolean;
}

const testResults: TestResult[] = [];

async function runWithTimeout<T>(
    task: () => Promise<T>,
    timeoutSeconds: number = 35
): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Task timed out after ${timeoutSeconds} seconds`)), timeoutSeconds * 1000)
    );
    return Promise.race([task(), timeoutPromise]);
}

async function testPaymasterFunds(): Promise<void> {
    const testName = 'paymaster_funds';
    const startTime = Date.now();
    let balanceInEther = '0';

    try {
        console.log('\n🔍 Test: Check Paymaster Funds by Sponsor ID');

        const publicClient = createPublicClient({
            chain: fuse,
            transport: http(RPC_URL),
        });

        await runWithTimeout(async () => {
            const balance = await publicClient.readContract({
                address: PAYMASTER_ADDRESS,
                abi: PAYMASTER_ABI,
                functionName: 'sponsorBalances',
                args: [BigInt(PAYMASTER_SPONSOR_ID)],
            });

            balanceInEther = formatEther(balance);
            console.log(`💰 Paymaster Balance: ${balanceInEther} ETH`);
        });

        testResults.push({
            name: testName,
            value: balanceInEther,
            duration: Date.now() - startTime,
            success: true,
        });
    } catch (error) {
        console.error('❌ Paymaster funds check failed:', error);
        testResults.push({
            name: testName,
            value: balanceInEther,
            duration: Date.now() - startTime,
            success: false,
        });
        throw error;
    }
}

async function testAAAuthentication(): Promise<void> {
    const testName = 'aa-authentication-test';
    const startTime = Date.now();
    let result = '0';
    let accountAddress = '';

    try {
        console.log('\n🔐 Test: AA Authentication');

        await runWithTimeout(async () => {
            const owner = privateKeyToAccount(PRIVATE_KEY);

            const publicClient = createPublicClient({
                chain: fuse,
                transport: http(RPC_URL),
            });

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

            accountAddress = smartAccount.address;
            console.log(`\n📋 Account Details:`);
            console.log(`   Address: ${accountAddress}`);
            console.log(`   Type: ${USE_ETHERSPOT ? 'EtherspotWallet (matches Fuse SDK)' : 'SimpleAccount'}`);
            console.log(`   EntryPoint v0.6: ${entryPoint06Address}`);

            console.log(`✅ Using Fuse bundler: ${BUNDLER_URL}`);

            result = '1';
        });

        testResults.push({
            name: testName,
            value: result,
            duration: Date.now() - startTime,
            success: result === '1',
        });
    } catch (error) {
        console.error('❌ AA Authentication failed:', error);
        testResults.push({
            name: testName,
            value: result,
            duration: Date.now() - startTime,
            success: false,
        });
        throw error;
    }
}

async function getPaymasterData(publicClient: any, userOperation: any) {
    const gasPrice = await publicClient.estimateFeesPerGas();
    const maxFeePerGas = gasPrice.maxFeePerGas || 0n;
    const maxPriorityFeePerGas = gasPrice.maxPriorityFeePerGas || 1000000000n;

    const paymasterUrl = PAYMASTER_URL || `https://api.fuse.io/api/v0/paymaster?apiKey=${PUBLIC_API_KEY}`;

    const userOpForRpc = {
        sender: userOperation.sender,
        nonce: `0x${(userOperation.nonce || 0n).toString(16)}`,
        initCode: userOperation.factory ? `${userOperation.factory}${userOperation.factoryData?.slice(2) || ''}` : '0x',
        callData: userOperation.callData,
        callGasLimit: `0x${(userOperation.callGasLimit || 0n).toString(16)}`,
        verificationGasLimit: `0x${(userOperation.verificationGasLimit || 0n).toString(16)}`,
        preVerificationGas: `0x${(userOperation.preVerificationGas || 0n).toString(16)}`,
        maxFeePerGas: `0x${maxFeePerGas.toString(16)}`,
        maxPriorityFeePerGas: `0x${maxPriorityFeePerGas.toString(16)}`,
        paymasterAndData: '0x',
        signature: userOperation.signature || '0x',
    };

    console.log(`📝 UserOp for paymaster - Nonce: ${userOpForRpc.nonce}, Sender: ${userOpForRpc.sender}`);

    const response = await fetch(paymasterUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'pm_sponsorUserOperation',
            params: [
                userOpForRpc,
                entryPoint06Address,
                { sponsorId: PAYMASTER_SPONSOR_ID },
            ],
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Paymaster HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json() as {
        error?: { code: number; message: string };
        result?: {
            paymasterAndData?: string;
            callGasLimit?: string;
            verificationGasLimit?: string;
            preVerificationGas?: string;
        }
    };
    console.log('✅ Paymaster response received');

    if (data.error) {
        throw new Error(`Paymaster RPC error: ${JSON.stringify(data.error)}`);
    }

    const result = data.result;
    if (!result?.paymasterAndData) {
        throw new Error(`Invalid paymaster response (missing paymasterAndData): ${JSON.stringify(data)}`);
    }

    const paymasterAndData = result.paymasterAndData;
    const paymaster = paymasterAndData.slice(0, 42) as Address;
    const paymasterData = `0x${paymasterAndData.slice(42)}` as `0x${string}`;

    return {
        paymaster,
        paymasterData,
        callGasLimit: BigInt(result.callGasLimit || 0),
        verificationGasLimit: BigInt(result.verificationGasLimit || 0),
        preVerificationGas: BigInt(result.preVerificationGas || 0),
        maxFeePerGas,
        maxPriorityFeePerGas,
    };
}

async function testNativeTokenTransaction(): Promise<void> {
    const testName = 'aa-native-token-transaction';
    const startTime = Date.now();
    let result = '0';

    try {
        console.log('\n💸 Test: Native Token Transaction');

        await runWithTimeout(async () => {
            const owner = privateKeyToAccount(PRIVATE_KEY);

            const publicClient = createPublicClient({
                chain: fuse,
                transport: http(RPC_URL),
            });

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
                bundlerTransport: fuseBundlerTransport(BUNDLER_URL, entryPoint06Address),
                middleware: {
                    gasPrice: async () => ({
                        maxFeePerGas: await publicClient.estimateFeesPerGas().then(f => f.maxFeePerGas!),
                        maxPriorityFeePerGas: await publicClient.estimateFeesPerGas().then(f => f.maxPriorityFeePerGas || 2000000000n),
                    }),
                },
                paymaster: {
                    getPaymasterData: (userOperation: any) => getPaymasterData(publicClient, userOperation),
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
            result = '1';
        });

        testResults.push({
            name: testName,
            value: result,
            duration: Date.now() - startTime,
            success: result === '1',
        });
    } catch (error) {
        console.error('❌ Native token transaction failed:', error);
        testResults.push({
            name: testName,
            value: result,
            duration: Date.now() - startTime,
            success: false,
        });
        throw error;
    }
}

async function testERC20Transaction(): Promise<void> {
    const testName = 'aa-erc20-token-transaction';
    const startTime = Date.now();
    let result = '0';

    try {
        console.log('\n🪙 Test: ERC-20 Token Transaction');

        await runWithTimeout(async () => {
            const owner = privateKeyToAccount(PRIVATE_KEY);

            const publicClient = createPublicClient({
                chain: fuse,
                transport: http(RPC_URL),
            });

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
                bundlerTransport: fuseBundlerTransport(BUNDLER_URL, entryPoint06Address),
                middleware: {
                    gasPrice: async () => ({
                        maxFeePerGas: await publicClient.estimateFeesPerGas().then(f => f.maxFeePerGas!),
                        maxPriorityFeePerGas: await publicClient.estimateFeesPerGas().then(f => f.maxPriorityFeePerGas || 2000000000n),
                    }),
                },
                paymaster: {
                    getPaymasterData: (userOperation: any) => getPaymasterData(publicClient, userOperation),
                },
            } as any);

            console.log(`📤 Sending ERC-20 token from: ${smartAccount.address}`);

            const userOpHash = await smartAccountClient.sendUserOperation({
                account: smartAccount,
                calls: [{
                    to: TOKEN_ADDRESS,
                    value: 0n,
                    data: encodeFunctionData({
                        abi: ERC20_ABI,
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
            result = '1';
        });

        testResults.push({
            name: testName,
            value: result,
            duration: Date.now() - startTime,
            success: result === '1',
        });
    } catch (error) {
        console.error('❌ ERC-20 token transaction failed:', error);
        testResults.push({
            name: testName,
            value: result,
            duration: Date.now() - startTime,
            success: false,
        });
        throw error;
    }
}

async function runTests(): Promise<void> {
    console.log('🚀 Starting Permissionless.js Tests\n');
    console.log('═'.repeat(60));

    const tests = [
        { name: 'Paymaster Funds', fn: testPaymasterFunds },
        { name: 'AA Authentication', fn: testAAAuthentication },
        { name: 'Native Token Transaction', fn: testNativeTokenTransaction },
        { name: 'ERC-20 Token Transaction', fn: testERC20Transaction },
    ];

    let passedCount = 0;
    let failedCount = 0;

    for (const test of tests) {
        try {
            await test.fn();
            passedCount++;
        } catch (error) {
            failedCount++;
            console.error(`\n❌ Test "${test.name}" failed`);
        }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('\n📊 Test Summary:');
    console.log(`   ✅ Passed: ${passedCount}`);
    console.log(`   ❌ Failed: ${failedCount}`);
    console.log(`   📈 Total: ${tests.length}`);
    console.log('\n' + '═'.repeat(60));

    testResults.forEach((result) => {
        const icon = result.success ? '✅' : '❌';
        console.log(`${icon} ${result.name}: ${result.value} (${result.duration}ms)`);
    });

    process.exit(failedCount > 0 ? 1 : 0);
}

runTests().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
