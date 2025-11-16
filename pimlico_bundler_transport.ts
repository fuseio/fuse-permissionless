import { type Transport, type Address, custom } from 'viem';

export function pimlicoBundlerTransport(
    bundlerUrl: string,
    entryPointAddress: Address
): Transport {
    return custom({
        request: async ({ method, params }) => {
            if (method === 'eth_estimateUserOperationGas') {
                const fixedParams = params ? [...params as any[]] : [];
                
                if (fixedParams[0]) {
                    const userOp = fixedParams[0];
                    
                    if (!userOp.initCode) {
                        if (userOp.factory && userOp.factoryData) {
                            userOp.initCode = userOp.factory + userOp.factoryData.slice(2);
                        } else {
                            userOp.initCode = '0x';
                        }
                        delete userOp.factory;
                        delete userOp.factoryData;
                    }
                    
                    if (!userOp.maxFeePerGas || userOp.maxFeePerGas === 0n || userOp.maxFeePerGas === '0x0') {
                        userOp.maxFeePerGas = '0x3b9aca00';
                    }
                    if (!userOp.maxPriorityFeePerGas || userOp.maxPriorityFeePerGas === 0n || userOp.maxPriorityFeePerGas === '0x0') {
                        userOp.maxPriorityFeePerGas = '0x3b9aca00';
                    }
                }
                
                if (fixedParams[1] === null || fixedParams[1] === undefined) {
                    fixedParams[1] = entryPointAddress;
                }
                
                const response = await fetch(bundlerUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method,
                        params: fixedParams,
                    }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }

                const data = await response.json() as {
                    error?: { code: number; message: string };
                    result?: any;
                };

                if (data.error) {
                    throw new Error(`RPC Error: ${JSON.stringify(data.error)}`);
                }

                return data.result;
            }

            if (method === 'pm_getPaymasterStubData' || method === 'pm_getPaymasterData' || method === 'pm_sponsorUserOperation') {
                const fixedParams = params ? [...params as any[]] : [];
                
                if (fixedParams[0]) {
                    const userOp = fixedParams[0];
                    
                    if (!userOp.initCode) {
                        if (userOp.factory && userOp.factoryData) {
                            userOp.initCode = userOp.factory + userOp.factoryData.slice(2);
                        } else {
                            userOp.initCode = '0x';
                        }
                        delete userOp.factory;
                        delete userOp.factoryData;
                    }
                    
                    if (!userOp.maxFeePerGas || userOp.maxFeePerGas === 0n || userOp.maxFeePerGas === '0x0') {
                        userOp.maxFeePerGas = '0x3b9aca00';
                    }
                    if (!userOp.maxPriorityFeePerGas || userOp.maxPriorityFeePerGas === 0n || userOp.maxPriorityFeePerGas === '0x0') {
                        userOp.maxPriorityFeePerGas = '0x3b9aca00';
                    }
                }
                
                if (method === 'pm_sponsorUserOperation') {
                    while (fixedParams.length < 2) {
                        fixedParams.push({});
                    }
                    if (!fixedParams[1] || fixedParams[1] === null || Object.keys(fixedParams[1]).length === 0) {
                        fixedParams[1] = {};
                    }
                } else if (fixedParams[1] === null || fixedParams[1] === undefined) {
                    fixedParams[1] = entryPointAddress;
                }
                
                const response = await fetch(bundlerUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method,
                        params: fixedParams,
                    }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }

                const data = await response.json() as {
                    error?: { code: number; message: string };
                    result?: any;
                };

                if (data.error) {
                    throw new Error(`RPC Error: ${JSON.stringify(data.error)}`);
                }

                return data.result;
            }

            if (method === 'eth_sendUserOperation') {
                const fixedParams = params ? [...params as any[]] : [];
                
                if (fixedParams[0]) {
                    const userOp = fixedParams[0];
                    
                    if (!userOp.initCode) {
                        if (userOp.factory && userOp.factoryData) {
                            userOp.initCode = userOp.factory + userOp.factoryData.slice(2);
                        } else {
                            userOp.initCode = '0x';
                        }
                        delete userOp.factory;
                        delete userOp.factoryData;
                    }
                    
                    if (!userOp.paymasterAndData || userOp.paymasterAndData === '0x') {
                        if (userOp.paymaster && userOp.paymasterData) {
                            userOp.paymasterAndData = userOp.paymaster + userOp.paymasterData.slice(2);
                        } else {
                            userOp.paymasterAndData = '0x';
                        }
                    }
                    delete userOp.paymaster;
                    delete userOp.paymasterData;
                    delete userOp.paymasterVerificationGasLimit;
                    delete userOp.paymasterPostOpGasLimit;
                    
                    if (!userOp.maxFeePerGas || userOp.maxFeePerGas === 0n || userOp.maxFeePerGas === '0x0') {
                        userOp.maxFeePerGas = '0x3b9aca00';
                    }
                    if (!userOp.maxPriorityFeePerGas || userOp.maxPriorityFeePerGas === 0n || userOp.maxPriorityFeePerGas === '0x0') {
                        userOp.maxPriorityFeePerGas = '0x3b9aca00';
                    }
                }
                
                if (fixedParams[1] === null || fixedParams[1] === undefined) {
                    fixedParams[1] = entryPointAddress;
                }
                
                const response = await fetch(bundlerUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method,
                        params: fixedParams,
                    }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }

                const data = await response.json() as {
                    error?: { code: number; message: string };
                    result?: any;
                };

                if (data.error) {
                    throw new Error(`RPC Error: ${JSON.stringify(data.error)}`);
                }

                return data.result;
            }

            const response = await fetch(bundlerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method,
                    params: params || [],
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }

            const data = await response.json() as {
                error?: { code: number; message: string };
                result?: any;
            };

            if (data.error) {
                throw new Error(`RPC Error: ${JSON.stringify(data.error)}`);
            }

            return data.result;
        },
    });
}
