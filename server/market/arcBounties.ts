import { and, eq, inArray, or } from "drizzle-orm";
import { createPublicClient, http, isAddress, keccak256, parseAbi, stringToHex, type Address, type Hex } from "viem";
import { arcSocialBounties, arcSocialBountySources, sourceBans } from "../../drizzle/schema";
import { buildArcSocialBountyTerms, normalizeArcHandle, normalizeArcTermsText, type ArcSocialBountyTermsInput } from "../../shared/arcBountyTerms";
import { getDb } from "../db";

const ARC_RPC_URL = "https://rpc.testnet.arc.io";
const ESCROW_READ_ABI = parseAbi([
  "function tasks(uint256 id) view returns (address requester, address taker, address token, uint128 reward, uint64 acceptDeadline, uint64 dueAt, bytes32 termsHash, bytes32 deliveryHash, uint8 state)",
]);

type OnchainTask = readonly [Address, Address, Address, bigint, bigint, bigint, Hex, Hex, number];
type SocialBountyRegistration = ArcSocialBountyTermsInput & {
  contractAddress: string;
  taskId: number;
  requesterWallet: string;
};

function dbOrThrow() {
  return getDb().then(db => {
    if (!db) throw new Error("Database is unavailable");
    return db;
  });
}

function sameAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

function hashTerms(terms: string) {
  return keccak256(stringToHex(normalizeArcTermsText(terms)));
}

async function readTask(contractAddress: string, taskId: number) {
  if (!isAddress(contractAddress)) throw new Error("Enter a valid Arc escrow contract address.");
  if (!Number.isSafeInteger(taskId) || taskId < 1) throw new Error("Enter a valid onchain Bounty ID.");
  return createPublicClient({ transport: http(ARC_RPC_URL) }).readContract({
    address: contractAddress,
    abi: ESCROW_READ_ABI,
    functionName: "tasks",
    args: [BigInt(taskId)],
  }) as Promise<OnchainTask>;
}

async function assertRequesterOwnsSocialBounty(input: SocialBountyRegistration) {
  if (!isAddress(input.requesterWallet)) throw new Error("Connect a valid Arc EVM wallet.");
  const task = await readTask(input.contractAddress, input.taskId);
  if (!sameAddress(task[0], input.requesterWallet)) throw new Error("Only the onchain Bounty requester can publish its social-proof details.");
  if (task[8] === 0 || task[8] === 6) throw new Error("This onchain Bounty is not active.");
  const canonicalTerms = buildArcSocialBountyTerms(input);
  if (task[6].toLowerCase() !== hashTerms(canonicalTerms).toLowerCase()) {
    throw new Error("The social-proof details do not match this Bounty's onchain terms commitment.");
  }
  return { task, canonicalTerms };
}

export async function listArcSocialBountyMetadata(contractAddress: string) {
  const db = await getDb();
  if (!db || !isAddress(contractAddress)) return [];
  const rows = await db
    .select({
      taskId: arcSocialBounties.taskId,
      requesterWallet: arcSocialBounties.requesterWallet,
      projectSlug: arcSocialBounties.projectSlug,
      instrument: arcSocialBounties.instrument,
      targetHandle: arcSocialBounties.targetHandle,
      proofDetail: arcSocialBounties.proofDetail,
      spaceMinutes: arcSocialBounties.spaceMinutes,
      retentionDays: arcSocialBounties.retentionDays,
      termsHash: arcSocialBounties.termsHash,
      sourceHandle: arcSocialBountySources.sourceHandle,
      takerWallet: arcSocialBountySources.takerWallet,
      pointsPerUnit: arcSocialBountySources.pointsPerUnit,
      followerCount: arcSocialBountySources.followerCount,
      ethosScore: arcSocialBountySources.ethosScore,
      kaitoScore: arcSocialBountySources.kaitoScore,
      kaitoAura: arcSocialBountySources.kaitoAura,
    })
    .from(arcSocialBounties)
    .leftJoin(arcSocialBountySources, and(
      eq(arcSocialBounties.contractAddress, arcSocialBountySources.contractAddress),
      eq(arcSocialBounties.taskId, arcSocialBountySources.taskId),
    ))
    .where(eq(arcSocialBounties.contractAddress, contractAddress.toLowerCase()));
  return rows;
}

export async function registerArcSocialBounty(input: SocialBountyRegistration) {
  const db = await dbOrThrow();
  const { task } = await assertRequesterOwnsSocialBounty(input);
  const contractAddress = input.contractAddress.toLowerCase();
  const normalizedTarget = normalizeArcHandle(input.targetHandle);
  await db.insert(arcSocialBounties).values({
    contractAddress,
    taskId: input.taskId,
    requesterWallet: input.requesterWallet.toLowerCase(),
    projectSlug: normalizeArcTermsText(input.projectSlug).toLowerCase(),
    instrument: input.instrument,
    targetHandle: normalizedTarget,
    proofDetail: normalizeArcTermsText(input.proofDetail ?? "") || null,
    spaceMinutes: input.spaceMinutes ?? null,
    retentionDays: input.retentionDays,
    termsHash: task[6].toLowerCase(),
  }).onConflictDoNothing();
  return { taskId: input.taskId, termsHash: task[6] };
}

export async function assertArcSocialSourceAvailable(input: { contractAddress: string; taskId: number; takerWallet: string; sourceHandle: string }) {
  if (!isAddress(input.takerWallet)) throw new Error("Connect a valid Arc EVM wallet.");
  const db = await dbOrThrow();
  const task = await readTask(input.contractAddress, input.taskId);
  if (task[8] !== 1) throw new Error("This Bounty is no longer open for acceptance.");
  const sourceHandle = normalizeArcHandle(input.sourceHandle);
  const restriction = (await db.select({ id: sourceBans.id }).from(sourceBans).where(or(
    eq(sourceBans.sourceHandle, sourceHandle),
    eq(sourceBans.sellerWallet, input.takerWallet.toLowerCase()),
  )).limit(1))[0];
  if (restriction) throw new Error("This source is restricted from new HANKA Bounties.");
  return { sourceHandle };
}

export async function registerArcSocialBountySource(input: {
  contractAddress: string;
  taskId: number;
  takerWallet: string;
  sourceHandle: string;
  pointsPerUnit: number;
  followerCount?: number;
  ethosScore?: number;
  kaitoScore?: number;
  kaitoAura?: number;
}) {
  const db = await dbOrThrow();
  if (!isAddress(input.takerWallet)) throw new Error("Connect a valid Arc EVM wallet.");
  const task = await readTask(input.contractAddress, input.taskId);
  if (!sameAddress(task[1], input.takerWallet)) throw new Error("Only the onchain Bounty taker can attach a source profile.");
  if (![2, 3, 4, 5].includes(task[8])) throw new Error("The Bounty has not been accepted onchain.");
  const sourceHandle = normalizeArcHandle(input.sourceHandle);
  const restriction = (await db.select({ id: sourceBans.id }).from(sourceBans).where(or(
    eq(sourceBans.sourceHandle, sourceHandle),
    eq(sourceBans.sellerWallet, input.takerWallet.toLowerCase()),
  )).limit(1))[0];
  if (restriction) throw new Error("This source is restricted from HANKA Bounties.");
  await db.insert(arcSocialBountySources).values({
    contractAddress: input.contractAddress.toLowerCase(),
    taskId: input.taskId,
    takerWallet: input.takerWallet.toLowerCase(),
    sourceHandle,
    pointsPerUnit: input.pointsPerUnit,
    followerCount: input.followerCount,
    ethosScore: input.ethosScore,
    kaitoScore: input.kaitoScore,
    kaitoAura: input.kaitoAura,
  }).onConflictDoNothing();
  return { taskId: input.taskId, sourceHandle };
}

export async function getArcSocialBountiesForTasks(contractAddress: string, taskIds: number[]) {
  const db = await getDb();
  if (!db || !isAddress(contractAddress) || !taskIds.length) return [];
  return db.select().from(arcSocialBounties).where(and(
    eq(arcSocialBounties.contractAddress, contractAddress.toLowerCase()),
    inArray(arcSocialBounties.taskId, taskIds),
  ));
}
