import { createPublicClient, createWalletClient, custom, defineChain, http, isAddress, keccak256, parseAbi, parseEventLogs, parseUnits, stringToHex, type Address, type Hex } from "viem";

export type ArcEip1193Provider = Parameters<typeof custom>[0] & {
  isMetaMask?: boolean;
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
  providers?: ArcEip1193Provider[];
};

type Eip6963Detail = {
  info: { uuid: string; name: string; icon?: string };
  provider: ArcEip1193Provider;
};

export type ArcWalletProvider = {
  id: string;
  name: string;
  provider: ArcEip1193Provider;
};

const browserProvider = () => typeof window === "undefined" ? undefined : (window as Window & { ethereum?: ArcEip1193Provider }).ethereum;

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
  "function pointExchangeCount() view returns (uint256)",
  "function taskCount() view returns (uint256)",
  "function pointExchanges(uint256 id) view returns (address maker, address taker, address token, uint128 collateral, uint64 acceptDeadline, uint64 settlementDeadline, bytes32 termsHash, bytes32 makerApprovalHash, bytes32 takerApprovalHash, uint8 state)",
  "function tasks(uint256 id) view returns (address requester, address taker, address token, uint128 reward, uint64 acceptDeadline, uint64 dueAt, bytes32 termsHash, bytes32 deliveryHash, uint8 state)",
  "event TaskCreated(uint256 indexed id, address indexed requester, address token, uint256 reward, uint64 acceptDeadline, uint64 dueAt, bytes32 termsHash)",
]);

export type ArcTokenSymbol = (typeof ARC_TESTNET_TOKENS)[number]["symbol"];
export type ArcWalletState = { address: Address; chainId: number };
export type ArcPointExchangeRecord = { id: bigint; maker: Address; taker: Address; token: Address; tokenDecimals: number; collateral: bigint; acceptDeadline: bigint; settlementDeadline: bigint; termsHash: Hex; state: number };
export type ArcTaskRecord = { id: bigint; requester: Address; taker: Address; token: Address; tokenDecimals: number; reward: bigint; acceptDeadline: bigint; dueAt: bigint; termsHash: Hex; deliveryHash: Hex; state: number };
export type ArcCreatedBounty = { hash: Hex; taskId: bigint; termsHash: Hex };
export type ArcWalletDashboard = { pointExchanges: ArcPointExchangeRecord[]; tasks: ArcTaskRecord[] };
export const ARC_POINT_EXCHANGE_STATES = ["Unknown", "Open", "Funded", "Disputed", "Settled", "Declined", "Cancelled"] as const;
export const ARC_TASK_STATES = ["Unknown", "Open", "Accepted", "Submitted", "Disputed", "Paid", "Cancelled"] as const;
export const getArcEscrowAddress = (): Address | null => {
  const value = import.meta.env.VITE_ARC_TESTNET_ESCROW_ADDRESS?.trim();
  return value && isAddress(value) ? value : null;
};
export const arcExplorerTx = (hash: Hex) => `https://testnet.arcscan.app/tx/${hash}`;

const providerName = (provider: ArcEip1193Provider) => {
  if (provider.isRabby) return "Rabby";
  if (provider.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider.isMetaMask) return "MetaMask";
  return "Browser wallet";
};

const dedupeProviders = (providers: ArcWalletProvider[]) => {
  const seen = new Set<ArcEip1193Provider>();
  return providers.filter(item => {
    if (seen.has(item.provider)) return false;
    seen.add(item.provider);
    return true;
  });
};

/**
 * Finds EIP-6963 wallets announced by the browser, with a safe fallback for
 * older injected wallets. Nothing is sent to a provider until the user chooses one.
 */
export async function listArcWalletProviders(): Promise<ArcWalletProvider[]> {
  if (typeof window === "undefined") return [];
  const announced = await new Promise<ArcWalletProvider[]>(resolve => {
    const discovered: ArcWalletProvider[] = [];
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<Eip6963Detail>).detail;
      if (!detail?.provider?.request || !detail.info?.uuid) return;
      discovered.push({ id: detail.info.uuid, name: detail.info.name || "EVM wallet", provider: detail.provider });
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    window.setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce as EventListener);
      resolve(discovered);
    }, 140);
  });
  const injected = browserProvider();
  const fallback = injected ? (injected.providers?.length ? injected.providers : [injected]).map((provider, index) => ({ id: `injected-${index}`, name: providerName(provider), provider })) : [];
  return dedupeProviders([...announced, ...fallback]);
}

function providerOrThrow(selected?: ArcEip1193Provider) {
  if (selected) return selected;
  const provider = browserProvider();
  if (!provider) throw new Error("No EVM wallet found. Install or open HANKA in MetaMask, Rabby, Coinbase Wallet, or another EVM wallet.");
  const candidates = provider.providers?.length ? provider.providers : [provider];
  return candidates.find(candidate => candidate.isRabby) ?? candidates.find(candidate => candidate.isMetaMask && !candidate.isCoinbaseWallet) ?? candidates.find(candidate => candidate.isCoinbaseWallet) ?? candidates[0];
}

async function ensureArcChain(provider: ArcEip1193Provider) {
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

export async function connectArcWallet(selected?: ArcEip1193Provider): Promise<ArcWalletState> {
  const provider = providerOrThrow(selected);
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

export async function signArcWalletMessage(message: string): Promise<Hex> {
  const { walletClient, account } = await walletAndAccount();
  return walletClient.signMessage({ account, message });
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

export async function createArcTask(input: TaskInput): Promise<ArcCreatedBounty> {
  const escrow = getArcEscrowAddress();
  if (!escrow) throw new Error("HANKA Arc Testnet escrow is not deployed yet.");
  const { walletClient, account } = await walletAndAccount();
  const termsHash = hashArcTerms(input.terms);
  const hash = await walletClient.writeContract({ address: escrow, abi: escrowAbi, functionName: "createTask", args: [input.token, input.reward, BigInt(input.acceptDeadline), BigInt(input.dueAt), termsHash], account });
  const receipt = await createPublicClient({ chain: hankaArcTestnet, transport: http() }).waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("The Bounty funding transaction did not complete.");
  const created = parseEventLogs({ abi: escrowAbi, logs: receipt.logs, eventName: "TaskCreated", strict: false })
    .find(event => event.address.toLowerCase() === escrow.toLowerCase());
  const taskId = created?.args.id;
  if (typeof taskId !== "bigint") throw new Error("The Bounty was funded but its onchain ID could not be confirmed.");
  return { hash, taskId, termsHash };
}

export async function getArcPointExchangeToken(id: bigint): Promise<Address> {
  const escrow = getArcEscrowAddress();
  if (!escrow) throw new Error("HANKA Arc Testnet escrow is not deployed yet.");
  return createPublicClient({ chain: hankaArcTestnet, transport: http() }).readContract({ address: escrow, abi: escrowAbi, functionName: "pointExchangeToken", args: [id] });
}

const walletMatches = (left: Address, right: Address) => left.toLowerCase() === right.toLowerCase();
const allRecordIds = (count: bigint) => Array.from({ length: Math.min(Number(count), 300) }, (_, index) => BigInt(index + 1));

/**
 * Small-scale Testnet discovery. It reads only public contract state and filters it to the connected wallet.
 * A production launch should replace bounded ID scanning with an indexed, verified event stream.
 */
export async function getArcWalletDashboard(wallet: Address): Promise<ArcWalletDashboard> {
  const escrow = getArcEscrowAddress();
  if (!escrow) throw new Error("HANKA Arc Testnet escrow is not deployed yet.");
  const publicClient = createPublicClient({ chain: hankaArcTestnet, transport: http() });
  const [pointCount, taskCount] = await Promise.all([
    publicClient.readContract({ address: escrow, abi: escrowAbi, functionName: "pointExchangeCount" }),
    publicClient.readContract({ address: escrow, abi: escrowAbi, functionName: "taskCount" }),
  ]);
  const [pointValues, taskValues] = await Promise.all([
    Promise.all(allRecordIds(pointCount).map(async id => ({ id, value: await publicClient.readContract({ address: escrow, abi: escrowAbi, functionName: "pointExchanges", args: [id] }) }))),
    Promise.all(allRecordIds(taskCount).map(async id => ({ id, value: await publicClient.readContract({ address: escrow, abi: escrowAbi, functionName: "tasks", args: [id] }) }))),
  ]);
  const tokenAddresses = Array.from(new Set([...pointValues.map(item => item.value[2]), ...taskValues.map(item => item.value[2])].map(token => token.toLowerCase())));
  const tokenDecimals = new Map(await Promise.all(tokenAddresses.map(async token => [token, await getArcTokenDecimals(token as Address)] as const)));
  const pointExchanges = pointValues.map(({ id, value }) => ({ id, maker: value[0], taker: value[1], token: value[2], tokenDecimals: tokenDecimals.get(value[2].toLowerCase()) ?? 6, collateral: value[3], acceptDeadline: value[4], settlementDeadline: value[5], termsHash: value[6], state: Number(value[9]) })).filter(record => walletMatches(record.maker, wallet) || walletMatches(record.taker, wallet));
  const tasks = taskValues.map(({ id, value }) => ({ id, requester: value[0], taker: value[1], token: value[2], tokenDecimals: tokenDecimals.get(value[2].toLowerCase()) ?? 6, reward: value[3], acceptDeadline: value[4], dueAt: value[5], termsHash: value[6], deliveryHash: value[7], state: Number(value[8]) })).filter(record => walletMatches(record.requester, wallet) || walletMatches(record.taker, wallet));
  return { pointExchanges: pointExchanges.sort((a, b) => Number(b.id - a.id)), tasks: tasks.sort((a, b) => Number(b.id - a.id)) };
}

/**
 * Testnet-only public bounty discovery. The contract stores a terms hash rather than task text,
 * so callers must render the hash as a commitment reference, never invent a bounty description.
 * A production market should replace this bounded scan with a verified event indexer.
 */
export async function getArcOpenBounties(): Promise<ArcTaskRecord[]> {
  const escrow = getArcEscrowAddress();
  if (!escrow) throw new Error("HANKA Arc Testnet escrow is not deployed yet.");
  const publicClient = createPublicClient({ chain: hankaArcTestnet, transport: http() });
  const taskCount = await publicClient.readContract({ address: escrow, abi: escrowAbi, functionName: "taskCount" });
  const values = await Promise.all(allRecordIds(taskCount).map(async id => ({
    id,
    value: await publicClient.readContract({ address: escrow, abi: escrowAbi, functionName: "tasks", args: [id] }),
  })));
  const tokenAddresses = Array.from(new Set(values.map(item => item.value[2].toLowerCase())));
  const decimals = new Map(await Promise.all(tokenAddresses.map(async token => [token, await getArcTokenDecimals(token as Address)] as const)));
  return values
    .map(({ id, value }) => ({ id, requester: value[0], taker: value[1], token: value[2], tokenDecimals: decimals.get(value[2].toLowerCase()) ?? 6, reward: value[3], acceptDeadline: value[4], dueAt: value[5], termsHash: value[6], deliveryHash: value[7], state: Number(value[8]) }))
    .filter(record => record.state === 1)
    .sort((left, right) => Number(right.id - left.id));
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
export async function approveArcTask(id: bigint) {
  const hash = await submitEscrowAction("approveTask", [id]);
  const receipt = await createPublicClient({ chain: hankaArcTestnet, transport: http() }).waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("The Bounty reward transaction did not complete.");
  return hash;
}
export const disputeArcTask = (id: bigint) => submitEscrowAction("disputeTask", [id]);
