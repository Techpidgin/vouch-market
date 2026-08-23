# Supabase Minimal-Data Handoff

## Purpose

Use Supabase **Postgres** as the durable store when the integration is enabled. The marketplace should keep only data required to operate active listings, verify USDC payments, review fulfilment, record a manual payout decision, and resolve an active dispute. The browser must never receive service-role credentials, raw payment signatures outside the private review desk, or participant wallet addresses belonging to another user.

## Minimal retained model

| Record | Keep while active | Compact or remove after administrator review |
| --- | --- | --- |
| Buyer request | Public ID, project slug, point band, quantity, price, state, buyer wallet, payment signature, completion mark | Replace public visibility with a sanitized summary that excludes wallet and signature. |
| Seller offer / direct purchase | Public ID, project slug, point band, quantity, ask, state, seller wallet, buyer wallet only once purchased, payment signature, completion marks | Replace public visibility with a sanitized summary that excludes both wallets and signature. |
| Payout record | Seller commitment link, gross amount, 5% fee, seller net, decision state, external reference, administrator note | Keep only for the shortest period required for operational reconciliation and any applicable legal obligation. |
| Activity log | Event type, public ID, timestamp, administrator ID where needed | Do not store wallet addresses in the compact event log. |

> **Data-minimization rule:** Do not retain a wallet address, payment signature, or private reviewer note in an archive summary. Public lists must exclude archived records entirely.

## Required Supabase configuration

Create a Supabase project and a Postgres connection. Add the connection string as a **server-only** Vercel environment variable; do not prefix it with `VITE_`. Keep the Solana RPC URL, USDC recipient wallet, and any Supabase service-role key server-only as well. Use Row Level Security for any Supabase table or storage bucket that could be read by a browser-facing client.[1] [2]

| Environment variable | Usage | Browser exposure |
| --- | --- | --- |
| `SUPABASE_DATABASE_URL` | Postgres connection used by Vercel serverless handlers | Never expose |
| `SUPABASE_URL` | Server-side Supabase endpoint | Never expose unless a deliberately restricted browser client is introduced |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional private archive storage or administrative migration work | Never expose |
| `SOLANA_RPC_URL` | Server-side USDC transaction verification | Never expose |
| `SOLANA_RECIPIENT_WALLET` | Payment recipient and administrator-wallet control | Server-only configuration |

## No-cron retention flow

The private review desk includes **Compact eligible records**. It is an explicit administrator action, not a timer or background task. It archives only records already eligible under the configured retention rule, removes them from the public market response, and stores a sanitized operational summary. This keeps serverless execution request-scoped and avoids scheduled infrastructure.

## Migration sequence

First provision Supabase and create the tables with the same active-market fields used by the current database model. Second, switch the data access implementation to a Postgres driver and verify all procedures against a staging Supabase project. Third, migrate only active and required review records; do not copy historic raw wallet/signature data unnecessarily. Finally, deploy the Vercel build and exercise a real wallet test with a low-value USDC transfer before opening the market publicly.

## References

[1] Supabase, [Database](https://supabase.com/docs/guides/database).

[2] Supabase, [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
