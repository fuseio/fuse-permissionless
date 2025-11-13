import {
  type Address,
  type Chain,
  type Client,
  type Hex,
  type Transport,
  concat,
  encodeFunctionData,
  getContractAddress,
  pad,
  toHex,
  keccak256,
  encodeAbiParameters,
} from 'viem';
import { getUserOperationHash } from 'viem/account-abstraction';
import { toAccount } from 'viem/accounts';
import { getChainId, readContract, signMessage } from 'viem/actions';
import type { PrivateKeyAccount } from 'viem/accounts';

type EntryPoint = any;
type GetEntryPointVersion<T> = any;
type SmartAccount<EP, N, T, C> = any;

const ETHERSPOT_WALLET_FACTORY = '0x7f6d8F107fE8551160BD5351d5F1514A6aD5d40E' as Address;

const factoryAbi = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    name: 'createAccount',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    name: 'getAddress',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const etherspotWalletAbi = [
  {
    inputs: [
      { name: 'dest', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'func', type: 'bytes' },
    ],
    name: 'execute',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'dest', type: 'address[]' },
      { name: 'value', type: 'uint256[]' },
      { name: 'func', type: 'bytes[]' },
    ],
    name: 'executeBatch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'hash', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    name: 'isValidSignature',
    outputs: [{ name: '', type: 'bytes4' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export type EtherspotSmartAccount<
  entryPoint extends EntryPoint,
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
> = SmartAccount<entryPoint, 'EtherspotSmartAccount', transport, chain>;

export async function toEtherspotSmartAccount<
  entryPoint extends EntryPoint,
  TTransport extends Transport = Transport,
  TChain extends Chain | undefined = Chain | undefined,
>(parameters: {
  client: Client<TTransport, TChain>;
  owner: PrivateKeyAccount;
  factoryAddress?: Address;
  salt?: bigint;
  entryPoint: {
    address: entryPoint;
    version: GetEntryPointVersion<entryPoint>;
  };
}): Promise<EtherspotSmartAccount<entryPoint, TTransport, TChain>> {
  const {
    client,
    owner,
    factoryAddress = ETHERSPOT_WALLET_FACTORY,
    salt = 0n,
    entryPoint: entryPointConfig,
  } = parameters;

  const accountAddress = await readContract(client, {
    address: factoryAddress,
    abi: factoryAbi,
    functionName: 'getAddress',
    args: [owner.address, salt],
  });

  console.log(`🔍 Etherspot Account Address: ${accountAddress}`);
  console.log(`   Owner: ${owner.address}`);
  console.log(`   Factory: ${factoryAddress}`);
  console.log(`   Salt: ${salt}`);

  const chainId = await getChainId(client);

  const account = toAccount({
    address: accountAddress,

    async signMessage({ message }) {
      return owner.signMessage({ message });
    },

    async signTransaction(_, __) {
      throw new Error('Smart account cannot sign transactions directly');
    },

    async signTypedData(typedData) {
      return owner.signTypedData(typedData);
    },
  });

  const getFactoryInitCode = async () => {
    return concat([
      factoryAddress,
      encodeFunctionData({
        abi: factoryAbi,
        functionName: 'createAccount',
        args: [owner.address, salt],
      }),
    ]);
  };

  return {
    ...account,
    client,
    publicKey: accountAddress,
    entryPoint: entryPointConfig.address as Address,
    source: 'EtherspotSmartAccount',

    async getNonce() {
      return readContract(client, {
        address: entryPointConfig.address as Address,
        abi: [
          {
            inputs: [
              { name: 'sender', type: 'address' },
              { name: 'key', type: 'uint192' },
            ],
            name: 'getNonce',
            outputs: [{ name: 'nonce', type: 'uint256' }],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        functionName: 'getNonce',
        args: [accountAddress, 0n],
      });
    },

    async signUserOperation(userOperation: any) {
      const gasPrice = userOperation.maxFeePerGas && userOperation.maxPriorityFeePerGas
        ? { maxFeePerGas: userOperation.maxFeePerGas, maxPriorityFeePerGas: userOperation.maxPriorityFeePerGas }
        : await (client as any).estimateFeesPerGas();

      const v06UserOp: any = { ...userOperation };

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

      const hash = getUserOperationHash({
        userOperation: {
          ...v06UserOp,
          sender: v06UserOp.sender || accountAddress,
          maxFeePerGas: gasPrice.maxFeePerGas,
          maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas || 1000000000n,
          signature: '0x',
        },
        entryPointAddress: entryPointConfig.address as Address,
        entryPointVersion: entryPointConfig.version as any,
        chainId: await getChainId(client),
      });

      const signature = await owner.signMessage({
        message: { raw: hash as Hex },
      });
      return signature;
    },

    async encodeCalls(calls: Array<{ to: Address; value?: bigint; data?: Hex }>) {
      if (calls.length === 1) {
        return encodeFunctionData({
          abi: etherspotWalletAbi,
          functionName: 'execute',
          args: [calls[0].to, calls[0].value || 0n, calls[0].data || '0x'],
        });
      }

      return encodeFunctionData({
        abi: etherspotWalletAbi,
        functionName: 'executeBatch',
        args: [
          calls.map((c: { to: Address }) => c.to),
          calls.map((c: { value?: bigint }) => c.value || 0n),
          calls.map((c: { data?: Hex }) => c.data || '0x'),
        ],
      });
    },

    async getInitCode() {
      const code = await (client as any).getBytecode({ address: accountAddress });

      if (code && code !== '0x') {
        return '0x' as Hex;
      }

      return concat([
        factoryAddress,
        encodeFunctionData({
          abi: factoryAbi,
          functionName: 'createAccount',
          args: [owner.address, salt],
        }),
      ]);
    },

    async getFactoryArgs() {
      const code = await (client as any).getBytecode({ address: accountAddress });

      if (code && code !== '0x' && code.length > 2) {
        return {
          factory: undefined,
          factoryData: undefined,
        };
      }

      return {
        factory: factoryAddress,
        factoryData: encodeFunctionData({
          abi: factoryAbi,
          functionName: 'createAccount',
          args: [owner.address, salt],
        }),
      };
    },

    async getFactory() {
      return this.getFactoryArgs();
    },

    async getStubSignature() {
      return '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c' as Hex;
    },
  } as EtherspotSmartAccount<entryPoint, TTransport, TChain>;
}
