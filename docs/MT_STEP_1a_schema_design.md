# Multi-Tenant Step 1a - Schema Migration Design (REVIEW BEFORE APPLYING)

Goal of 1a: give every tenant-scoped model a `subscriptionId` (NULLABLE for now) + the right indexes, additively. No data touched yet, no NOT NULL yet, no routes changed. Pure schema groundwork. Follows ENGINEERING_STANDARD rules A (additive), D (performance/indexes).

Tenant key = `Subscription.id` (existing). NO new Tenant model.

---

## 1. Model classification (all 24)

### GLOBAL - do NOT add subscriptionId (shared across all tenants)
- `Plan` - shared plan catalogue.
- `DarazClaimLog` - audit child of DarazClaim; inherits tenant via its parent claim. (Add subscriptionId later ONLY if we ever query logs directly by tenant; for now it's always reached through a claimId. Leaving it global avoids a needless column. Flag: revisit in 1d if any route lists logs without a claim.)

### BILLING - already tenant-defining, leave as-is
- `Subscription` - this IS the tenant. No self-reference needed.
- `Payment` - already has `subscriptionId`. No change.
- `User`, `Staff` - already have `subscriptionId`. (1a adds INDEX only, see below.)

### TENANT-SCOPED - ADD `subscriptionId String?` + indexes (the 17 that need it)
Core ops: `Order`, `Message`, `Followup`, `Shipment`, `Content`, `Transaction`, `Product`, `ActivityLog`, `AIConversation`
Ads/P&L: `AdCampaign`, `AdExpense`, `AdOrder`
Daraz: `DarazStore`, `DarazOrder`, `DarazOrderItem`, `DarazScan`, `DarazAlert`, `DarazClaim`

> Note: AdExpense/AdOrder also reach tenant via their `campaignId -> AdCampaign`. We still give them a direct `subscriptionId` so the auto-scoping extension can filter them WITHOUT a join (rule D: no extra round-trips). Same logic for DarazOrderItem (reachable via darazOrderId, but gets its own column for fast direct scoping).

---

## 2. Exact field + index to add per model

Add `subscriptionId String?` to each model below, plus the listed index. Indexes are chosen from the HOT columns each page filters/sorts by (rule D - subscriptionId is now in every where, so the compound index must lead with it).

| Model | Add column | Add index(es) |
|---|---|---|
| Order | `subscriptionId String?` | `@@index([subscriptionId, status])`, `@@index([subscriptionId, createdAt])` |
| Message | `subscriptionId String?` | `@@index([subscriptionId, status])`, `@@index([subscriptionId, senderId, pageId])` |
| Followup | `subscriptionId String?` | `@@index([subscriptionId, status])` |
| Shipment | `subscriptionId String?` | `@@index([subscriptionId, status])` |
| Content | `subscriptionId String?` | `@@index([subscriptionId, status])` |
| Transaction | `subscriptionId String?` | `@@index([subscriptionId, date])` |
| Product | `subscriptionId String?` | `@@index([subscriptionId, status])` |
| ActivityLog | `subscriptionId String?` | `@@index([subscriptionId, createdAt])` |
| AIConversation | `subscriptionId String?` | `@@index([subscriptionId, senderId, pageId])`, `@@index([subscriptionId, resolved])` |
| AdCampaign | `subscriptionId String?` | `@@index([subscriptionId, status])` |
| AdExpense | `subscriptionId String?` | `@@index([subscriptionId, date])` |
| AdOrder | `subscriptionId String?` | `@@index([subscriptionId, status])` |
| DarazStore | `subscriptionId String?` | `@@index([subscriptionId])` |
| DarazOrder | `subscriptionId String?` | `@@index([subscriptionId, status])`, `@@index([subscriptionId, orderDate])` |
| DarazOrderItem | `subscriptionId String?` | `@@index([subscriptionId, trackingNo])`, `@@index([subscriptionId, status])` (keep existing trackingNo/returnTrackingNo/darazOrderId indexes) |
| DarazScan | `subscriptionId String?` | `@@index([subscriptionId, trackingNo])`, `@@index([subscriptionId, scanType, deleted])` |
| DarazAlert | `subscriptionId String?` | `@@index([subscriptionId, status])` |
| DarazClaim | `subscriptionId String?` | `@@index([subscriptionId, claimStatus])`, `@@index([subscriptionId, trackingNo])` |
| User | (already has) | ADD `@@index([subscriptionId])` |
| Staff | (already has) | ADD `@@index([subscriptionId])` |

Why nullable now: existing rows have no subscriptionId; a NOT NULL column can't be added to populated tables. We add nullable (1a), backfill (1b), then flip to required (1b end). Rule A2.

---

## 3. How to apply (BOM-free, additive) - DO NOT RUN YET, review first

- Edit `prisma/schema.prisma` adding the lines above. Existing columns/indexes are untouched (additive only).
- Keep Prisma 5.22. Then:
  ```powershell
  npx prisma db push        # adds columns + indexes, no data change (all nullable)
  npx prisma generate
  npm run build
  ```
- `db push` here is safe: only ADD column / ADD index. No drop, no type change, no NOT NULL.
- Commit: `feat(mt): 1a add nullable subscriptionId + indexes to tenant-scoped models` then push.

Verify after push (rule E1):
```powershell
# confirm columns exist via a quick check or Neon, and build is green
npm run build 2>&1 | Select-String "Compiled successfully|error|Failed"
```

---

## 4. 1b - Backfill (Neon SQL Editor, NOT Vercel - rule B1)

After 1a is pushed and verified. First find the owner subscription id:
```sql
-- 1. find (or create) the owner subscription = "Gadget Finder"
SELECT id, "businessName" FROM "Subscription";
```
Take that id (call it OWNER_SUB_ID). If no Subscription row exists yet, create one for the current business first.

Then backfill every scoped table (run as ONE script; click Run, not Explain - rule from PROJECT_SETUP):
```sql
UPDATE "Order"          SET "subscriptionId" = 'OWNER_SUB_ID' WHERE "subscriptionId" IS NULL;
UPDATE "Message"        SET "subscriptionId" = 'OWNER_SUB_ID' WHERE "subscriptionId" IS NULL;
UPDATE "Followup"       SET "subscriptionId" = 'OWNER_SUB_ID' WHERE "subscriptionId" IS NULL;
UPDATE "Shipment"       SET "subscriptionId" = 'OWNER_SUB_ID' WHERE "subscriptionId" IS NULL;
UPDATE "Content"        SET "subscriptionId" = 'OWNER_SUB_ID' WHERE "subscriptionId" IS NULL;
UPDATE "Transaction"    SET "subscriptionId" = 'OWNER_SUB_ID' WHERE "subscriptionId" IS NULL;
UPDATE "Product"        SET "subscriptionId" = 'OWNER_SUB_ID' WHERE "subscriptionId" IS NULL;
UPDATE "ActivityLog"    SET "subscriptionId" = 'OWNER_SUB_ID' WHERE "subscriptionId" IS NULL;
UPDATE "AIConversation" SET "subscriptionId" = 'OWNER_SUB_ID' WHERE "subscriptionId" IS NULL;
UPDATE "AdCampaign"     SET "subscriptionId" = 'OWNER_SUB_ID' WHERE "subscriptionId" IS NULL;
UPDATE "AdExpense"      SET "subscriptionId" = 'OWNER_SUB_ID' WHERE "subscriptionId" IS NULL;
UPDATE "AdOrder"        SET "subscriptionId" = 'OWNER_SUB_ID' WHERE "subscriptionId" IS NULL;
UPDATE "DarazStore"     SET "subscriptionId" = 'OWNER_SUB_ID' WHERE "subscriptionId" IS NULL;
UPDATE "DarazOrder"     SET "subscriptionId" = 'OWNER_SUB_ID' WHERE "subscriptionId" IS NULL;
UPDATE "DarazOrderItem" SET "subscriptionId" = 'OWNER_SUB_ID' WHERE "subscriptionId" IS NULL;
UPDATE "DarazScan"      SET "subscriptionId" = 'OWNER_SUB_ID' WHERE "subscriptionId" IS NULL;
UPDATE "DarazAlert"     SET "subscriptionId" = 'OWNER_SUB_ID' WHERE "subscriptionId" IS NULL;
UPDATE "DarazClaim"     SET "subscriptionId" = 'OWNER_SUB_ID' WHERE "subscriptionId" IS NULL;
UPDATE "User"           SET "subscriptionId" = 'OWNER_SUB_ID' WHERE "subscriptionId" IS NULL;
UPDATE "Staff"          SET "subscriptionId" = 'OWNER_SUB_ID' WHERE "subscriptionId" IS NULL;
```
Verify ZERO nulls remain (rule B2) - must all return 0:
```sql
SELECT
 (SELECT count(*) FROM "Order"          WHERE "subscriptionId" IS NULL) AS order_null,
 (SELECT count(*) FROM "Message"        WHERE "subscriptionId" IS NULL) AS message_null,
 (SELECT count(*) FROM "DarazOrderItem" WHERE "subscriptionId" IS NULL) AS doi_null,
 (SELECT count(*) FROM "DarazScan"      WHERE "subscriptionId" IS NULL) AS scan_null;
-- ... (add the rest as needed)
```
Record the counts in the commit message.

Then enforce NOT NULL (only after 0 nulls confirmed) - change `String?` -> `String` in schema and `db push` again. (Optionally keep nullable a bit longer until auto-scoping in 1c is in place, then flip - safer. Decide at 1b time.)

Rollback for 1b: backfill is reversible (`SET subscriptionId = NULL`); never destructive. NOT NULL flip is the only one-way step - do it last, after everything verified.

---

## 5. What 1a does NOT do (next steps)
- 1c: Prisma Client Extension + AsyncLocalStorage request context (auto-inject subscriptionId). Routes still pass; extension makes scoping automatic.
- 1d: migrate routes/webhooks to set the tenant context from session; webhook tenant routing via Connection (Phase 2).
- These come after 1a+1b are live and verified.

---

## Open question for owner before 1a apply
- Confirm there is exactly ONE current Subscription row to use as OWNER_SUB_ID (or we create one for Gadget Finder first). We must verify with `SELECT id, "businessName" FROM "Subscription";` before backfill.
