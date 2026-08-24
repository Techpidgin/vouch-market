# HANKA Fresh Neon Database

HANKA now targets a clean Neon PostgreSQL database and **does not import the former managed MySQL/TiDB records**. The earlier database remains unchanged, but the active Neon-backed deployment starts with an empty market and accepts new wallet-first listings, requests, allocations, and operations records.

## Vercel connection requirements

The Neon connection must be linked to the active `vouch-market` Vercel project. Neon’s Vercel integration provides `DATABASE_URL` for the production branch; HANKA also accepts `POSTGRES_URL` as a fallback. The value must be a PostgreSQL URL, not the previous MySQL connection string. Neon documents that its Vercel integration injects `DATABASE_URL` and related PostgreSQL variables per deployment.[1]

Vercel now runs `pnpm run db:migrate && pnpm run build:vercel`. The first clean production deployment creates the PostgreSQL schema through the generated Drizzle migration; later deployments apply only outstanding migrations. Keep `DATABASE_URL`, `JWT_SECRET`, `SOLANA_RPC_URL`, `SOLANA_RECIPIENT_WALLET`, and any administrator wallet allowlist server-side. Upstash remains optional and cache-only.

The Vercel configuration also rewrites non-API deep links, including `/market` and `/ops`, to the Vite SPA entry point while explicitly excluding `/api/*`. This keeps direct public links functional without intercepting the database-backed tRPC function.[3]

The tRPC function is pre-bundled as `api/trpc/[...path].js` from `server/vercel/trpcHandler.ts` before deployment. This is intentional: Vercel's Node ESM runtime must receive the bundled local server graph rather than resolve TypeScript imports from `server/_core` at request time.

## Intentional fresh-start behavior

| Area | Fresh Neon behavior |
| --- | --- |
| Public board | Starts empty until a new vouch, slash, or bid is posted. |
| Legacy rows | Not copied, displayed, or deleted. |
| Payment and allocation protections | Created anew for each new market action. |
| Upstash | Stores only short-lived public-board and rate-limit keys; it never supplies historic market records. |

## References

[1] Neon, [Connecting with the Neon-Managed Vercel Integration](https://neon.com/docs/guides/neon-managed-vercel-integration).

[2] Drizzle ORM, [Drizzle <> Neon Postgres](https://orm.drizzle.team/docs/connect-neon).

[3] Vercel, [Rewrites on Vercel](https://vercel.com/docs/routing/rewrites).
