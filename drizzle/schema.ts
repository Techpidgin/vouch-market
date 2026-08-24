import {
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const requestStatus = mysqlEnum("requestStatus", [
  "awaiting_payment",
  "open",
  "filled",
  "awaiting_review",
  "completed",
  "cancelled",
  "disputed",
]);

export const vouchBand = mysqlEnum("vouchBand", [
  "under_1k",
  "1k_5k",
  "5k_10k",
  "10k_25k",
  "5k_25k",
  "25k_50k",
  "50k_plus",
  "25k_plus",
]);

export const marketInstrument = mysqlEnum("marketInstrument", ["vouch", "slash"]);

export const marketProjects = mysqlTable(
  "marketProjects",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    isActive: int("isActive").notNull().default(1),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("marketProjects_slug_unique").on(table.slug)],
);

export const marketRequests = mysqlTable(
  "marketRequests",
  {
    id: int("id").autoincrement().primaryKey(),
    publicId: varchar("publicId", { length: 24 }).notNull(),
    buyerWallet: varchar("buyerWallet", { length: 64 }).notNull(),
    targetHandle: varchar("targetHandle", { length: 80 }).notNull(),
    projectSlug: varchar("projectSlug", { length: 64 }).notNull().default("commonsmade"),
    instrument: marketInstrument.notNull().default("vouch"),
    vouchBand: vouchBand,
    requestedQuantity: int("requestedQuantity").notNull(),
    filledQuantity: int("filledQuantity").notNull().default(0),
    pricePerVouch: decimal("pricePerVouch", { precision: 14, scale: 6 }).notNull(),
    totalUsdc: decimal("totalUsdc", { precision: 16, scale: 6 }).notNull(),
    platformFeeUsdc: decimal("platformFeeUsdc", { precision: 16, scale: 6 }).notNull().default("0.000000"),
    sellerNetUsdc: decimal("sellerNetUsdc", { precision: 16, scale: 6 }).notNull().default("0.000000"),
    paymentSignature: varchar("paymentSignature", { length: 128 }).unique(),
    paymentVerifiedAt: timestamp("paymentVerifiedAt"),
    status: requestStatus.notNull().default("awaiting_payment"),
    buyerMarkedDoneAt: timestamp("buyerMarkedDoneAt"),
    archiveEligibleAt: timestamp("archiveEligibleAt").notNull(),
    archivedAt: timestamp("archivedAt"),
    archiveSummary: text("archiveSummary"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("marketRequests_publicId_unique").on(table.publicId),
    index("marketRequests_status_createdAt_idx").on(table.status, table.createdAt),
    index("marketRequests_archiveEligibleAt_idx").on(table.archiveEligibleAt),
  ],
);

export const sellerCommitmentStatus = mysqlEnum("sellerCommitmentStatus", [
  "open",
  "awaiting_payment",
  "matched",
  "done",
  "under_review",
  "approved",
  "paid",
  "cancelled",
  "disputed",
]);

export const sellerCommitments = mysqlTable(
  "sellerCommitments",
  {
    id: int("id").autoincrement().primaryKey(),
    publicId: varchar("publicId", { length: 24 }).notNull(),
    requestId: int("requestId"),
    sellerWallet: varchar("sellerWallet", { length: 64 }).notNull(),
    profileHandle: varchar("profileHandle", { length: 80 }).notNull(),
    projectSlug: varchar("projectSlug", { length: 64 }).notNull().default("commonsmade"),
    instrument: marketInstrument.notNull().default("vouch"),
    vouchBand: vouchBand,
    quantity: int("quantity").notNull(),
    pricePerVouch: decimal("pricePerVouch", { precision: 14, scale: 6 }).notNull(),
    grossUsdc: decimal("grossUsdc", { precision: 16, scale: 6 }),
    platformFeeUsdc: decimal("platformFeeUsdc", { precision: 16, scale: 6 }),
    sellerNetUsdc: decimal("sellerNetUsdc", { precision: 16, scale: 6 }),
    buyerWallet: varchar("buyerWallet", { length: 64 }),
    paymentSignature: varchar("paymentSignature", { length: 128 }).unique(),
    paymentVerifiedAt: timestamp("paymentVerifiedAt"),
    buyerMarkedDoneAt: timestamp("buyerMarkedDoneAt"),
    status: sellerCommitmentStatus.notNull().default("open"),
    sellerMarkedDoneAt: timestamp("sellerMarkedDoneAt"),
    archiveEligibleAt: timestamp("archiveEligibleAt").notNull(),
    archivedAt: timestamp("archivedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("sellerCommitments_publicId_unique").on(table.publicId),
    index("sellerCommitments_requestId_status_idx").on(table.requestId, table.status),
    index("sellerCommitments_status_createdAt_idx").on(table.status, table.createdAt),
  ],
);

export const walletChallenges = mysqlTable(
  "walletChallenges",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    wallet: varchar("wallet", { length: 64 }).notNull(),
    action: varchar("action", { length: 48 }).notNull(),
    message: text("message").notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("walletChallenges_wallet_action_idx").on(table.wallet, table.action)],
);

export const activityLogs = mysqlTable(
  "activityLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    entityType: varchar("entityType", { length: 32 }).notNull(),
    entityPublicId: varchar("entityPublicId", { length: 24 }).notNull(),
    eventType: varchar("eventType", { length: 64 }).notNull(),
    actorWallet: varchar("actorWallet", { length: 64 }),
    actorAdminOpenId: varchar("actorAdminOpenId", { length: 64 }),
    detail: text("detail"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("activityLogs_entity_createdAt_idx").on(table.entityPublicId, table.createdAt)],
);

export const payoutStatus = mysqlEnum("payoutStatus", ["queued", "sent", "withheld"]);

export const paymentSignatureClaims = mysqlTable(
  "paymentSignatureClaims",
  {
    signature: varchar("signature", { length: 128 }).primaryKey(),
    entityType: varchar("entityType", { length: 32 }).notNull(),
    entityPublicId: varchar("entityPublicId", { length: 24 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("paymentSignatureClaims_entity_idx").on(table.entityPublicId)],
);

export const payoutRecords = mysqlTable(
  "payoutRecords",
  {
    id: int("id").autoincrement().primaryKey(),
    sellerCommitmentId: int("sellerCommitmentId").notNull(),
    recipientWallet: varchar("recipientWallet", { length: 64 }).notNull(),
    amountUsdc: decimal("amountUsdc", { precision: 16, scale: 6 }).notNull(),
    grossAmountUsdc: decimal("grossAmountUsdc", { precision: 16, scale: 6 }).notNull().default("0.000000"),
    platformFeeUsdc: decimal("platformFeeUsdc", { precision: 16, scale: 6 }).notNull().default("0.000000"),
    status: payoutStatus.notNull().default("queued"),
    externalReference: varchar("externalReference", { length: 160 }),
    adminNote: text("adminNote"),
    decidedByOpenId: varchar("decidedByOpenId", { length: 64 }).notNull(),
    decidedAt: timestamp("decidedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("payoutRecords_commitment_unique").on(table.sellerCommitmentId),
    index("payoutRecords_status_createdAt_idx").on(table.status, table.createdAt),
  ],
);

export type MarketRequest = typeof marketRequests.$inferSelect;
export type SellerCommitment = typeof sellerCommitments.$inferSelect;
