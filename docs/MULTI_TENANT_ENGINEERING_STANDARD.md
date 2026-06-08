# OlkoCMS Multi-Tenant - Engineering Standard (non-negotiable rules)

Companion to MULTI_TENANT_PLAN.md. These rules apply to EVERY commit of the multi-tenant work. They encode the owner's directives: future-proof, additive (never wipe), no customer-data loss, leak-proof, no bugs/limitations, fast load + fast processing. Tenant = `Subscription` (no separate Tenant model - schema already has `subscriptionId` on User/Staff/Payment + session already carries it).

---

## A. ADDITIVE, NEVER DESTRUCTIVE (so future redesign only ADDS, never forces a rewrite or data wipe)

1. Schema changes are add-only: new column / new model. NEVER drop or rename a populated column in the same step. If a field must go, deprecate (stop writing) -> migrate readers -> remove much later in its own commit.
2. New scoping column always lands in 3 ordered moves: (i) add as NULLABLE, (ii) backfill all existing rows, (iii) only then enforce NOT NULL. Never add NOT NULL to a populated table directly (breaks on push, risks data).
3. Old routes keep working during migration. Auto-scoping is introduced centrally so route code does NOT all have to change at once. Routes migrate incrementally; nothing is a big-bang cutover.
4. One logical change = one commit with a clear message, so any step is independently reversible with `git revert`. Verify (`Select-String` + build + manual check) BEFORE each commit.
5. Design every new model/field so adding the NEXT capability is a new field, not a reshape. Prefer explicit FK + index over clever overloading.

## B. NO CUSTOMER DATA LOSS

1. Backfills run in the Neon SQL Editor (no Vercel 10s cap), in batches if huge, never via a fragile loop that can half-finish.
2. Before enforcing NOT NULL or removing anything: COUNT rows per table, confirm 0 NULLs / expected totals. Record the numbers in the commit message.
3. Every migration step has a written rollback (how to undo). If a step can't be safely undone, it's split until it can.
4. Encryption keys / tokens are never logged, never committed. Rotate anything that ever hit git.

## C. LEAK-PROOF TENANCY (security property - one breach = serious)

1. `subscriptionId` for the current request ALWAYS comes from the authenticated session/JWT (already present in token). It is NEVER read from a request body, query param, or header the client controls.
2. The Prisma client auto-injects `subscriptionId` on every find/create/update/delete via a Client Extension + request-scoped context (AsyncLocalStorage). Default = tenant-scoped.
3. Cross-tenant access (super-admin views, cron over all tenants, webhooks before tenant is known) uses an EXPLICIT separate unscoped client. Opt-in, rare, code-reviewed, and logged. Never the default.
4. Webhooks resolve tenant by external id (pageId / phone_number_id / daraz store) -> Connection -> subscriptionId BEFORE writing any row. No match -> drop safely, never write to a guessed tenant.
5. New tenant-scoped models MUST get `subscriptionId` from day one - no model is added without it (unless deliberately global, e.g. Plan).

## D. PERFORMANCE (fast load, fast processing - user must never feel lag)

1. Every tenant-scoped table gets `@@index([subscriptionId])` and, for hot queries, a compound `@@index([subscriptionId, <filter/sort column>])` (e.g. `[subscriptionId, status]`, `[subscriptionId, trackingNo]`, `[subscriptionId, createdAt]`). Because subscriptionId is now in EVERY where-clause, the wrong index = full scan = slow.
2. The auto-scoping extension stays minimal - no per-query DB round-trips, no heavy work; it only mutates the query args in memory.
3. Keep using the Neon POOLER url on Vercel (existing rule). Watch connection count.
4. Pagination on all list endpoints (never load a whole tenant's orders/messages at once). Select only needed columns.
5. Per-tenant cron/batch work uses resume cursors and stays under Vercel 10s (same pattern as fill-returns/fill-tracking). Re-evaluate cron strategy as tenant count grows (see PLAN section 11).
6. No N+1: use `include`/`select` and batched queries; avoid querying inside loops.

## E. CORRECTNESS / NO HIDDEN BUGS

1. After every schema/code step: `Select-String`-verify the change landed (the USE site, not just an import - heredoc/CRLF can land one and miss the other), then `npm run build`, then manual smoke test, then commit + push.
2. Files written BOM-free (`WriteAllText` + UTF8Encoding $false). Injected code ASCII-only (heredoc corrupts Nepali). Verify no mojibake: `Select-String -Path <file> -Pattern "[^\x00-\x7F]"` should be empty for injected code.
3. Prisma 5.22 stays (v7 incompatible). `prisma generate` after every schema change; regenerate on each machine after pulling.
4. Test isolation explicitly: before trusting auto-scoping, create a 2nd test subscription, add data, and PROVE tenant A never sees tenant B (the pilot gate in PLAN phase 3).

## F. ROLLOUT DISCIPLINE

- Follow PLAN phases 1->4 in order. Within Phase 1: 1a schema (nullable) -> 1b backfill + NOT NULL -> 1c auto-scoping extension -> 1d migrate routes incrementally.
- Commit MULTI_TENANT_PLAN.md and this standard to docs/ so the design survives across chats/machines.
- Each step leaves the current single-business app fully working.
