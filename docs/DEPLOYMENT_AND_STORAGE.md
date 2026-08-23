# Deployment and Storage Decision

## Recommendation

For the **current build**, deploy the Vercel-compatible static output and serverless API together. Keep Solana verification, payment evidence, administrator checks, and compact operational records behind server-side request handlers. There is **no recurring scheduler** in this operating model.

This is the lower-risk path because **USDC verification, payment signatures, payout evidence, and the configured recipient/admin wallet must remain server-side**. Moving only the visual frontend to Vercel would require a separately deployed API, a CORS policy, a public API origin, environment-variable duplication, and equivalent access control. It adds operational surface without improving the current payment flow.

> **Recommendation:** Use Vercel for the frontend and request-scoped serverless API, then attach Supabase as the durable Postgres store when its integration is configured. Do not split browser and payment-verification logic across hosts.

## Viable options

| Option | Architecture | Strength | Trade-off |
| --- | --- | --- | --- |
| **A. Vercel + Supabase (recommended)** | Vercel static build and serverless API, Supabase Postgres, and optional private Supabase Storage. | Compact, request-scoped production model with no background process. | Requires Supabase environment values and schema migration. |
| **B. Current managed database while Vercel serves the app** | Vercel static build and serverless adapter plus the current database during transition. | Preserves existing records while Supabase is configured. | Temporary two-platform deployment state. |

Vercel Functions are request-scoped server-side code and can host API handlers, while Vercel’s Marketplace integrates databases such as Neon and Supabase into a Vercel project.[1] [2]

## Storage policy

Keep **only active market records, payment evidence required for review, and payout decisions** in the relational database. The review desk provides an administrator-triggered compact action for eligible records. That action removes archived records from the public board and retains only a sanitized summary without wallet addresses or transaction signatures.

For a Vercel-native migration, use one of the following storage patterns:

| Data category | Recommended service | Access rule |
| --- | --- | --- |
| Listings, purchase states, completion marks, payout amounts | Postgres (Neon or Supabase Postgres) | Server-side service credential only; public API returns redacted rows. |
| Sanitized archive summaries, only when needed | Private Supabase Storage bucket or compact Postgres JSON record | No direct public links; retain no wallet address or transaction signature in the summary. |
| Server secrets | Vercel project environment variables | Never expose RPC endpoints, recipient-wallet controls, or admin secrets to browser code. |

Supabase Storage supports policy-based access controls and S3-compatible storage, making it suitable for private archive files when paired with server-side access controls.[4] Vercel Storage also supports file-oriented Blob storage and Marketplace databases.[2]

## Required Vercel migration work

When Supabase is configured, migrate the backend in this order. First, create a Postgres schema for projects, active requests, active seller offers, payment signatures, completion marks, fee records, payouts, and minimal archive metadata. Second, move all Supabase credentials, Solana RPC values, and recipient-wallet values into server-only Vercel environment variables. Third, point the data-access layer at Supabase Postgres and test public redaction plus administrator wallet checks. Finally, verify that the private review desk can compact eligible records on demand without any scheduled call.

## 5% fee handling

The marketplace calculates **gross amount**, **5% platform fee**, and **seller net** in micro-USDC units. The buyer pays the listed gross amount. The review desk records the seller net amount as the amount to send manually, while retaining the gross and fee values for audit. This is a product accounting rule, not tax or regulatory advice. A qualified legal and tax professional should review the operating model before public launch.

## References

[1] Vercel, [Functions](https://vercel.com/docs/functions).

[2] Vercel, [Storage overview](https://vercel.com/docs/storage).

[3] Supabase, [Storage](https://supabase.com/docs/guides/storage).
