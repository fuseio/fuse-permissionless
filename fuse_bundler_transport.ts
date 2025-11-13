import { type Transport, custom, type Address } from 'viem';

export function fuseBundlerTransport(
    bundlerUrl: string,
    entryPointAddress: Address
): Transport {
    return custom({
        async request({ method, params }) {
            let fixedParams = params;

            if (method === 'eth_sendUserOperation' && Array.isArray(params) && params.length >= 1) {
                const userOp = params[0];

                if (userOp && typeof userOp === 'object') {
                    const v06UserOp: any = { ...userOp };

                    if (!v06UserOp.maxFeePerGas || !v06UserOp.maxPriorityFeePerGas) {
                        v06UserOp.maxFeePerGas = v06UserOp.maxFeePerGas || '0x5f5e100';
                        v06UserOp.maxPriorityFeePerGas = v06UserOp.maxPriorityFeePerGas || '0x59682f00';
                    }

                    if ('paymaster' in v06UserOp || 'paymasterData' in v06UserOp) {
                        const paymaster = v06UserOp.paymaster || '';
                        const paymasterData = v06UserOp.paymasterData || '0x';
                        v06UserOp.paymasterAndData = paymaster + paymasterData.slice(2);

                        delete v06UserOp.paymaster;
                        delete v06UserOp.paymasterData;
                        delete v06UserOp.paymasterVerificationGasLimit;
                        delete v06UserOp.paymasterPostOpGasLimit;
                    }

                    if ('factory' in v06UserOp || 'factoryData' in v06UserOp) {
                        const factory = v06UserOp.factory || '';
                        const factoryData = v06UserOp.factoryData || '0x';
                        v06UserOp.initCode = factory ? factory + factoryData.slice(2) : '0x';

                        delete v06UserOp.factory;
                        delete v06UserOp.factoryData;
                    } else if (!('initCode' in v06UserOp)) {
                        v06UserOp.initCode = '0x';
                    }

                    fixedParams = [v06UserOp, entryPointAddress];
                } else {
                    fixedParams = [userOp, entryPointAddress];
                }
            } else if (method === 'eth_estimateUserOperationGas') {
                const userOp = Array.isArray(params) ? params[0] : null;
                return {
                    callGasLimit: userOp?.callGasLimit || '0x186A0',
                    verificationGasLimit: userOp?.verificationGasLimit || '0x186A0',
                    preVerificationGas: userOp?.preVerificationGas || '0x5208',
                };
            } else if ((method.startsWith('eth_') || method.startsWith('debug_')) &&
                Array.isArray(params) && (params.length === 1 || (params.length === 2 && !params[1]))) {
                fixedParams = [params[0], entryPointAddress];
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
        },
    });
}
