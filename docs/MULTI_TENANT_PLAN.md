# OlkoCMS - Multi-Tenant (SaaS / Subscriber) Architecture Plan

Status: PLANNING (v1, 2026-06-08). Nothing here is built yet. This doc is the design + decision record before any schema change. Implementation is phased (see section 13) - do NOT attempt all at once.

---

## 0. Current state (single-tenant)

- Today OlkoCMS runs ONE business (Gadget Finder / Raibaar pages). All data sits in one Neon DB with no tenant separation.
- Confirmed in findings: Daraz models have **no `subscriptionId` / tenancy link**; `storeId` is a plain string filled at match-time. "All Daraz data shares one pool today... real per-subscriber guard needs schema tenancy fields first - deferred as a separate project."
- External tokens (FB page tokens, Daraz app key/secret, WhatsApp token) live in **env vars** - one set, for the owner only.
- Auth: NextAuth JWT, single `lib/auth.ts`, User-then-Staff authorize.
- Plan / Subscription / Payment models already exist (billing groundwork done).

Goal: let many independent merchants (subscribers) each use OlkoCMS with their OWN data, their OWN Facebook/IG/WhatsApp/Daraz connections, fully isolated from each other.

---

## 1. DECISION 1 - Tenancy model: shared DB, row-level `tenantId` (RECOMMENDED)

Three industry options:

| Model | What it is | Fit for OlkoCMS |
|---|---|---|
| **Row-level (shared DB + `tenantId` column)** | One DB, every business row tagged with `tenantId`, every query filters by it | **BEST** - cheapest, simplest on Neon free tier, easiest migration from current single pool |
| Schema-per-tenant | One DB, separate Postgres schema per tenant | Heavy; Prisma support awkward; overkill at this scale |
| DB-per-tenant | A whole separate database per tenant | Strongest isolation but expensive, complex provisioning, bad on free tier |

**Recommendation: row-level shared DB.** It matches the findings' own direction ("add tenancy fields to the shared pool"), is the standard for early-stage SaaS, and keeps Neon/Vercel costs flat. The trade-off (isolation depends on app-layer discipline) is handled in DECISION 2.

---

## 2. The `Tenant` model - what a "tenant" is

A tenant = one subscribing merchant business. Add a top-level model:

```
model Tenant {
  id            String   @id @default(cuid())
  name          String                 // merchant business name
  slug          String   @unique        // url-safe handle
  status        String   @default("active")  // active | suspended | trial
  createdAt     DateTime @default(now())
  // relations: users, products, orders, messages, daraz*, subscription, connections...
}
```

- Existing `Subscription` links `Tenant -> Plan` (one active subscription per tenant). Confirm against the real schema - Subscription may already be the de-facto account; if so, `Tenant` may wrap or replace it. **First implementation step = read `prisma/schema.prisma` and reconcile.**
- Tenant owner = the first admin `User` of that tenant.

---

## 3. Schema changes - `tenantId` on every business table

Add a non-null `tenantId` (FK -> Tenant) to ALL business-data models. From the current model list:

- Core: `User`, `Staff`, `Product`, `Order`, `Message`, `Followup`, `Shipment`, `AIConversation`, `ActivityLog`
- Ads/P&L: `AdCampaign`, `AdExpense`, `AdOrder`
- Daraz: `DarazStore`, `DarazOrder`, `DarazOrderItem`, `DarazScan`, `DarazClaim`, `DarazAlert`
- Billing: `Subscription`, `Payment` (link to Tenant)

Add a compound index on `(tenantId, <hot filter column>)` for the queries that run most (e.g. `(tenantId, status)`, `(tenantId, trackingNo)`), so per-tenant filtering stays fast.

NOT tenant-scoped (global): `Plan` (shared catalogue), any system-config tables.

Migration note: adding a NOT NULL column to populated tables requires a backfill first (see section 9) - add as nullable, backfill, then enforce NOT NULL.

---

## 4. DECISION 2 - Data isolation enforcement (THE critical safety layer)

This is the single highest-risk part. With row-level tenancy, ONE query that forgets `where: { tenantId }` leaks one merchant's customers/finances to another. Manual `where` on every call is not safe enough at scale.

**Recommended: a Prisma Client Extension (Prisma 5.x) that auto-injects `tenantId`** on every read/write, derived from the current request's session - never from client input.

- A request-scoped tenant context (e.g. via `AsyncLocalStorage`) holds the `tenantId` resolved from the session.
- The extension rewrites queries: adds `tenantId` to `where` on find/update/delete, and sets `tenantId` on create.
- Code that genuinely needs cross-tenant access (admin, cron) uses an explicit "unscoped" client - opt-in, audited, rare.

**Defense in depth (optional, strong): Postgres Row-Level Security (RLS) on Neon.** Set `app.tenant_id` per connection; RLS policies block cross-tenant rows at the DB even if app code slips. More setup with Prisma + pooled connections, so treat as phase-2 hardening, not phase-1 blocker.

Rule: **tenantId always comes from the authenticated session/token, NEVER from a request body or query param.** This single rule prevents the most common multi-tenant breach.

---

## 5. Auth & session - tenantId in the JWT

- On login, resolve `User -> tenantId`, embed `tenantId` (and role) in the NextAuth JWT + session.
- Middleware / server code reads `tenantId` from the session and sets the request tenant context (section 4).
- A user belongs to exactly one tenant (simplest). If one human ever needs to manage multiple tenants, model that later as a separate membership table - do NOT design for it in v1.
- `lib/auth.ts` stays the single source; extend the `authorize` + `jwt`/`session` callbacks to carry tenant.

---

## 6. DECISION 3 - Per-tenant external connections (tokens leave env -> encrypted DB)

Biggest behavioural change. Today FB/Daraz/WhatsApp tokens are in env vars (one owner). In SaaS, each tenant connects THEIR OWN accounts.

New model:

```
model Connection {
  id          String   @id @default(cuid())
  tenantId    String
  platform    String   // facebook | instagram | whatsapp | daraz
  externalId  String   // pageId | ig id | phone_number_id | daraz seller id
  accessToken String   // ENCRYPTED at rest
  refreshToken String?  // daraz
  meta        Json?     // page name, scopes, expiry
  status      String   @default("active")
  @@unique([platform, externalId])   // for webhook -> tenant lookup
}
```

- Tokens **encrypted** before storing (app-level encryption key in env; never plaintext).
- Daraz token-refresh job now iterates per-tenant connections instead of one env secret.
- Onboarding: tenant goes through Facebook Login / Daraz OAuth in-app; we capture and store their tokens.
- This is what actually requires **Tech Provider** status on Meta (accessing other businesses' data) - so this section and the Tech Provider application go together.

---

## 7. Webhook tenant routing

Incoming webhooks must be mapped to the right tenant:

- **Facebook/IG**: event carries `entry[].id` (pageId) -> look up `Connection(platform=facebook, externalId=pageId)` -> tenantId.
- **WhatsApp**: `value.metadata.phone_number_id` -> `Connection` -> tenantId.
- **Daraz**: store/seller id -> `Connection` -> tenantId.
- The existing `/api/webhook/facebook` route (now handling FB + WhatsApp) gains a tenant-resolve step at the top; if no Connection matches, drop the event safely.
- All inserted `Message` / order rows get that resolved `tenantId`.

---

## 8. Onboarding flow (new subscriber)

1. Sign up -> create `Tenant` + first admin `User` (trial status).
2. Pick a `Plan` -> create `Subscription`.
3. Connect channels: Facebook Login (pages), Daraz OAuth, WhatsApp - each writes a `Connection`.
4. Tenant starts using dashboard; all their data auto-scoped by tenantId.

---

## 9. Migration of existing data (Gadget Finder -> Tenant 1)

- Create the first Tenant ("Gadget Finder").
- Add `tenantId` as NULLABLE to all tables (`prisma db push` / ALTER).
- Backfill: set every existing row's `tenantId` to Tenant 1. (Heavy tables: do in batches - Vercel 10s limit - or run as one-off SQL in Neon SQL Editor, which has no 10s cap.)
- Move owner's env tokens into `Connection` rows for Tenant 1.
- Then make `tenantId` NOT NULL.
- Verify counts per table match before enforcing NOT NULL.

---

## 10. Billing / plan enforcement

- `Plan` defines limits (e.g. max orders/month, max connections, AI replies/month, staff seats).
- Enforce at write-time per tenant (count check before create) and gate features by `Subscription.plan`.
- Suspended/expired subscription -> set `Tenant.status = suspended` -> middleware blocks non-billing routes. (Existing `cron/expire-subscriptions` already does subscription expiry - extend it to flip tenant status.)

---

## 11. Cron & background jobs - per-tenant (Vercel limit reality)

- Today: nightly Daraz cron is targeted + single-tenant. Multi-tenant means looping every tenant's Daraz stores.
- **Vercel Hobby = 2 daily crons, ~10s each.** This does NOT scale to many tenants doing Daraz sync nightly. This is a hard constraint, flagged early.
- Options as tenant count grows: (a) move to Vercel paid (longer timeout, more crons), (b) one cron that processes a QUEUE of tenants in small batches across multiple invocations (resume cursor, like fill-returns windowing), (c) external worker / scheduled function outside Vercel.
- v1 (few pilot tenants): batch-loop tenants inside the existing 2 crons with a resume cursor. Re-evaluate at ~10+ active tenants.

---

## 12. Scaling reality check (free tier)

- Neon free + Vercel Hobby are fine for pilot (a handful of tenants).
- Watch: Neon connection limits (use pooler URL - already the rule), Vercel 10s timeout on any per-tenant batch, cron caps.
- Plan to move to paid tiers BEFORE onboarding many paying tenants - budget this; do not promise scale on free tier.

---

## 13. Phased rollout (do in this order)

**Phase 1 - Foundation (no external behaviour change)**
- Read real `prisma/schema.prisma`; reconcile Tenant vs existing Subscription.
- Add `Tenant` model + nullable `tenantId` everywhere; backfill to Tenant 1; enforce NOT NULL.
- Add tenant context + Prisma extension for auto-scoping. Put `tenantId` in JWT/session.
- Verify: existing app still works exactly as before, now as "Tenant 1". No second tenant yet.

**Phase 2 - Connections out of env**
- `Connection` model + encryption. Migrate owner tokens to Tenant 1 connections.
- Webhook tenant-routing via Connection lookup.
- Verify: FB/WhatsApp/Daraz still work for Tenant 1, now driven by DB connections not env.

**Phase 3 - Onboarding + second tenant**
- Sign-up flow, plan selection, in-app Facebook Login / Daraz OAuth.
- Onboard ONE real second tenant as a pilot; verify total isolation (no data bleed).

**Phase 4 - Tech Provider + scale hardening**
- Apply for Meta Tech Provider on the SEPARATE platform app (not the own-page app).
- Optional Postgres RLS hardening.
- Per-tenant cron batching; plan-limit enforcement; move to paid tiers as needed.

---

## Open decisions needing owner input

1. **Tenant vs existing Subscription** - is Subscription already the account entity, or do we add a clean Tenant on top? (Needs schema review.)
2. **One user = one tenant** (simple) confirmed for v1? Or must one person manage multiple merchant accounts from day one?
3. **Tech Provider app** - confirm it goes on a SEPARATE Meta app/business (recommended), not the current own-page app.
4. **Pilot scope** - how many tenants for the first launch? (Drives the cron/scaling choice.)

---

## Cross-cutting risk reminders

- Tenant isolation is a SECURITY property: the auto-scoping extension + "tenantId from session only" rule are non-negotiable. One leak between merchants is a serious breach.
- This is a multi-week, multi-phase project - Tech Provider STATUS arriving does not make the code multi-tenant; the code above is the real work and runs in parallel.
- Each phase must leave the current single-business operation working - never a big-bang cutover.
