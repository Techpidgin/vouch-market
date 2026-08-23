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

## 5% fee handling

The marketplace calculates **gross amount**, **5% platform fee**, and **seller net** in micro-USDC units. The buyer pays the listed gross amount. The review desk records the seller net amount as the amount to send manually, while retaining the gross and fee values for audit. This is a product accounting rule, not tax or regulatory advice. A qualified legal and tax professional should review the operating model before public launch.

## References

[1] Vercel, [Functions](https://vercel.com/docs/functions).

[2] Upstash, [Connect with `@upstash/redis`](https://upstash.com/docs/redis/howto/connect-with-upstash-redis).

[3] Upstash, [REST API](https://upstash.com/docs/redis/features/restapi).
