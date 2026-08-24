// server/_core/app.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { and, eq } from "drizzle-orm";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

// drizzle/schema.ts
import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/pg-core";
var utcTimestamp = (name) => timestamp(name, { withTimezone: true, mode: "date" });
var updatedTimestamp = () => utcTimestamp("updatedAt").defaultNow().notNull().$onUpdate(() => /* @__PURE__ */ new Date());
var userRole = pgEnum("user_role", ["user", "admin"]);
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRole("role").default("user").notNull(),
  createdAt: utcTimestamp("createdAt").defaultNow().notNull(),
  updatedAt: updatedTimestamp(),
  lastSignedIn: utcTimestamp("lastSignedIn").defaultNow().notNull()
});
var requestStatus = pgEnum("request_status", [
  "awaiting_payment",
  "open",
  "filled",
  "awaiting_review",
  "completed",
  "cancelled",
  "disputed"
]);
var vouchBand = pgEnum("vouch_band", [
  "under_1k",
  "1k_5k",
  "5k_10k",
  "10k_25k",
  "5k_25k",
  "25k_50k",
  "50k_plus",
  "25k_plus"
]);
var marketInstrument = pgEnum("market_instrument", ["vouch", "slash"]);
var sellerCommitmentStatus = pgEnum("seller_commitment_status", [
  "open",
  "awaiting_payment",
  "matched",
  "done",
  "under_review",
  "approved",
  "paid",
  "cancelled",
  "disputed"
]);
var payoutStatus = pgEnum("payout_status", ["queued", "sent", "withheld"]);
var marketProjects = pgTable(
  "marketProjects",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    isActive: boolean("isActive").notNull().default(true),
    createdAt: utcTimestamp("createdAt").defaultNow().notNull(),
    updatedAt: updatedTimestamp()
  },
  (table) => [uniqueIndex("marketProjects_slug_unique").on(table.slug)]
);
var marketRequests = pgTable(
  "marketRequests",
  {
    id: serial("id").primaryKey(),
    publicId: varchar("publicId", { length: 24 }).notNull(),
    buyerWallet: varchar("buyerWallet", { length: 64 }).notNull(),
    targetHandle: varchar("targetHandle", { length: 80 }).notNull(),
    projectSlug: varchar("projectSlug", { length: 64 }).notNull().default("commonsmade"),
    instrument: marketInstrument("instrument").notNull().default("vouch"),
    vouchBand: vouchBand("vouchBand"),
    requestedQuantity: integer("requestedQuantity").notNull(),
    filledQuantity: integer("filledQuantity").notNull().default(0),
    pricePerVouch: numeric("pricePerVouch", { precision: 14, scale: 6 }).notNull(),
    totalUsdc: numeric("totalUsdc", { precision: 16, scale: 6 }).notNull(),
    platformFeeUsdc: numeric("platformFeeUsdc", { precision: 16, scale: 6 }).notNull().default("0.000000"),
    sellerNetUsdc: numeric("sellerNetUsdc", { precision: 16, scale: 6 }).notNull().default("0.000000"),
    paymentSignature: varchar("paymentSignature", { length: 128 }).unique(),
    paymentVerifiedAt: utcTimestamp("paymentVerifiedAt"),
    status: requestStatus("status").notNull().default("awaiting_payment"),
    buyerMarkedDoneAt: utcTimestamp("buyerMarkedDoneAt"),
    archiveEligibleAt: utcTimestamp("archiveEligibleAt").notNull(),
    archivedAt: utcTimestamp("archivedAt"),
    archiveSummary: text("archiveSummary"),
    createdAt: utcTimestamp("createdAt").defaultNow().notNull(),
    updatedAt: updatedTimestamp()
  },
  (table) => [
    uniqueIndex("marketRequests_publicId_unique").on(table.publicId),
    index("marketRequests_status_createdAt_idx").on(table.status, table.createdAt),
    index("marketRequests_archiveEligibleAt_idx").on(table.archiveEligibleAt)
  ]
);
var sellerCommitments = pgTable(
  "sellerCommitments",
  {
    id: serial("id").primaryKey(),
    publicId: varchar("publicId", { length: 24 }).notNull(),
    requestId: integer("requestId"),
    parentOfferId: integer("parentOfferId"),
    sellerWallet: varchar("sellerWallet", { length: 64 }).notNull(),
    profileHandle: varchar("profileHandle", { length: 80 }).notNull(),
    sourceHandle: varchar("sourceHandle", { length: 80 }),
    targetHandle: varchar("targetHandle", { length: 80 }),
    allocationKey: varchar("allocationKey", { length: 255 }),
    projectSlug: varchar("projectSlug", { length: 64 }).notNull().default("commonsmade"),
    instrument: marketInstrument("instrument").notNull().default("vouch"),
    vouchBand: vouchBand("vouchBand"),
    quantity: integer("quantity").notNull(),
    pointsPerUnit: integer("pointsPerUnit"),
    pricePerVouch: numeric("pricePerVouch", { precision: 14, scale: 6 }).notNull(),
    grossUsdc: numeric("grossUsdc", { precision: 16, scale: 6 }),
    platformFeeUsdc: numeric("platformFeeUsdc", { precision: 16, scale: 6 }),
    sellerNetUsdc: numeric("sellerNetUsdc", { precision: 16, scale: 6 }),
    buyerWallet: varchar("buyerWallet", { length: 64 }),
    paymentSignature: varchar("paymentSignature", { length: 128 }).unique(),
    paymentVerifiedAt: utcTimestamp("paymentVerifiedAt"),
    buyerMarkedDoneAt: utcTimestamp("buyerMarkedDoneAt"),
    status: sellerCommitmentStatus("status").notNull().default("open"),
    sellerMarkedDoneAt: utcTimestamp("sellerMarkedDoneAt"),
    archiveEligibleAt: utcTimestamp("archiveEligibleAt").notNull(),
    archivedAt: utcTimestamp("archivedAt"),
    createdAt: utcTimestamp("createdAt").defaultNow().notNull(),
    updatedAt: updatedTimestamp()
  },
  (table) => [
    uniqueIndex("sellerCommitments_publicId_unique").on(table.publicId),
    uniqueIndex("sellerCommitments_allocationKey_unique").on(table.allocationKey),
    index("sellerCommitments_requestId_status_idx").on(table.requestId, table.status),
    index("sellerCommitments_parentOfferId_status_idx").on(table.parentOfferId, table.status),
    index("sellerCommitments_status_createdAt_idx").on(table.status, table.createdAt)
  ]
);
var walletChallenges = pgTable(
  "walletChallenges",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    wallet: varchar("wallet", { length: 64 }).notNull(),
    action: varchar("action", { length: 48 }).notNull(),
    message: text("message").notNull(),
    expiresAt: utcTimestamp("expiresAt").notNull(),
    usedAt: utcTimestamp("usedAt"),
    createdAt: utcTimestamp("createdAt").defaultNow().notNull()
  },
  (table) => [index("walletChallenges_wallet_action_idx").on(table.wallet, table.action)]
);
var activityLogs = pgTable(
  "activityLogs",
  {
    id: serial("id").primaryKey(),
    entityType: varchar("entityType", { length: 32 }).notNull(),
    entityPublicId: varchar("entityPublicId", { length: 24 }).notNull(),
    eventType: varchar("eventType", { length: 64 }).notNull(),
    actorWallet: varchar("actorWallet", { length: 64 }),
    actorAdminOpenId: varchar("actorAdminOpenId", { length: 64 }),
    detail: text("detail"),
    createdAt: utcTimestamp("createdAt").defaultNow().notNull()
  },
  (table) => [index("activityLogs_entity_createdAt_idx").on(table.entityPublicId, table.createdAt)]
);
var paymentSignatureClaims = pgTable(
  "paymentSignatureClaims",
  {
    signature: varchar("signature", { length: 128 }).primaryKey(),
    entityType: varchar("entityType", { length: 32 }).notNull(),
    entityPublicId: varchar("entityPublicId", { length: 24 }).notNull(),
    createdAt: utcTimestamp("createdAt").defaultNow().notNull()
  },
  (table) => [index("paymentSignatureClaims_entity_idx").on(table.entityPublicId)]
);
var payoutRecords = pgTable(
  "payoutRecords",
  {
    id: serial("id").primaryKey(),
    sellerCommitmentId: integer("sellerCommitmentId").notNull(),
    recipientWallet: varchar("recipientWallet", { length: 64 }).notNull(),
    amountUsdc: numeric("amountUsdc", { precision: 16, scale: 6 }).notNull(),
    grossAmountUsdc: numeric("grossAmountUsdc", { precision: 16, scale: 6 }).notNull().default("0.000000"),
    platformFeeUsdc: numeric("platformFeeUsdc", { precision: 16, scale: 6 }).notNull().default("0.000000"),
    status: payoutStatus("status").notNull().default("queued"),
    externalReference: varchar("externalReference", { length: 160 }),
    adminNote: text("adminNote"),
    decidedByOpenId: varchar("decidedByOpenId", { length: 64 }).notNull(),
    decidedAt: utcTimestamp("decidedAt").defaultNow().notNull(),
    createdAt: utcTimestamp("createdAt").defaultNow().notNull(),
    updatedAt: updatedTimestamp()
  },
  (table) => [
    uniqueIndex("payoutRecords_commitment_unique").on(table.sellerCommitmentId),
    index("payoutRecords_status_createdAt_idx").on(table.status, table.createdAt)
  ]
);

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  solanaRpcUrl: process.env.SOLANA_RPC_URL ?? "",
  solanaRecipientWallet: process.env.SOLANA_RECIPIENT_WALLET ?? ""
};

// server/db.ts
var database = null;
function databaseUrl(env = process.env) {
  return env.DATABASE_URL ?? env.POSTGRES_URL ?? "";
}
function isNeonPostgresUrl(value) {
  return /^postgres(?:ql)?:\/\//i.test(value);
}
async function getDb() {
  if (database) return database;
  const url = databaseUrl();
  if (!isNeonPostgresUrl(url)) {
    console.warn("[Database] A Neon PostgreSQL DATABASE_URL is required; the fresh market database is not configured");
    return null;
  }
  neonConfig.webSocketConstructor = ws;
  neonConfig.poolQueryViaFetch = true;
  const pool = new Pool({ connectionString: url });
  database = drizzle({ client: pool });
  return database;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  const values = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? /* @__PURE__ */ new Date() };
  const updateSet = { lastSignedIn: values.lastSignedIn };
  for (const field of ["name", "email", "loginMethod"]) {
    if (user[field] !== void 0) {
      values[field] = user[field];
      updateSet[field] = user[field];
    }
  }
  if (user.role) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(and(eq(users.openId, openId))).limit(1);
  return result[0];
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";

// server/security/rateLimit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis as Redis2 } from "@upstash/redis";

// server/market/compactState.ts
import { Redis } from "@upstash/redis";
var PUBLIC_BOARD_KEY = "vouch-market:public-board:v1";
var PUBLIC_BOARD_TTL_SECONDS = 45;
var redis;
function upstashCredentials(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}
function getRedis() {
  if (redis !== void 0) return redis;
  const credentials = upstashCredentials();
  if (!credentials) {
    redis = null;
    return redis;
  }
  redis = new Redis({
    url: credentials.url,
    token: credentials.token
  });
  return redis;
}
async function getCachedPublicBoard(loader) {
  const client = getRedis();
  if (!client) return loader();
  try {
    const cached = await client.get(PUBLIC_BOARD_KEY);
    if (cached) return cached;
    const fresh = await loader();
    await client.set(PUBLIC_BOARD_KEY, fresh, { ex: PUBLIC_BOARD_TTL_SECONDS });
    return fresh;
  } catch (error) {
    console.warn("[Upstash] Public board cache unavailable; falling back to database", error);
    return loader();
  }
}
async function invalidatePublicBoardCache() {
  const client = getRedis();
  if (!client) return;
  try {
    await client.del(PUBLIC_BOARD_KEY);
  } catch (error) {
    console.warn("[Upstash] Public board invalidation skipped", error);
  }
}

// server/security/rateLimit.ts
var limiter;
function getLimiter() {
  if (limiter !== void 0) return limiter;
  const credentials = upstashCredentials();
  if (!credentials) {
    limiter = null;
    return limiter;
  }
  limiter = new Ratelimit({
    redis: new Redis2(credentials),
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "vouch-market:public-mutation",
    analytics: false
  });
  return limiter;
}
function clientRateLimitKey(headers, fallbackIp) {
  const forwarded = headers["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return `ip:${(firstForwarded ?? fallbackIp ?? "unknown").trim()}`;
}
async function enforcePublicMutationRateLimit(identifier) {
  const activeLimiter = getLimiter();
  if (!activeLimiter) return;
  const result = await activeLimiter.limit(identifier);
  if (!result.success) throw new Error("Too many marketplace actions. Please wait a moment and try again.");
}

// server/_core/trpc.ts
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var rateLimitedPublicProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    try {
      await enforcePublicMutationRateLimit(clientRateLimitKey(ctx.req.headers, ctx.req.ip));
    } catch (error) {
      throw new TRPCError2({ code: "TOO_MANY_REQUESTS", message: error instanceof Error ? error.message : "Rate limit exceeded" });
    }
    return next();
  })
);
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers/admin.ts
import { z as z2 } from "zod";
import { TRPCError as TRPCError3 } from "@trpc/server";

// server/market/db.ts
import { and as and2, desc, eq as eq2, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { lt } from "drizzle-orm";

// server/market/constants.ts
var USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
var USDC_DECIMALS = 6;
var ARCHIVE_AFTER_MS = 24 * 60 * 60 * 1e3;
var PLATFORM_FEE_BPS = 500;
var DEFAULT_PROJECT = { slug: "commonsmade", name: "CommonsMade", description: "Trade CommonsMade vouches and slashes." };
function toUsdcMicro(amount) {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("USDC amount must be a positive number");
  }
  return Math.round(amount * 10 ** USDC_DECIMALS);
}
function decimalToUsdcMicro(amount) {
  if (!/^\d+(?:\.\d{1,6})?$/.test(amount.trim())) {
    throw new Error("USDC amount must contain up to six decimal places");
  }
  const [whole, fraction = ""] = amount.split(".");
  return Number(whole) * 1e6 + Number(fraction.padEnd(6, "0").slice(0, 6));
}
function microToDecimal(amount) {
  const whole = Math.floor(amount / 1e6);
  const fraction = Math.round(amount % 1e6).toString().padStart(6, "0");
  return `${whole}.${fraction}`;
}
function calculatePlatformFee(grossMicro) {
  if (!Number.isSafeInteger(grossMicro) || grossMicro <= 0) {
    throw new Error("Gross amount must be a positive USDC micro-unit amount");
  }
  const feeMicro = Math.round(grossMicro * PLATFORM_FEE_BPS / 1e4);
  return { grossMicro, feeMicro, sellerNetMicro: grossMicro - feeMicro };
}
function calculateMarketAmounts(quantity, pricePerVouch) {
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Quantity must be a positive whole number");
  const unitMicro = toUsdcMicro(pricePerVouch);
  const grossMicro = unitMicro * quantity;
  if (!Number.isSafeInteger(grossMicro) || grossMicro <= 0) throw new Error("USDC amount is outside the supported range");
  const amounts = calculatePlatformFee(grossMicro);
  return {
    grossUsdc: microToDecimal(amounts.grossMicro),
    platformFeeUsdc: microToDecimal(amounts.feeMicro),
    sellerNetUsdc: microToDecimal(amounts.sellerNetMicro)
  };
}

// server/market/rules.ts
function enforceAvailableFill(remainingQuantity, fillQuantity) {
  if (!Number.isInteger(fillQuantity) || fillQuantity <= 0) {
    throw new Error("Fill quantity must be a positive whole number");
  }
  if (fillQuantity > remainingQuantity) {
    throw new Error("This fill exceeds the remaining request quantity");
  }
}
function normalizeXHandle(handle) {
  const normalized = handle.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(normalized)) {
    throw new Error("Enter a valid X handle without the @ symbol");
  }
  return normalized;
}
function enforceSingleUnitAllocation(quantity) {
  if (quantity !== 1) {
    throw new Error("Each vouch or slash allocation must be exactly one unit for one target account");
  }
}
function enforcePointsPerUnit(pointsPerUnit) {
  if (!Number.isInteger(pointsPerUnit) || pointsPerUnit <= 0 || pointsPerUnit > 1e9) {
    throw new Error("Points per unit must be a positive whole number");
  }
}
function allocationKey(input) {
  const sourceHandle = normalizeXHandle(input.sourceHandle);
  const targetHandle = normalizeXHandle(input.targetHandle);
  if (sourceHandle === targetHandle) {
    throw new Error("A source account cannot allocate a vouch or slash to itself");
  }
  return [input.projectSlug.toLowerCase(), input.instrument, sourceHandle, targetHandle].join(":");
}
function assertUnusedPaymentSignature(signatureAlreadyUsed) {
  if (signatureAlreadyUsed) {
    throw new Error("This payment signature has already been used");
  }
}
function enforceWalletOwnership(expectedWallet, submittedWallet) {
  if (expectedWallet !== submittedWallet) {
    throw new Error("This wallet is not authorized for the selected record");
  }
}
function nextRequestStatusAfterCompletions(input) {
  const requestIsFull = input.filledQuantity === input.requestedQuantity;
  const everySellerMarkedDone = input.sellerMarkedDone.length > 0 && input.sellerMarkedDone.every(Boolean);
  return requestIsFull && input.buyerMarkedDone && everySellerMarkedDone ? "awaiting_review" : "filled";
}
function nextRequestStatusAfterPayouts(statuses) {
  if (statuses.some((status) => status === "disputed")) return "disputed";
  if (statuses.length > 0 && statuses.every((status) => status === "paid")) return "completed";
  return "awaiting_review";
}
function nextDirectPurchaseStatus(buyerMarkedDone, sellerMarkedDone) {
  return buyerMarkedDone && sellerMarkedDone ? "under_review" : "matched";
}
function enforceDelistableOffer(input) {
  enforceWalletOwnership(input.sellerWallet, input.wallet);
  if (input.status !== "open" || input.requestId !== null) {
    throw new Error("Only an uncommitted open seller offer can be delisted");
  }
}
function transitionDirectPurchase(progress, event) {
  if (event === "reserve") {
    if (progress.status !== "open") throw new Error("This seller offer is no longer available");
    return { ...progress, status: "awaiting_payment" };
  }
  if (event === "payment_verified") {
    if (progress.status !== "awaiting_payment") throw new Error("This offer purchase cannot be activated");
    return { ...progress, status: "matched" };
  }
  if (event === "buyer_confirmed") {
    if (!["matched", "done"].includes(progress.status)) throw new Error("This purchase cannot be confirmed yet");
    return { ...progress, buyerMarkedDone: true, status: nextDirectPurchaseStatus(true, progress.sellerMarkedDone) };
  }
  if (progress.status !== "matched") throw new Error("This fill cannot be marked complete yet");
  return { ...progress, sellerMarkedDone: true, status: nextDirectPurchaseStatus(progress.buyerMarkedDone, true) };
}

// server/market/visibility.ts
function excludeArchivedRecords(records) {
  return records.filter((record) => record.archivedAt === null);
}
function removeArchiveMetadata(records) {
  return excludeArchivedRecords(records).map(({ archivedAt: _archivedAt, ...record }) => record);
}

// server/market/instrumentLifecycle.ts
function createExactMarketIntent(instrument2, quantity) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Exact market quantity must be a positive whole number");
  }
  return { instrument: instrument2, quantity };
}
function createFillIntent(source, quantity) {
  if (quantity > source.quantity) {
    throw new Error("Fill quantity exceeds the exact available amount");
  }
  return createExactMarketIntent(source.instrument, quantity);
}
function createDirectPurchaseIntent(source) {
  return createExactMarketIntent(source.instrument, source.quantity);
}

// server/market/db.ts
var DIRECT_PURCHASE_HOLD_MS = 15 * 60 * 1e3;
async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db;
}
async function logActivity(input) {
  const db = await dbOrThrow();
  await db.insert(activityLogs).values(input);
  await invalidatePublicBoardCache();
}
async function ensureDefaultProject() {
  const db = await dbOrThrow();
  await db.insert(marketProjects).values(DEFAULT_PROJECT).onConflictDoUpdate({
    target: marketProjects.slug,
    set: { name: DEFAULT_PROJECT.name, description: DEFAULT_PROJECT.description }
  });
}
async function releaseStaleDirectPurchaseReservations(now = /* @__PURE__ */ new Date()) {
  const db = await dbOrThrow();
  const cutoff = new Date(now.getTime() - DIRECT_PURCHASE_HOLD_MS);
  const stale = await db.select().from(sellerCommitments).where(and2(
    eq2(sellerCommitments.status, "awaiting_payment"),
    isNull(sellerCommitments.paymentSignature),
    lt(sellerCommitments.updatedAt, cutoff)
  ));
  if (!stale.length) return 0;
  await db.transaction(async (tx) => {
    for (const allocation of stale) {
      if (allocation.parentOfferId) {
        await tx.update(sellerCommitments).set({
          quantity: sql`${sellerCommitments.quantity} + 1`,
          status: "open"
        }).where(and2(
          eq2(sellerCommitments.id, allocation.parentOfferId),
          inArray(sellerCommitments.status, ["open", "matched"])
        ));
        await tx.update(sellerCommitments).set({ status: "cancelled" }).where(eq2(sellerCommitments.id, allocation.id));
      } else {
        await tx.update(sellerCommitments).set({
          status: "open",
          buyerWallet: null,
          grossUsdc: null,
          platformFeeUsdc: null,
          sellerNetUsdc: null,
          targetHandle: null,
          allocationKey: null
        }).where(eq2(sellerCommitments.id, allocation.id));
      }
    }
  });
  await invalidatePublicBoardCache();
  return stale.length;
}
async function createMarketProject(input) {
  const db = await dbOrThrow();
  await db.insert(marketProjects).values({ slug: input.slug, name: input.name, description: input.description }).onConflictDoUpdate({
    target: marketProjects.slug,
    set: { name: input.name, description: input.description, isActive: true }
  });
  return { slug: input.slug };
}
async function getPublicMarket() {
  return getCachedPublicBoard(async () => {
    const db = await dbOrThrow();
    await ensureDefaultProject();
    await releaseStaleDirectPurchaseReservations();
    const [projects, requests, sellerOffers] = await Promise.all([
      db.select({ slug: marketProjects.slug, name: marketProjects.name, description: marketProjects.description }).from(marketProjects).where(eq2(marketProjects.isActive, true)).orderBy(marketProjects.name),
      db.select({
        publicId: marketRequests.publicId,
        targetHandle: marketRequests.targetHandle,
        projectSlug: marketRequests.projectSlug,
        instrument: marketRequests.instrument,
        requestedQuantity: marketRequests.requestedQuantity,
        filledQuantity: marketRequests.filledQuantity,
        pricePerVouch: marketRequests.pricePerVouch,
        totalUsdc: marketRequests.totalUsdc,
        status: marketRequests.status,
        archivedAt: marketRequests.archivedAt,
        createdAt: marketRequests.createdAt
      }).from(marketRequests).where(and2(isNull(marketRequests.archivedAt), inArray(marketRequests.status, ["open", "filled", "awaiting_review"]))).orderBy(desc(marketRequests.createdAt)),
      db.select({
        publicId: sellerCommitments.publicId,
        profileHandle: sellerCommitments.profileHandle,
        sourceHandle: sellerCommitments.sourceHandle,
        projectSlug: sellerCommitments.projectSlug,
        instrument: sellerCommitments.instrument,
        quantity: sellerCommitments.quantity,
        pointsPerUnit: sellerCommitments.pointsPerUnit,
        pricePerVouch: sellerCommitments.pricePerVouch,
        status: sellerCommitments.status,
        archivedAt: sellerCommitments.archivedAt,
        createdAt: sellerCommitments.createdAt
      }).from(sellerCommitments).where(and2(isNull(sellerCommitments.requestId), isNull(sellerCommitments.parentOfferId), isNull(sellerCommitments.archivedAt), isNotNull(sellerCommitments.pointsPerUnit), eq2(sellerCommitments.status, "open"))).orderBy(desc(sellerCommitments.createdAt))
    ]);
    const visibleRequests = removeArchiveMetadata(requests);
    const visibleSellerOffers = removeArchiveMetadata(sellerOffers);
    const midpointFor = (instrument2) => {
      const prices = [...visibleRequests, ...visibleSellerOffers].filter((entry) => entry.instrument === instrument2).map((entry) => Number(entry.pricePerVouch)).filter((price) => Number.isFinite(price) && price > 0).sort((a, b) => a - b);
      const midpoint = prices.length ? prices[Math.floor(prices.length / 2)] : null;
      return midpoint?.toFixed(4) ?? null;
    };
    return {
      projects,
      requests: visibleRequests,
      sellerOffers: visibleSellerOffers,
      suggestedPriceByInstrument: { vouch: midpointFor("vouch"), slash: midpointFor("slash") }
    };
  });
}
async function createRequest(input) {
  const db = await dbOrThrow();
  const publicId = `REQ-${nanoid(8).toUpperCase()}`;
  const now = /* @__PURE__ */ new Date();
  const intent = createExactMarketIntent(input.instrument, input.requestedQuantity);
  const targetHandle = normalizeXHandle(input.targetHandle);
  const amounts = calculateMarketAmounts(intent.quantity, input.pricePerVouch);
  await db.insert(marketRequests).values({
    ...input,
    targetHandle,
    instrument: intent.instrument,
    requestedQuantity: intent.quantity,
    publicId,
    pricePerVouch: input.pricePerVouch.toFixed(6),
    totalUsdc: amounts.grossUsdc,
    platformFeeUsdc: amounts.platformFeeUsdc,
    sellerNetUsdc: amounts.sellerNetUsdc,
    archiveEligibleAt: new Date(now.getTime() + ARCHIVE_AFTER_MS)
  });
  await logActivity({ entityType: "request", entityPublicId: publicId, eventType: "request_created", actorWallet: input.buyerWallet });
  return { publicId, totalUsdc: amounts.grossUsdc };
}
async function activatePaidRequest(input) {
  const db = await dbOrThrow();
  const request = (await db.select().from(marketRequests).where(eq2(marketRequests.publicId, input.publicId)).limit(1))[0];
  if (!request || request.buyerWallet !== input.buyerWallet || request.status !== "awaiting_payment") {
    throw new Error("This request cannot be activated");
  }
  const existingPayment = (await db.select().from(marketRequests).where(eq2(marketRequests.paymentSignature, input.signature)).limit(1))[0];
  assertUnusedPaymentSignature(Boolean(existingPayment));
  return request;
}
async function getPaymentDetails(publicId, buyerWallet) {
  const db = await dbOrThrow();
  const request = (await db.select().from(marketRequests).where(eq2(marketRequests.publicId, publicId)).limit(1))[0];
  if (!request || request.buyerWallet !== buyerWallet || request.status !== "awaiting_payment") {
    throw new Error("No payment is due for this request and wallet");
  }
  return { publicId: request.publicId, totalUsdc: request.totalUsdc, targetHandle: request.targetHandle };
}
async function recordVerifiedPayment(publicId, signature, buyerWallet) {
  const db = await dbOrThrow();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(paymentSignatureClaims).values({ signature, entityType: "request", entityPublicId: publicId });
      const result = await tx.update(marketRequests).set({ paymentSignature: signature, paymentVerifiedAt: /* @__PURE__ */ new Date(), status: "open" }).where(and2(eq2(marketRequests.publicId, publicId), eq2(marketRequests.buyerWallet, buyerWallet), eq2(marketRequests.status, "awaiting_payment"))).returning({ id: marketRequests.id });
      if (!result.length) throw new Error("This request is no longer awaiting this wallet's payment");
    });
  } catch (error) {
    if (error.code === "23505") throw new Error("This payment signature has already been used");
    throw error;
  }
  await logActivity({ entityType: "request", entityPublicId: publicId, eventType: "payment_verified" });
}
async function createSellerOffer(input) {
  const db = await dbOrThrow();
  const intent = createExactMarketIntent(input.instrument, input.quantity);
  enforcePointsPerUnit(input.pointsPerUnit);
  const sourceHandle = normalizeXHandle(input.profileHandle);
  const publicId = `ASK-${nanoid(8).toUpperCase()}`;
  await db.insert(sellerCommitments).values({
    ...input,
    profileHandle: sourceHandle,
    sourceHandle,
    instrument: intent.instrument,
    quantity: intent.quantity,
    pointsPerUnit: input.pointsPerUnit,
    publicId,
    pricePerVouch: input.pricePerVouch.toFixed(6),
    archiveEligibleAt: new Date(Date.now() + ARCHIVE_AFTER_MS)
  });
  await logActivity({ entityType: "seller_commitment", entityPublicId: publicId, eventType: "seller_offer_created", actorWallet: input.sellerWallet });
  return { publicId, unitsPosted: intent.quantity };
}
async function fillRequest(input) {
  const db = await dbOrThrow();
  const request = (await db.select().from(marketRequests).where(eq2(marketRequests.publicId, input.requestPublicId)).limit(1))[0];
  if (!request || request.status !== "open") throw new Error("This request is not open for fills");
  enforceSingleUnitAllocation(input.quantity);
  enforcePointsPerUnit(input.pointsPerUnit);
  enforceAvailableFill(request.requestedQuantity - request.filledQuantity, input.quantity);
  const fillIntent = createFillIntent({ instrument: request.instrument, quantity: request.requestedQuantity - request.filledQuantity }, input.quantity);
  const sourceHandle = normalizeXHandle(input.profileHandle);
  const targetHandle = normalizeXHandle(request.targetHandle);
  const pairKey = allocationKey({ sourceHandle, targetHandle, projectSlug: request.projectSlug, instrument: fillIntent.instrument });
  const existingAllocation = (await db.select().from(sellerCommitments).where(eq2(sellerCommitments.allocationKey, pairKey)).limit(1))[0];
  if (existingAllocation) {
    throw new Error(`@${sourceHandle} has already allocated this ${fillIntent.instrument} to @${targetHandle}`);
  }
  const publicId = `FILL-${nanoid(8).toUpperCase()}`;
  await db.transaction(async (tx) => {
    const updateResult = await tx.update(marketRequests).set({
      filledQuantity: sql`${marketRequests.filledQuantity} + ${input.quantity}`,
      status: request.filledQuantity + input.quantity === request.requestedQuantity ? "filled" : "open"
    }).where(
      and2(
        eq2(marketRequests.id, request.id),
        eq2(marketRequests.status, "open"),
        sql`${marketRequests.filledQuantity} + ${input.quantity} <= ${marketRequests.requestedQuantity}`
      )
    ).returning({ id: marketRequests.id });
    if (!updateResult.length) throw new Error("The request changed before this fill was recorded");
    await tx.insert(sellerCommitments).values({
      publicId,
      requestId: request.id,
      sellerWallet: input.sellerWallet,
      profileHandle: sourceHandle,
      sourceHandle,
      targetHandle,
      allocationKey: pairKey,
      projectSlug: request.projectSlug,
      instrument: fillIntent.instrument,
      quantity: fillIntent.quantity,
      pointsPerUnit: input.pointsPerUnit,
      pricePerVouch: request.pricePerVouch,
      grossUsdc: calculateMarketAmounts(fillIntent.quantity, Number(request.pricePerVouch)).grossUsdc,
      platformFeeUsdc: calculateMarketAmounts(fillIntent.quantity, Number(request.pricePerVouch)).platformFeeUsdc,
      sellerNetUsdc: calculateMarketAmounts(fillIntent.quantity, Number(request.pricePerVouch)).sellerNetUsdc,
      status: "matched",
      archiveEligibleAt: new Date(Date.now() + ARCHIVE_AFTER_MS)
    });
  });
  await logActivity({ entityType: "seller_commitment", entityPublicId: publicId, eventType: "request_filled", actorWallet: input.sellerWallet, detail: `${input.requestPublicId}:${sourceHandle}->${targetHandle}` });
  return { publicId };
}
async function initiateOfferPurchase(input) {
  const db = await dbOrThrow();
  await releaseStaleDirectPurchaseReservations();
  const offer = (await db.select().from(sellerCommitments).where(eq2(sellerCommitments.publicId, input.offerPublicId)).limit(1))[0];
  if (!offer || offer.requestId || offer.parentOfferId || offer.status !== "open" || offer.quantity < 1) throw new Error("This seller offer is no longer available");
  const purchaseIntent = createDirectPurchaseIntent({ instrument: offer.instrument, quantity: 1 });
  const sourceHandle = normalizeXHandle(offer.sourceHandle ?? offer.profileHandle);
  const targetHandle = normalizeXHandle(input.targetHandle);
  const pairKey = allocationKey({ sourceHandle, targetHandle, projectSlug: offer.projectSlug, instrument: purchaseIntent.instrument });
  const existingAllocation = (await db.select().from(sellerCommitments).where(eq2(sellerCommitments.allocationKey, pairKey)).limit(1))[0];
  if (existingAllocation) {
    throw new Error(`@${sourceHandle} has already allocated this ${purchaseIntent.instrument} to @${targetHandle}`);
  }
  const amounts = calculateMarketAmounts(purchaseIntent.quantity, Number(offer.pricePerVouch));
  const allocationPublicId = `ASK-${nanoid(8).toUpperCase()}`;
  await db.transaction(async (tx) => {
    const result = await tx.update(sellerCommitments).set({
      quantity: sql`${sellerCommitments.quantity} - 1`,
      status: offer.quantity === 1 ? "matched" : "open"
    }).where(and2(
      eq2(sellerCommitments.id, offer.id),
      eq2(sellerCommitments.status, "open"),
      sql`${sellerCommitments.quantity} >= 1`
    )).returning({ id: sellerCommitments.id });
    if (!result.length) throw new Error("This seller offer was just claimed by another buyer");
    await tx.insert(sellerCommitments).values({
      publicId: allocationPublicId,
      parentOfferId: offer.id,
      sellerWallet: offer.sellerWallet,
      profileHandle: sourceHandle,
      sourceHandle,
      targetHandle,
      allocationKey: pairKey,
      projectSlug: offer.projectSlug,
      instrument: purchaseIntent.instrument,
      vouchBand: offer.vouchBand,
      quantity: 1,
      pointsPerUnit: offer.pointsPerUnit,
      pricePerVouch: offer.pricePerVouch,
      grossUsdc: amounts.grossUsdc,
      platformFeeUsdc: amounts.platformFeeUsdc,
      sellerNetUsdc: amounts.sellerNetUsdc,
      buyerWallet: input.buyerWallet,
      status: "awaiting_payment",
      archiveEligibleAt: offer.archiveEligibleAt
    });
  });
  await logActivity({ entityType: "seller_commitment", entityPublicId: allocationPublicId, eventType: "offer_purchase_started", actorWallet: input.buyerWallet, detail: `${sourceHandle}->${targetHandle}` });
  return { publicId: allocationPublicId, totalUsdc: amounts.grossUsdc };
}
async function activateOfferPurchase(input) {
  const db = await dbOrThrow();
  const offer = (await db.select().from(sellerCommitments).where(eq2(sellerCommitments.publicId, input.publicId)).limit(1))[0];
  if (!offer || offer.buyerWallet !== input.buyerWallet || !offer.grossUsdc || transitionDirectPurchase({ status: offer.status, buyerMarkedDone: false, sellerMarkedDone: false }, "payment_verified").status !== "matched") throw new Error("This offer purchase cannot be activated");
  const usedByRequest = (await db.select().from(marketRequests).where(eq2(marketRequests.paymentSignature, input.signature)).limit(1))[0];
  const usedByOffer = (await db.select().from(sellerCommitments).where(eq2(sellerCommitments.paymentSignature, input.signature)).limit(1))[0];
  assertUnusedPaymentSignature(Boolean(usedByRequest || usedByOffer));
  return offer;
}
async function recordVerifiedOfferPurchase(publicId, signature, buyerWallet) {
  const db = await dbOrThrow();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(paymentSignatureClaims).values({ signature, entityType: "seller_commitment", entityPublicId: publicId });
      const result = await tx.update(sellerCommitments).set({ paymentSignature: signature, paymentVerifiedAt: /* @__PURE__ */ new Date(), status: "matched" }).where(and2(eq2(sellerCommitments.publicId, publicId), eq2(sellerCommitments.buyerWallet, buyerWallet), eq2(sellerCommitments.status, "awaiting_payment"))).returning({ id: sellerCommitments.id });
      if (!result.length) throw new Error("This offer is no longer awaiting this wallet's payment");
    });
  } catch (error) {
    if (error.code === "23505") throw new Error("This payment signature has already been used");
    throw error;
  }
  await logActivity({ entityType: "seller_commitment", entityPublicId: publicId, eventType: "offer_purchase_verified" });
}
async function getOfferPaymentDetails(publicId, buyerWallet) {
  const db = await dbOrThrow();
  const offer = (await db.select().from(sellerCommitments).where(eq2(sellerCommitments.publicId, publicId)).limit(1))[0];
  if (!offer || offer.status !== "awaiting_payment" || offer.buyerWallet !== buyerWallet || !offer.grossUsdc) throw new Error("No payment is due for this offer and wallet");
  return { publicId: offer.publicId, totalUsdc: offer.grossUsdc, profileHandle: offer.profileHandle };
}
async function delistSellerOffer(publicId, wallet3) {
  const db = await dbOrThrow();
  const offer = (await db.select().from(sellerCommitments).where(eq2(sellerCommitments.publicId, publicId)).limit(1))[0];
  if (!offer) throw new Error("Only an uncommitted open seller offer can be delisted");
  enforceDelistableOffer({ status: offer.status, requestId: offer.requestId, sellerWallet: offer.sellerWallet, wallet: wallet3 });
  await db.update(sellerCommitments).set({ status: "cancelled" }).where(eq2(sellerCommitments.id, offer.id));
  await logActivity({ entityType: "seller_commitment", entityPublicId: publicId, eventType: "seller_offer_delisted", actorWallet: wallet3 });
}
async function setLegacyOfferPoints(input) {
  const db = await dbOrThrow();
  enforcePointsPerUnit(input.pointsPerUnit);
  const offer = (await db.select().from(sellerCommitments).where(eq2(sellerCommitments.publicId, input.offerPublicId)).limit(1))[0];
  if (!offer || offer.requestId || offer.parentOfferId || offer.status !== "open" || offer.pointsPerUnit != null) {
    throw new Error("Only an open legacy source offer without a declared point value can be repaired");
  }
  const result = await db.update(sellerCommitments).set({ pointsPerUnit: input.pointsPerUnit }).where(and2(
    eq2(sellerCommitments.id, offer.id),
    isNull(sellerCommitments.requestId),
    isNull(sellerCommitments.parentOfferId),
    eq2(sellerCommitments.status, "open"),
    isNull(sellerCommitments.pointsPerUnit)
  )).returning({ id: sellerCommitments.id });
  if (!result.length) throw new Error("This legacy source offer changed before its point value could be recorded");
  await logActivity({
    entityType: "seller_commitment",
    entityPublicId: offer.publicId,
    eventType: "legacy_offer_points_recorded",
    actorWallet: input.adminWallet,
    detail: String(input.pointsPerUnit)
  });
  return { publicId: offer.publicId, pointsPerUnit: input.pointsPerUnit };
}
async function requestReadyForReview(requestId) {
  const db = await dbOrThrow();
  const request = (await db.select().from(marketRequests).where(eq2(marketRequests.id, requestId)).limit(1))[0];
  if (!request) return;
  const commitments = await db.select().from(sellerCommitments).where(eq2(sellerCommitments.requestId, requestId));
  if (nextRequestStatusAfterCompletions({
    requestedQuantity: request.requestedQuantity,
    filledQuantity: request.filledQuantity,
    buyerMarkedDone: Boolean(request.buyerMarkedDoneAt),
    sellerMarkedDone: commitments.map((item) => Boolean(item.sellerMarkedDoneAt))
  }) === "awaiting_review") {
    await db.update(marketRequests).set({ status: "awaiting_review" }).where(eq2(marketRequests.id, requestId));
    await db.update(sellerCommitments).set({ status: "under_review" }).where(eq2(sellerCommitments.requestId, requestId));
    await logActivity({ entityType: "request", entityPublicId: request.publicId, eventType: "all_participants_marked_done" });
  }
}
async function markBuyerDone(publicId, wallet3) {
  const db = await dbOrThrow();
  const request = (await db.select().from(marketRequests).where(eq2(marketRequests.publicId, publicId)).limit(1))[0];
  if (!request || request.status !== "filled") throw new Error("This request cannot be marked complete yet");
  enforceWalletOwnership(request.buyerWallet, wallet3);
  await db.update(marketRequests).set({ buyerMarkedDoneAt: /* @__PURE__ */ new Date() }).where(eq2(marketRequests.id, request.id));
  await logActivity({ entityType: "request", entityPublicId: publicId, eventType: "buyer_marked_done", actorWallet: wallet3 });
  await requestReadyForReview(request.id);
}
async function markSellerDone(publicId, wallet3) {
  const db = await dbOrThrow();
  const commitment = (await db.select().from(sellerCommitments).where(eq2(sellerCommitments.publicId, publicId)).limit(1))[0];
  if (!commitment || commitment.status !== "matched") throw new Error("This fill cannot be marked complete yet");
  enforceWalletOwnership(commitment.sellerWallet, wallet3);
  await db.update(sellerCommitments).set({ sellerMarkedDoneAt: /* @__PURE__ */ new Date(), status: "done" }).where(eq2(sellerCommitments.id, commitment.id));
  await logActivity({ entityType: "seller_commitment", entityPublicId: publicId, eventType: "seller_marked_done", actorWallet: wallet3 });
  if (commitment.requestId) await requestReadyForReview(commitment.requestId);
  else if (nextDirectPurchaseStatus(Boolean(commitment.buyerMarkedDoneAt), true) === "under_review") {
    await db.update(sellerCommitments).set({ status: "under_review" }).where(eq2(sellerCommitments.id, commitment.id));
    await logActivity({ entityType: "seller_commitment", entityPublicId: publicId, eventType: "direct_purchase_ready_for_review" });
  }
}
async function markOfferBuyerDone(publicId, wallet3) {
  const db = await dbOrThrow();
  const offer = (await db.select().from(sellerCommitments).where(eq2(sellerCommitments.publicId, publicId)).limit(1))[0];
  if (!offer || offer.requestId || !["matched", "done"].includes(offer.status) || !offer.buyerWallet) throw new Error("This purchase cannot be confirmed yet");
  enforceWalletOwnership(offer.buyerWallet, wallet3);
  await db.update(sellerCommitments).set({ buyerMarkedDoneAt: /* @__PURE__ */ new Date() }).where(eq2(sellerCommitments.id, offer.id));
  await logActivity({ entityType: "seller_commitment", entityPublicId: publicId, eventType: "direct_purchase_buyer_marked_done", actorWallet: wallet3 });
  if (nextDirectPurchaseStatus(true, Boolean(offer.sellerMarkedDoneAt)) === "under_review") {
    await db.update(sellerCommitments).set({ status: "under_review" }).where(eq2(sellerCommitments.id, offer.id));
    await logActivity({ entityType: "seller_commitment", entityPublicId: publicId, eventType: "direct_purchase_ready_for_review" });
  }
}
async function cancelUnpaidRequest(publicId, wallet3) {
  const db = await dbOrThrow();
  const request = (await db.select().from(marketRequests).where(eq2(marketRequests.publicId, publicId)).limit(1))[0];
  if (!request || request.status !== "awaiting_payment" || request.paymentSignature) {
    throw new Error("Only an unpaid request can be cancelled");
  }
  enforceWalletOwnership(request.buyerWallet, wallet3);
  await db.update(marketRequests).set({ status: "cancelled" }).where(eq2(marketRequests.id, request.id));
  await logActivity({ entityType: "request", entityPublicId: publicId, eventType: "unpaid_request_cancelled", actorWallet: wallet3 });
}
async function getOperations() {
  const db = await dbOrThrow();
  const [requests, commitments, payouts, logs] = await Promise.all([
    db.select().from(marketRequests).orderBy(desc(marketRequests.createdAt)),
    db.select().from(sellerCommitments).orderBy(desc(sellerCommitments.createdAt)),
    db.select().from(payoutRecords).orderBy(desc(payoutRecords.createdAt)),
    db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(80)
  ]);
  const sourceOffers = commitments.filter((item) => !item.requestId && !item.parentOfferId && item.status === "open");
  const tradeableSourceOffers = sourceOffers.filter((item) => Boolean(item.pointsPerUnit));
  const activeAllocations = commitments.filter((item) => (item.requestId || item.parentOfferId) && ["awaiting_payment", "matched", "done", "under_review", "approved"].includes(item.status));
  const completedAllocations = commitments.filter((item) => (item.requestId || item.parentOfferId) && ["paid", "disputed"].includes(item.status));
  return {
    requests,
    commitments,
    payouts,
    logs,
    metrics: {
      openSourceOffers: sourceOffers.length,
      availableUnits: tradeableSourceOffers.reduce((sum, item) => sum + item.quantity, 0),
      activeAllocations: activeAllocations.length,
      completedAllocations: completedAllocations.length,
      listingsMissingPoints: sourceOffers.filter((item) => !item.pointsPerUnit).length
    }
  };
}
async function getParticipantActivity(wallet3) {
  const db = await dbOrThrow();
  const [requests, fills, purchases] = await Promise.all([
    db.select({
      publicId: marketRequests.publicId,
      targetHandle: marketRequests.targetHandle,
      instrument: marketRequests.instrument,
      requestedQuantity: marketRequests.requestedQuantity,
      filledQuantity: marketRequests.filledQuantity,
      totalUsdc: marketRequests.totalUsdc,
      status: marketRequests.status,
      buyerMarkedDoneAt: marketRequests.buyerMarkedDoneAt
    }).from(marketRequests).where(eq2(marketRequests.buyerWallet, wallet3)).orderBy(desc(marketRequests.createdAt)),
    db.select({
      publicId: sellerCommitments.publicId,
      requestId: sellerCommitments.requestId,
      profileHandle: sellerCommitments.profileHandle,
      sourceHandle: sellerCommitments.sourceHandle,
      targetHandle: sellerCommitments.targetHandle,
      instrument: sellerCommitments.instrument,
      quantity: sellerCommitments.quantity,
      pointsPerUnit: sellerCommitments.pointsPerUnit,
      pricePerVouch: sellerCommitments.pricePerVouch,
      status: sellerCommitments.status,
      sellerMarkedDoneAt: sellerCommitments.sellerMarkedDoneAt
    }).from(sellerCommitments).where(eq2(sellerCommitments.sellerWallet, wallet3)).orderBy(desc(sellerCommitments.createdAt)),
    db.select({
      publicId: sellerCommitments.publicId,
      profileHandle: sellerCommitments.profileHandle,
      sourceHandle: sellerCommitments.sourceHandle,
      targetHandle: sellerCommitments.targetHandle,
      instrument: sellerCommitments.instrument,
      quantity: sellerCommitments.quantity,
      pointsPerUnit: sellerCommitments.pointsPerUnit,
      pricePerVouch: sellerCommitments.pricePerVouch,
      grossUsdc: sellerCommitments.grossUsdc,
      status: sellerCommitments.status,
      buyerMarkedDoneAt: sellerCommitments.buyerMarkedDoneAt
    }).from(sellerCommitments).where(eq2(sellerCommitments.buyerWallet, wallet3)).orderBy(desc(sellerCommitments.createdAt))
  ]);
  return { requests, fills, purchases };
}
async function recordPayoutDecision(input) {
  const db = await dbOrThrow();
  const commitment = (await db.select().from(sellerCommitments).where(eq2(sellerCommitments.publicId, input.commitmentPublicId)).limit(1))[0];
  if (!commitment || !["under_review", "approved"].includes(commitment.status)) throw new Error("This seller fill is not ready for a payout decision");
  const amounts = calculateMarketAmounts(commitment.quantity, Number(commitment.pricePerVouch));
  await db.insert(payoutRecords).values({
    sellerCommitmentId: commitment.id,
    recipientWallet: commitment.sellerWallet,
    amountUsdc: amounts.sellerNetUsdc,
    grossAmountUsdc: amounts.grossUsdc,
    platformFeeUsdc: amounts.platformFeeUsdc,
    status: input.status,
    externalReference: input.externalReference,
    adminNote: input.adminNote,
    decidedByOpenId: input.adminOpenId
  });
  await db.update(sellerCommitments).set({ status: input.status === "sent" ? "paid" : "disputed" }).where(eq2(sellerCommitments.id, commitment.id));
  if (commitment.requestId) {
    const siblingCommitments = await db.select().from(sellerCommitments).where(eq2(sellerCommitments.requestId, commitment.requestId));
    const nextRequestStatus = nextRequestStatusAfterPayouts(siblingCommitments.map((item) => {
      if (item.publicId === commitment.publicId) return input.status === "sent" ? "paid" : "disputed";
      return item.status === "paid" ? "paid" : item.status === "disputed" ? "disputed" : "under_review";
    }));
    await db.update(marketRequests).set({ status: nextRequestStatus }).where(eq2(marketRequests.id, commitment.requestId));
  }
  await logActivity({ entityType: "payout", entityPublicId: commitment.publicId, eventType: `payout_${input.status}`, actorAdminOpenId: input.adminOpenId, detail: input.externalReference });
}

// server/market/walletProof.ts
import { eq as eq3 } from "drizzle-orm";
import { nanoid as nanoid2 } from "nanoid";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
var CHALLENGE_TTL_MS = 10 * 60 * 1e3;
async function createWalletChallenge(wallet3, action) {
  new PublicKey(wallet3);
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const id = nanoid2(20);
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  const message = [
    "Vouch Market wallet confirmation",
    `Action: ${action}`,
    `Wallet: ${wallet3}`,
    `Nonce: ${id}`,
    `Expires: ${expiresAt.toISOString()}`
  ].join("\n");
  await db.insert(walletChallenges).values({ id, wallet: wallet3, action, message, expiresAt });
  return { id, message, expiresAt };
}
async function verifyWalletChallenge(input) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const challenge = (await db.select().from(walletChallenges).where(eq3(walletChallenges.id, input.challengeId)).limit(1))[0];
  if (!challenge || challenge.wallet !== input.wallet || challenge.action !== input.action) {
    throw new Error("Wallet confirmation is invalid");
  }
  if (challenge.usedAt || challenge.expiresAt.getTime() < Date.now()) {
    throw new Error("Wallet confirmation has expired; request a new one");
  }
  const verified = nacl.sign.detached.verify(
    new TextEncoder().encode(challenge.message),
    new Uint8Array(Buffer.from(input.signature, "base64")),
    new PublicKey(input.wallet).toBytes()
  );
  if (!verified) throw new Error("Wallet signature could not be verified");
  await db.update(walletChallenges).set({ usedAt: /* @__PURE__ */ new Date() }).where(eq3(walletChallenges.id, input.challengeId));
}

// server/market/archive.ts
import { and as and3, eq as eq4, isNull as isNull2, lte } from "drizzle-orm";

// server/storage.ts
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = await presignResp.json();
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
}

// server/market/archive.ts
var ARCHIVE_FIELDS = [
  "publicId",
  "targetHandle",
  "profileHandle",
  "sourceHandle",
  "instrument",
  "vouchBand",
  "requestedQuantity",
  "filledQuantity",
  "quantity",
  "pointsPerUnit",
  "pricePerVouch",
  "totalUsdc",
  "status",
  "createdAt",
  "updatedAt",
  "archiveEligibleAt"
];
function sanitizeArchiveRecord(record) {
  return Object.fromEntries(
    ARCHIVE_FIELDS.flatMap((field) => {
      const value = record[field];
      if (value === void 0 || value === null) return [];
      return [[field, value instanceof Date ? value.toISOString() : value]];
    })
  );
}
function buildArchiveSnapshot(type, record, capturedAt) {
  return JSON.stringify({
    schemaVersion: 1,
    type,
    publicId: record.publicId,
    capturedAt: capturedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    archiveEligibleAt: record.archiveEligibleAt.toISOString(),
    record: sanitizeArchiveRecord(record)
  });
}
async function archiveRequests(now) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const records = await db.select().from(marketRequests).where(and3(lte(marketRequests.archiveEligibleAt, now), isNull2(marketRequests.archivedAt)));
  for (const record of records) {
    const snapshot = buildArchiveSnapshot("request", record, now);
    const stored = await storagePut(`archives/vouch-market/requests/${record.publicId}.json`, snapshot, "application/json");
    await db.update(marketRequests).set({ archivedAt: now, archiveSummary: JSON.stringify({ key: stored.key, url: stored.url, capturedAt: now.toISOString(), status: record.status }) }).where(eq4(marketRequests.id, record.id));
  }
  return records.length;
}
async function archiveSellerCommitments(now) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const records = await db.select().from(sellerCommitments).where(and3(lte(sellerCommitments.archiveEligibleAt, now), isNull2(sellerCommitments.archivedAt)));
  for (const record of records) {
    const snapshot = buildArchiveSnapshot("seller_commitment", record, now);
    const stored = await storagePut(`archives/vouch-market/seller-commitments/${record.publicId}.json`, snapshot, "application/json");
    await db.update(sellerCommitments).set({ archivedAt: now }).where(eq4(sellerCommitments.id, record.id));
  }
  return records.length;
}
async function runMarketArchive(now = /* @__PURE__ */ new Date()) {
  const [requests, sellerCommitments2] = await Promise.all([archiveRequests(now), archiveSellerCommitments(now)]);
  return { archivedRequests: requests, archivedSellerCommitments: sellerCommitments2, archivedAt: now.toISOString() };
}

// server/routers/admin.ts
var wallet = z2.string().trim().min(32).max(64);
var proof = z2.object({ challengeId: z2.string().min(8), signature: z2.string().min(20) });
function configuredAdminWallets() {
  return [process.env.SOLANA_RECIPIENT_WALLET, ...(process.env.ADMIN_SOLANA_WALLETS ?? "").split(",")].map((wallet3) => wallet3?.trim()).filter((wallet3) => Boolean(wallet3));
}
function assertConfiguredAdminWallet(candidate) {
  if (!configuredAdminWallets().includes(candidate)) {
    throw new TRPCError3({ code: "FORBIDDEN", message: "Connect an authorized administrator wallet to continue" });
  }
}
async function verifyAdminWallet(input) {
  assertConfiguredAdminWallet(input.wallet);
  await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "admin_access" });
}
var adminRouter = router({
  operations: rateLimitedPublicProcedure.input(z2.object({ wallet, proof })).mutation(async ({ input }) => {
    await verifyAdminWallet(input);
    return getOperations();
  }),
  createProject: rateLimitedPublicProcedure.input(z2.object({ wallet, proof, slug: z2.string().trim().regex(/^[a-z0-9-]+$/).min(2).max(64), name: z2.string().trim().min(2).max(120), description: z2.string().trim().max(800).optional() })).mutation(async ({ input }) => {
    await verifyAdminWallet(input);
    return createMarketProject({ slug: input.slug, name: input.name, description: input.description });
  }),
  archiveEligible: rateLimitedPublicProcedure.input(z2.object({ wallet, proof })).mutation(async ({ input }) => {
    await verifyAdminWallet(input);
    return runMarketArchive();
  }),
  setLegacyOfferPoints: rateLimitedPublicProcedure.input(z2.object({ offerPublicId: z2.string().regex(/^ASK-/), pointsPerUnit: z2.number().int().min(1).max(1e9), wallet, proof })).mutation(async ({ input }) => {
    try {
      await verifyAdminWallet(input);
      return await setLegacyOfferPoints({ ...input, adminWallet: input.wallet });
    } catch (error) {
      if (error instanceof TRPCError3) throw error;
      throw new TRPCError3({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Point value could not be recorded" });
    }
  }),
  recordPayout: rateLimitedPublicProcedure.input(z2.object({ commitmentPublicId: z2.string().regex(/^(FILL|ASK)-/), status: z2.enum(["sent", "withheld"]), externalReference: z2.string().trim().max(160).optional(), adminNote: z2.string().trim().max(1e3).optional(), wallet, proof })).mutation(async ({ input }) => {
    try {
      await verifyAdminWallet(input);
      await recordPayoutDecision({ ...input, adminOpenId: `wallet:${input.wallet}` });
      return { ok: true };
    } catch (error) {
      if (error instanceof TRPCError3) throw error;
      throw new TRPCError3({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Payout record could not be saved" });
    }
  })
});

// server/routers/market.ts
import { TRPCError as TRPCError4 } from "@trpc/server";
import { z as z3 } from "zod";
import { PublicKey as PublicKey3 } from "@solana/web3.js";

// server/market/solana.ts
import { Connection, PublicKey as PublicKey2 } from "@solana/web3.js";
function parsedTransfers(instructions) {
  return instructions.flatMap((instruction) => {
    if (!("parsed" in instruction) || !instruction.parsed || typeof instruction.parsed !== "object") return [];
    const parsed = instruction.parsed;
    if (parsed.type !== "transferChecked" || !parsed.info?.destination || !parsed.info.tokenAmount?.amount) return [];
    return [parsed.info];
  });
}
async function verifyUsdcPayment(input) {
  const rpcUrl = process.env.SOLANA_RPC_URL;
  const recipientWallet = process.env.SOLANA_RECIPIENT_WALLET;
  if (!rpcUrl || !recipientWallet) throw new Error("Payment verification is not configured");
  const connection = new Connection(rpcUrl, "finalized");
  const status = (await connection.getSignatureStatuses([input.signature], { searchTransactionHistory: true })).value[0];
  if (!status || status.err || status.confirmationStatus !== "finalized") {
    throw new Error("Payment is not finalized yet; try again after confirmation");
  }
  const transaction = await connection.getParsedTransaction(input.signature, {
    commitment: "finalized",
    maxSupportedTransactionVersion: 0
  });
  if (!transaction || !transaction.meta || transaction.meta.err) throw new Error("Finalized payment details are unavailable");
  const meta = transaction.meta;
  if (!transaction.blockTime || transaction.blockTime * 1e3 < input.earliestAllowedAt.getTime() - 6e4) {
    throw new Error("Payment predates this request");
  }
  const buyerSigned = transaction.transaction.message.accountKeys.some(
    (account) => account.signer && account.pubkey.equals(new PublicKey2(input.buyerWallet))
  );
  if (!buyerSigned) throw new Error("The submitted wallet did not authorize this payment");
  const outer = parsedTransfers(transaction.transaction.message.instructions);
  const inner = (meta.innerInstructions ?? []).flatMap((group) => parsedTransfers(group.instructions));
  const transfers = [...outer, ...inner].filter(
    (transfer) => transfer.authority === input.buyerWallet && transfer.mint === USDC_MINT
  );
  const expectedMicro = decimalToUsdcMicro(input.expectedUsdc);
  let receivedMicro = 0;
  for (const transfer of transfers) {
    const destination = new PublicKey2(transfer.destination);
    const account = await connection.getParsedAccountInfo(destination, "finalized");
    const data = account.value?.data;
    if (!data || typeof data !== "object" || !("parsed" in data)) continue;
    const info = data.parsed.info;
    if (info?.owner !== recipientWallet || info.mint !== USDC_MINT) continue;
    receivedMicro += Number(transfer.tokenAmount.amount);
  }
  if (receivedMicro !== expectedMicro) {
    throw new Error("The confirmed USDC amount does not exactly match this request");
  }
  return { signature: input.signature, receivedUsdc: input.expectedUsdc };
}

// server/routers/market.ts
var wallet2 = z3.string().trim().min(32).max(64).refine((value) => {
  try {
    new PublicKey3(value);
    return true;
  } catch {
    return false;
  }
}, "Enter a valid Solana wallet address");
var instrument = z3.enum(["vouch", "slash"]);
var proof2 = z3.object({ challengeId: z3.string().min(8), signature: z3.string().min(20) });
var xHandle = z3.string().trim().min(1).max(16).regex(/^@?[A-Za-z0-9_]+$/, "Enter a valid X handle");
function marketError(error) {
  throw new TRPCError4({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "The request could not be processed" });
}
var marketRouter = router({
  board: publicProcedure.query(async () => getPublicMarket()),
  activity: rateLimitedPublicProcedure.input(z3.object({ wallet: wallet2, proof: proof2 })).mutation(async ({ input }) => {
    try {
      await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "activity_view" });
      return getParticipantActivity(input.wallet);
    } catch (error) {
      marketError(error);
    }
  }),
  walletChallenge: rateLimitedPublicProcedure.input(z3.object({ wallet: wallet2, action: z3.enum(["buyer_request", "seller_offer", "seller_fill", "buyer_done", "seller_done", "cancel_request", "seller_delist", "offer_buy", "offer_buyer_done", "activity_view", "admin_access"]) })).mutation(async ({ input }) => {
    try {
      return await createWalletChallenge(input.wallet, input.action);
    } catch (error) {
      marketError(error);
    }
  }),
  createRequest: rateLimitedPublicProcedure.input(z3.object({ wallet: wallet2, targetHandle: xHandle, projectSlug: z3.string().trim().min(2).max(64).default("commonsmade"), instrument: instrument.default("vouch"), quantity: z3.number().int().positive().max(1e6), pricePerVouch: z3.number().positive().max(1e4), proof: proof2 })).mutation(async ({ input }) => {
    try {
      await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "buyer_request" });
      const created = await createRequest({ buyerWallet: input.wallet, targetHandle: input.targetHandle.replace(/^@/, ""), projectSlug: input.projectSlug, instrument: input.instrument, requestedQuantity: input.quantity, pricePerVouch: input.pricePerVouch, totalUsdc: input.quantity * input.pricePerVouch });
      return { ...created, recipientWallet: process.env.SOLANA_RECIPIENT_WALLET ?? "", usdcMint: USDC_MINT };
    } catch (error) {
      marketError(error);
    }
  }),
  paymentDetails: publicProcedure.input(z3.object({ publicId: z3.string().startsWith("REQ-"), wallet: wallet2 })).query(async ({ input }) => {
    try {
      const details = await getPaymentDetails(input.publicId, input.wallet);
      return { ...details, recipientWallet: process.env.SOLANA_RECIPIENT_WALLET ?? "", usdcMint: USDC_MINT };
    } catch (error) {
      marketError(error);
    }
  }),
  verifyPayment: rateLimitedPublicProcedure.input(z3.object({ publicId: z3.string().startsWith("REQ-"), wallet: wallet2, signature: z3.string().min(64).max(128) })).mutation(async ({ input }) => {
    try {
      const request = await activatePaidRequest({ publicId: input.publicId, signature: input.signature, buyerWallet: input.wallet });
      await verifyUsdcPayment({ signature: input.signature, buyerWallet: input.wallet, expectedUsdc: request.totalUsdc, earliestAllowedAt: request.createdAt });
      await recordVerifiedPayment(input.publicId, input.signature, input.wallet);
      return { ok: true };
    } catch (error) {
      marketError(error);
    }
  }),
  createSellerOffer: rateLimitedPublicProcedure.input(z3.object({ wallet: wallet2, profileHandle: xHandle, projectSlug: z3.string().trim().min(2).max(64).default("commonsmade"), instrument: instrument.default("vouch"), quantity: z3.number().int().positive().max(1e6), pointsPerUnit: z3.number().int().positive().max(1e9), pricePerVouch: z3.number().positive().max(1e4), proof: proof2 })).mutation(async ({ input }) => {
    try {
      await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "seller_offer" });
      return await createSellerOffer({ sellerWallet: input.wallet, profileHandle: input.profileHandle.replace(/^@/, ""), projectSlug: input.projectSlug, instrument: input.instrument, quantity: input.quantity, pointsPerUnit: input.pointsPerUnit, pricePerVouch: input.pricePerVouch });
    } catch (error) {
      marketError(error);
    }
  }),
  fillRequest: rateLimitedPublicProcedure.input(z3.object({ requestPublicId: z3.string().startsWith("REQ-"), wallet: wallet2, profileHandle: xHandle, quantity: z3.number().int().positive(), pointsPerUnit: z3.number().int().positive().max(1e9), proof: proof2 })).mutation(async ({ input }) => {
    try {
      await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "seller_fill" });
      return await fillRequest({ requestPublicId: input.requestPublicId, sellerWallet: input.wallet, profileHandle: input.profileHandle.replace(/^@/, ""), quantity: input.quantity, pointsPerUnit: input.pointsPerUnit });
    } catch (error) {
      marketError(error);
    }
  }),
  initiateOfferPurchase: rateLimitedPublicProcedure.input(z3.object({ publicId: z3.string().startsWith("ASK-"), wallet: wallet2, targetHandle: xHandle, proof: proof2 })).mutation(async ({ input }) => {
    try {
      await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "offer_buy" });
      const created = await initiateOfferPurchase({ offerPublicId: input.publicId, buyerWallet: input.wallet, targetHandle: input.targetHandle });
      return { ...created, recipientWallet: process.env.SOLANA_RECIPIENT_WALLET ?? "", usdcMint: USDC_MINT };
    } catch (error) {
      marketError(error);
    }
  }),
  offerPaymentDetails: publicProcedure.input(z3.object({ publicId: z3.string().startsWith("ASK-"), wallet: wallet2 })).query(async ({ input }) => {
    try {
      const details = await getOfferPaymentDetails(input.publicId, input.wallet);
      return { ...details, recipientWallet: process.env.SOLANA_RECIPIENT_WALLET ?? "", usdcMint: USDC_MINT };
    } catch (error) {
      marketError(error);
    }
  }),
  verifyOfferPayment: rateLimitedPublicProcedure.input(z3.object({ publicId: z3.string().startsWith("ASK-"), wallet: wallet2, signature: z3.string().min(64).max(128) })).mutation(async ({ input }) => {
    try {
      const offer = await activateOfferPurchase({ publicId: input.publicId, signature: input.signature, buyerWallet: input.wallet });
      await verifyUsdcPayment({ signature: input.signature, buyerWallet: input.wallet, expectedUsdc: offer.grossUsdc, earliestAllowedAt: offer.createdAt });
      await recordVerifiedOfferPurchase(input.publicId, input.signature, input.wallet);
      return { ok: true };
    } catch (error) {
      marketError(error);
    }
  }),
  delistSellerOffer: rateLimitedPublicProcedure.input(z3.object({ publicId: z3.string().startsWith("ASK-"), wallet: wallet2, proof: proof2 })).mutation(async ({ input }) => {
    try {
      await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "seller_delist" });
      await delistSellerOffer(input.publicId, input.wallet);
      return { ok: true };
    } catch (error) {
      marketError(error);
    }
  }),
  markBuyerDone: rateLimitedPublicProcedure.input(z3.object({ publicId: z3.string().startsWith("REQ-"), wallet: wallet2, proof: proof2 })).mutation(async ({ input }) => {
    try {
      await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "buyer_done" });
      await markBuyerDone(input.publicId, input.wallet);
      return { ok: true };
    } catch (error) {
      marketError(error);
    }
  }),
  markSellerDone: rateLimitedPublicProcedure.input(z3.object({ publicId: z3.string().regex(/^(FILL|ASK)-/), wallet: wallet2, proof: proof2 })).mutation(async ({ input }) => {
    try {
      await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "seller_done" });
      await markSellerDone(input.publicId, input.wallet);
      return { ok: true };
    } catch (error) {
      marketError(error);
    }
  }),
  markOfferBuyerDone: rateLimitedPublicProcedure.input(z3.object({ publicId: z3.string().startsWith("ASK-"), wallet: wallet2, proof: proof2 })).mutation(async ({ input }) => {
    try {
      await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "offer_buyer_done" });
      await markOfferBuyerDone(input.publicId, input.wallet);
      return { ok: true };
    } catch (error) {
      marketError(error);
    }
  }),
  cancelRequest: rateLimitedPublicProcedure.input(z3.object({ publicId: z3.string().startsWith("REQ-"), wallet: wallet2, proof: proof2 })).mutation(async ({ input }) => {
    try {
      await verifyWalletChallenge({ ...input.proof, wallet: input.wallet, action: "cancel_request" });
      await cancelUnpaidRequest(input.publicId, input.wallet);
      return { ok: true };
    } catch (error) {
      marketError(error);
    }
  })
});

// server/routers.ts
var appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  market: marketRouter,
  admin: adminRouter
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/app.ts
function createVouchApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "2mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}

// server/vercel/trpcHandler.ts
var trpcHandler_default = createVouchApp();
export {
  trpcHandler_default as default
};
