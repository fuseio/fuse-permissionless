import 'dotenv/config';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http, encodeFunctionData, type Address } from 'viem';
import { fuse } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { entryPoint06Address } from 'viem/account-abstraction';
import { toEtherspotSmartAccount } from './etherspot_account';
import { pimlicoBundlerTransport } from './pimlico_bundler_transport';

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const PUBLIC_API_KEY = process.env.PUBLIC_API_KEY!;
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS as Address;
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY!;
const USE_ETHERSPOT = process.env.USE_ETHERSPOT !== 'false';

const PIMLICO_URL = `https://api.pimlico.io/v2/fuse/rpc?apikey=${PIMLICO_API_KEY}`;

interface TestResult {
    testName: string;
    passed: boolean;
    duration: number;
    error?: string;
}

const results: TestResult[] = [];

async function runTest(testName: string, testFn: () => Promise<void>) {
    const startTime = Date.now();
    try {
        await testFn();
        const duration = Date.now() - startTime;
        results.push({ testName, passed: true, duration });
        console.log(`✅ Test "${testName}" passed\n`);
    } catch (error: any) {
        const duration = Date.now() - startTime;
        results.push({
            testName,
            passed: false,
            duration,
            error: error.message || String(error),
        });
        console.log(`❌ Test "${testName}" failed`);
        console.log(`   ${error.message || error}\n`);
    }
}

async function main() {
    console.log('🚀 Starting Pimlico Tests\n');

    const owner = privateKeyToAccount(PRIVATE_KEY);

    const publicClient = createPublicClient({
        transport: http('https://rpc.fuse.io'),
        chain: fuse,
    });

    const pimlicoClient = createPimlicoClient({
        transport: pimlicoBundlerTransport(PIMLICO_URL, entryPoint06Address),
        entryPoint: {
            address: entryPoint06Address,
            version: '0.6',
        },
    });

    console.log('✅ Pimlico client created\n');

    await runTest('pimlico-gas-price', async () => {
        console.log('💰 Testing Pimlico gas price...');

        const gasPrice = await pimlicoClient.getUserOperationGasPrice();
        console.log(`   Gas Price (standard): ${gasPrice.standard.maxFeePerGas}`);

        if (!gasPrice.standard.maxFeePerGas) {
            throw new Error('Failed to get gas price from Pimlico');
        }
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

    console.log(`✅ Smart account created: ${smartAccount.address}\n`);

    await runTest('aa-authentication-test', async () => {
        console.log('🔐 Test: AA Authentication');
        console.log(`✅ Smart account created: ${smartAccount.address}`);
    });

    const smartAccountClient = createSmartAccountClient({
        account: smartAccount,
        chain: fuse,
        bundlerTransport: pimlicoBundlerTransport(PIMLICO_URL, entryPoint06Address),
        paymaster: {
            async getPaymasterStubData(userOperation: any) {
                const toHex = (value: any) => {
                    if (typeof value === 'bigint') return `0x${value.toString(16)}`;
                    if (typeof value === 'number') return `0x${value.toString(16)}`;
                    return value;
                };

                const cleanUserOp = {
                    sender: userOperation.sender,
                    nonce: toHex(userOperation.nonce),
                    initCode: userOperation.initCode || '0x',
                    callData: userOperation.callData,
                    callGasLimit: toHex(userOperation.callGasLimit || 100000n),
                    verificationGasLimit: toHex(userOperation.verificationGasLimit || 1000000n),
                    preVerificationGas: toHex(userOperation.preVerificationGas || 100000n),
                    maxFeePerGas: toHex(userOperation.maxFeePerGas || 1000000000n),
                    maxPriorityFeePerGas: toHex(userOperation.maxPriorityFeePerGas || 1000000000n),
                    paymasterAndData: '0x',
                    signature: '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c',
                };

                const result = await pimlicoClient.sponsorUserOperation({
                    userOperation: cleanUserOp as any,
                });

                return {
                    paymasterAndData: result.paymasterAndData,
                };
            },
            async getPaymasterData(userOperation: any) {
                const toHex = (value: any) => {
                    if (typeof value === 'bigint') return `0x${value.toString(16)}`;
                    if (typeof value === 'number') return `0x${value.toString(16)}`;
                    return value;
                };

                const cleanUserOp = {
                    sender: userOperation.sender,
                    nonce: toHex(userOperation.nonce),
                    initCode: userOperation.initCode || '0x',
                    callData: userOperation.callData,
                    callGasLimit: toHex(userOperation.callGasLimit),
                    verificationGasLimit: toHex(userOperation.verificationGasLimit),
                    preVerificationGas: toHex(userOperation.preVerificationGas),
                    maxFeePerGas: toHex(userOperation.maxFeePerGas),
                    maxPriorityFeePerGas: toHex(userOperation.maxPriorityFeePerGas),
                    paymasterAndData: '0x',
                    signature: userOperation.signature,
                };

                const result = await pimlicoClient.sponsorUserOperation({
                    userOperation: cleanUserOp as any,
                });

                return {
                    paymasterAndData: result.paymasterAndData,
                };
            },
        },
        userOperation: {
            estimateFeesPerGas: async () => {
                const gasPrice = await pimlicoClient.getUserOperationGasPrice();
                return {
                    maxFeePerGas: gasPrice.standard.maxFeePerGas,
                    maxPriorityFeePerGas: gasPrice.standard.maxPriorityFeePerGas,
                };
            },
        },
    } as any);

    console.log('✅ Smart account client created\n');

    await runTest('aa-native-token-transaction', async () => {
        console.log('💸 Test: Native Token Transaction');
        console.log(`📤 Sending native token from: ${smartAccount.address}`);

        const userOpHash = await smartAccountClient.sendUserOperation({
            account: smartAccount,
            calls: [{
                to: '0x0000000000000000000000000000000000000001',
                value: BigInt(1),
                data: '0x',
            }],
        });

        console.log(`⏳ Waiting for user operation: ${userOpHash}`);

        const receipt = await smartAccountClient.waitForUserOperationReceipt({
            hash: userOpHash,
        });

        console.log(`✅ Transaction confirmed: ${receipt.receipt.transactionHash}`);
    });

    console.log('⏸️  Waiting for nonce to update...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    await runTest('aa-erc20-token-transaction', async () => {
        console.log('🪙 Test: ERC-20 Token Transaction');
        console.log(`📤 Sending ERC-20 token from: ${smartAccount.address}`);

        const userOpHash = await smartAccountClient.sendUserOperation({
            account: smartAccount,
            calls: [
                {
                    to: TOKEN_ADDRESS,
                    value: 0n,
                    data: encodeFunctionData({
                        abi: [
                            {
                                type: 'function',
                                name: 'transfer',
                                inputs: [
                                    { name: 'to', type: 'address' },
                                    { name: 'amount', type: 'uint256' },
                                ],
                                outputs: [{ type: 'bool' }],
                            },
                        ],
                        functionName: 'transfer',
                        args: ['0x0000000000000000000000000000000000000001', BigInt(10000000)],
                    }),
                },
            ],
        });

        console.log(`⏳ Waiting for user operation: ${userOpHash}`);

        const receipt = await smartAccountClient.waitForUserOperationReceipt({
            hash: userOpHash,
        });

        console.log(`✅ Transaction confirmed: ${receipt.receipt.transactionHash}`);
    });

    console.log('\n════════════════════════════════════════════════════════════\n');
    console.log('📊 Test Summary:');
    console.log(`   ✅ Passed: ${results.filter((r) => r.passed).length}`);
    console.log(`   ❌ Failed: ${results.filter((r) => !r.passed).length}`);
    console.log(`   📈 Total: ${results.length}`);
    console.log('\n════════════════════════════════════════════════════════════');

    results.forEach((result) => {
        const status = result.passed ? '✅' : '❌';
        console.log(`${status} ${result.testName}: ${result.passed ? '1' : '0'} (${result.duration}ms)`);
    });

    process.exit(results.every((r) => r.passed) ? 0 : 1);
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

