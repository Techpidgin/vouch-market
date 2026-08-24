# Deployment and Storage Decision

## Recommendation

For the **current build**, deploy the Vercel-compatible static output and serverless API together. Keep Solana verification, payment evidence, administrator checks, and compact operational records behind server-side request handlers. Upstash Redis provides a short-lived cache of public market data only. There is **no recurring scheduler** in this operating model.

This is the lower-risk path because **USDC verification, payment signatures, payout evidence, and the configured recipient/admin wallet must remain server-side**. Moving only the visual frontend to Vercel would require a separately deployed API, a CORS policy, a public API origin, environment-variable duplication, and equivalent access control. It adds operational surface without improving the current payment flow.

> **Recommendation:** Use Vercel for the frontend and request-scoped serverless API, with Upstash for compact public-board state. Do not split browser and payment-verification logic across hosts.

## Viable options

| Option | Architecture | Strength | Trade-off |
| --- | --- | --- | --- |
| **A. Vercel + Upstash (recommended)** | Vercel static build and serverless API, Upstash Redis for short-lived public-board state, and the durable payment data store. | Compact, request-scoped production model with no background process. | Upstash is deliberately not used for financial evidence. |
| **B. Current managed database while Vercel serves the app** | Vercel static build and serverless adapter plus the current database during transition. | Preserves existing records while Upstash serves only public state. | Temporary two-platform deployment state. |

Vercel Functions are request-scoped server-side code and can host API handlers, while Upstash exposes an HTTP-based Redis interface suitable for serverless state.[1] [2]

## Storage policy

Keep **only active market records, payment evidence required for review, and payout decisions** in the relational database. The review desk provides an administrator-triggered compact action for eligible records. That action removes archived records from the public board and retains only a sanitized summary without wallet addresses or transaction signatures.

For a Vercel-native migration, use one of the following storage patterns:

| Data category | Recommended service | Access rule |
| --- | --- | --- |
| Listings, purchase states, completion marks, payout amounts | Existing durable relational data store | Server-side credential only; public API returns redacted rows. |
| Public listing cache | Upstash Redis | Public market data only; 45-second TTL; invalidated after marketplace activity changes. |
| Sanitized archive summaries, only when needed | Private object storage or compact durable JSON record | No direct public links; retain no wallet address or transaction signature in the summary. |
| Server secrets | Vercel project environment variables | Never expose RPC endpoints, recipient-wallet controls, or admin secrets to browser code. |

Upstash is limited to compact public-market state in this architecture. Private archive files remain in private object storage or durable server-side storage, where access stays behind the review desk.[3]

## Required Vercel migration work

When Upstash is configured, add its REST URL and token to the server-only Vercel environment. Then verify that the public board uses its short-lived cache while a listing mutation invalidates that cache. Continue to keep payment signatures, wallet addresses, payout records, and archive summaries in durable server-side storage.

## Recovering existing listings in an external Vercel deployment

The public board is not seeded from the frontend bundle or from Upstash. It reads open, point-declared source offers and paid buyer requests from the durable relational database through the `/api/trpc` Vercel function. Consequently, a Vercel deployment that has no `DATABASE_URL`, points to a fresh database, or cannot reach the existing database will show an empty board even though the managed deployment still has live listings.

To surface the existing market on Vercel, deploy the repository root so both `dist/public` and `api/[...path].ts` are included, then set the following **Production** environment values in Vercel. Do not prefix any server value with `VITE_`.

| Variable | Required for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Existing listings, bids, payments, and private operations | Must be the same durable MySQL/TiDB database that contains the existing market records, and it must accept encrypted inbound connections from Vercel. |
| `JWT_SECRET` | Signed application/session infrastructure | Use the matching production secret; never expose it in browser code. |
| `SOLANA_RPC_URL` | On-chain USDC verification | Server-side RPC endpoint only. |
| `SOLANA_RECIPIENT_WALLET` | Payment-recipient verification and administrator allowlist | Must match the operating wallet used by the market. |
| `ADMIN_SOLANA_WALLETS` | Additional wallet-only operations administrators | Comma-separated public keys, if additional administrators are required. |
| `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` | Optional cache and rate limit | Missing Upstash does **not** remove listings; the board falls back to the durable database. |

If the current managed database is not externally reachable, first migrate its schema and records to a Vercel-reachable MySQL/TiDB database, then place that new connection string in `DATABASE_URL`. Do not create replacement listings in the Vercel database: copying the durable records is required to preserve allocations, payment-signature protection, and operations history. After setting the values, redeploy `main` and confirm the browser request to `/api/trpc/market.board` returns HTTP 200 with the expected rows.

## 5% fee handling

The marketplace calculates **gross amount**, **5% platform fee**, and **seller net** in micro-USDC units. The buyer pays the listed gross amount. The review desk records the seller net amount as the amount to send manually, while retaining the gross and fee values for audit. This is a product accounting rule, not tax or regulatory advice. A qualified legal and tax professional should review the operating model before public launch.

## References

[1] Vercel, [Functions](https://vercel.com/docs/functions).

[2] Upstash, [Connect with `@upstash/redis`](https://upstash.com/docs/redis/howto/connect-with-upstash-redis).

[3] Upstash, [REST API](https://upstash.com/docs/redis/features/restapi).
