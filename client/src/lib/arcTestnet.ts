import { createPublicClient, createWalletClient, custom, defineChain, http, isAddress, keccak256, parseAbi, parseUnits, stringToHex, type Address, type Hex } from "viem";

const browserProvider = () => typeof window === "undefined" ? undefined : (window as Window & { ethereum?: unknown }).ethereum;

export const hankaArcTestnet = defineChain({
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.io"], webSocket: ["wss://rpc.testnet.arc.io"] } },
  blockExplorers: { default: { name: "ArcScan", url: "https://testnet.arcscan.app" } },
  testnet: true,
});

export const ARC_TESTNET_TOKENS = [
  { symbol: "USDC", name: "USDC", address: "0x3600000000000000000000000000000000000000", decimals: 6 },
  { symbol: "EURC", name: "EURC", address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", decimals: 6 },
  { symbol: "cirBTC", name: "Circle Wrapped Bitcoin", address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF" },
] as const satisfies ReadonlyArray<{ symbol: string; name: string; address: Address; decimals?: number }>;

const erc20Abi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
]);

const escrowAbi = parseAbi([
  "function createPointExchange(address token, address taker, uint128 collateral, uint64 acceptDeadline, uint64 settlementDeadline, bytes32 termsHash) returns (uint256)",
  "function acceptPointExchange(uint256 id)",
  "function approvePointExchangeSettlement(uint256 id, bytes32 settlementHash, uint128 makerPayout, uint128 takerPayout)",
  "function declinePointExchange(uint256 id)",
  "function disputePointExchange(uint256 id)",
  "function createTask(address token, uint128 reward, uint64 acceptDeadline, uint64 dueAt, bytes32 termsHash) returns (uint256)",
  "function acceptTask(uint256 id)",
  "function submitTask(uint256 id, bytes32 deliveryHash)",
  "function approveTask(uint256 id)",
  "function disputeTask(uint256 id)",
  "function pointExchangeToken(uint256 id) view returns (address)",
  "function taskToken(uint256 id) view returns (address)",
]);

export type ArcTokenSymbol = (typeof ARC_TESTNET_TOKENS)[number]["symbol"];
export type ArcWalletState = { address: Address; chainId: number };
export const getArcEscrowAddress = (): Address | null => {
  const value = import.meta.env.VITE_ARC_TESTNET_ESCROW_ADDRESS?.trim();
  return value && isAddress(value) ? value : null;
};
export const arcExplorerTx = (hash: Hex) => `https://testnet.arcscan.app/tx/${hash}`;

function providerOrThrow() {
  const provider = browserProvider();
  if (!provider) throw new Error("No EVM wallet found. Install or open HANKA in MetaMask, Rabby, Coinbase Wallet, or another EVM wallet.");
  return provider as Parameters<typeof custom>[0];
}

async function ensureArcChain(provider: Parameters<typeof custom>[0]) {
  const walletClient = createWalletClient({ chain: hankaArcTestnet, transport: custom(provider) });
  const currentChainId = await walletClient.getChainId();
  if (currentChainId === hankaArcTestnet.id) return walletClient;
  try {
    await walletClient.switchChain({ id: hankaArcTestnet.id });
  } catch (error: any) {
    if (error?.code !== 4902 && error?.cause?.code !== 4902) throw error;
    await walletClient.addChain({ chain: hankaArcTestnet });
    await walletClient.switchChain({ id: hankaArcTestnet.id });
  }
  return walletClient;
}

export async function connectArcWallet(): Promise<ArcWalletState> {
  const provider = providerOrThrow();
  const walletClient = await ensureArcChain(provider);
  const accounts = await walletClient.requestAddresses();
  const address = accounts[0];
  if (!address) throw new Error("The wallet did not return an EVM account.");
  return { address, chainId: await walletClient.getChainId() };
}

export const tokenFor = (symbol: ArcTokenSymbol) => ARC_TESTNET_TOKENS.find(token => token.symbol === symbol)!;
export async function getArcTokenDecimals(token: Address): Promise<number> {
  const decimals = await createPublicClient({ chain: hankaArcTestnet, transport: http() }).readContract({ address: token, abi: erc20Abi, functionName: "decimals" });
  return Number(decimals);
}
export const toTokenUnits = (value: string, decimals: number): bigint => {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error("Enter a valid positive token amount.");
  const [, fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) throw new Error(`This token supports at most ${decimals} decimal places.`);
  const units = parseUnits(trimmed, decimals);
  if (units <= BigInt(0)) throw new Error("Enter an amount above zero.");
  return units;
};
export const hashArcTerms = (terms: string): Hex => {
  const normalized = terms.trim().replace(/\s+/g, " ");
  if (normalized.length < 8) throw new Error("Describe the agreement in at least eight characters before signing.");
  return keccak256(stringToHex(normalized));
};

async function walletAndAccount() {
  const provider = providerOrThrow();
  const walletClient = await ensureArcChain(provider);
  const accounts = await walletClient.requestAddresses();
  const account = accounts[0];
  if (!account) throw new Error("Connect an EVM wallet before approving a transaction.");
  return { walletClient, account };
}

export async function approveArcEscrow(token: Address, amount: bigint): Promise<Hex> {
  const escrow = getArcEscrowAddress();
  if (!escrow) throw new Error("HANKA Arc Testnet escrow is not deployed yet. Add the verified public contract address first.");
  const { walletClient, account } = await walletAndAccount();
  const hash = await walletClient.writeContract({ address: token, abi: erc20Abi, functionName: "approve", args: [escrow, amount], account });
  await createPublicClient({ chain: hankaArcTestnet, transport: http() }).waitForTransactionReceipt({ hash });
  return hash;
}

type PointExchangeInput = { token: Address; taker: Address; collateral: bigint; acceptDeadline: number; settlementDeadline: number; terms: string };
type TaskInput = { token: Address; reward: bigint; acceptDeadline: number; dueAt: number; terms: string };

export async function createArcPointExchange(input: PointExchangeInput): Promise<Hex> {
  const escrow = getArcEscrowAddress();
  if (!escrow) throw new Error("HANKA Arc Testnet escrow is not deployed yet.");
  if (!isAddress(input.taker)) throw new Error("Enter a valid counterparty EVM address.");
  const { walletClient, account } = await walletAndAccount();
  return walletClient.writeContract({ address: escrow, abi: escrowAbi, functionName: "createPointExchange", args: [input.token, input.taker, input.collateral, BigInt(input.acceptDeadline), BigInt(input.settlementDeadline), hashArcTerms(input.terms)], account });
}

export async function createArcTask(input: TaskInput): Promise<Hex> {
  const escrow = getArcEscrowAddress();
  if (!escrow) throw new Error("HANKA Arc Testnet escrow is not deployed yet.");
  const { walletClient, account } = await walletAndAccount();
  return walletClient.writeContract({ address: escrow, abi: escrowAbi, functionName: "createTask", args: [input.token, input.reward, BigInt(input.acceptDeadline), BigInt(input.dueAt), hashArcTerms(input.terms)], account });
}

export async function getArcPointExchangeToken(id: bigint): Promise<Address> {
  const escrow = getArcEscrowAddress();
  if (!escrow) throw new Error("HANKA Arc Testnet escrow is not deployed yet.");
  return createPublicClient({ chain: hankaArcTestnet, transport: http() }).readContract({ address: escrow, abi: escrowAbi, functionName: "pointExchangeToken", args: [id] });
}

async function submitEscrowAction(functionName: "acceptPointExchange" | "approvePointExchangeSettlement" | "declinePointExchange" | "disputePointExchange" | "acceptTask" | "submitTask" | "approveTask" | "disputeTask", args: readonly unknown[]): Promise<Hex> {
  const escrow = getArcEscrowAddress();
  if (!escrow) throw new Error("HANKA Arc Testnet escrow is not deployed yet.");
  const { walletClient, account } = await walletAndAccount();
  return walletClient.writeContract({ address: escrow, abi: escrowAbi, functionName, args: args as never, account });
}

export const acceptArcPointExchange = (id: bigint) => submitEscrowAction("acceptPointExchange", [id]);
export const declineArcPointExchange = (id: bigint) => submitEscrowAction("declinePointExchange", [id]);
export const disputeArcPointExchange = (id: bigint) => submitEscrowAction("disputePointExchange", [id]);
export const approveArcPointExchangeSettlement = (id: bigint, settlementTerms: string, makerPayout: bigint, takerPayout: bigint) => submitEscrowAction("approvePointExchangeSettlement", [id, hashArcTerms(settlementTerms), makerPayout, takerPayout]);
export const acceptArcTask = (id: bigint) => submitEscrowAction("acceptTask", [id]);
export const submitArcTask = (id: bigint, deliveryTerms: string) => submitEscrowAction("submitTask", [id, hashArcTerms(deliveryTerms)]);
export const approveArcTask = (id: bigint) => submitEscrowAction("approveTask", [id]);
export const disputeArcTask = (id: bigint) => submitEscrowAction("disputeTask", [id]);
