# OlkoCMS — Daraz Scans, Claims & Tracking-Match Findings

The warehouse-side workflow: outbound/inbound scanning, duplicate + wrong-store handling, claim management (financial + audit), and the central-DB tracking-match feature. API mechanics are in DARAZ_API.

## Core problem / vision
- Staff scan **only a tracking number**. The system must auto-pull everything else (order id, customer, product, store, status, return type) from Daraz and match locally.
- Daraz has **no "find order by tracking" endpoint** → orders/returns (which carry tracking) are fetched into a central DB and matched locally by tracking.
- **Primary identifier is `trackingNo`**, not `darazOrderId`. Tracking is the bridge: `DarazScan.trackingNo` ↔ `DarazOrderItem`/`DarazClaim` ↔ Daraz `tracking_code`.

## CENTRAL-DB ARCHITECTURE (the core design — single source of truth)
`DarazOrderItem` is the **one central database** that every Daraz page reads from and verifies against. No page makes its own independent Daraz calls for data it can get from the central DB. The model:

- **Write rule = incremental, never duplicate.** Any source (All-To-Ship, Orders sync, fetch routes, cron) that pulls from Daraz must:
  - look up the row in the central DB by its key (`orderItemId`, and tracking where relevant);
  - **if it already exists AND nothing changed → ignore** (do NOT re-write);
  - **only a NEW order/item OR a CHANGED status gets written/updated.**
  - This is why Daraz calls use `update_after` / time windows — fetch only new-or-changed, not everything.
- **All-To-Ship page**: pulls to-ship orders, matches central DB; same → skip, new/changed status only → store. It is allowed to be the FIRST to learn a status.
- **Orders page Sync**: same incremental rule. Because All-To-Ship (or cron) may have ALREADY written a status into the central DB, Orders sync must NOT re-fetch what's already current — only new orders / new statuses. So whichever source runs first wins; the others see "already current" and skip.
- **Outbound / Inbound / Returns / Alerts pages**: all verify against the SAME central DB. Inbound/outbound scans match a row in the central DB by tracking.
- **Alerts are derived FROM the central-DB match**, not created at scan time in isolation. An alert exists when scan-vs-central-DB don't agree (e.g. outbound scanned but no matching order; Daraz shows a return/failed-delivery but no inbound scan). Alert page shows data based on this match.
- **Net effect**: minimal Daraz API calls, no duplicate fetching, one consistent status everywhere, and scans/alerts judged against a single authoritative dataset.

> NOTE (current state vs target): the central table `DarazOrderItem` is BUILT and fully loaded (forward + reverse — see DARAZ_API), but the sources are NOT yet unified under this incremental write rule. Today there are still separate routes (`orders/fetch`, `fill-tracking`, `fill-returns`, a live All-To-Ship page) that aren't yet wired to "write only if new/changed" against `DarazOrderItem`, and `resolve-scans` + DB-derived alerts don't exist yet. Building this unification is the main remaining task (design first, then wire each source).

## Warehouse workflow (as described by user)
- **Outbound scan** (stock → Daraz warehouse): capture only `trackingNo`; `timestamp` + `scannedBy` auto-filled from the logged-in session.
- **Inbound scan** (return / failed delivery coming back): `trackingNo` (+ quantity); everything else auto-fetched/matched.
- **Claim process** after a return arrives:
  1. `customerComment` — buyer's return reason (from Daraz).
  2. `qcComment` — Daraz QC verdict (manual; API doesn't expose QC reason).
  3. `staffClaim` — our staff's claim ("item missing", "damaged in transit").
  4. `claimResult` — entered 2–4 days later when Daraz responds.
- **"Daraz Claim" = a financial claim**, not just a return record. If a returned item is damaged, we file a claim in Seller Center to recover money; Daraz pays after deducting commission/charges (sometimes 10–15%, sometimes partial per our demand). **CMS only stores the record — no claim-filing API.**
- Each return gets a `claimDecision`: `undecided`(default)/`need`/`not_needed`. Only `need` shows on the Claims page; financial fields hidden when `not_needed`.

## Scan rules
- **Double-scan**: a button double-press or re-scan must NOT create duplicates. Show a popup with prior scan timestamp + who scanned, two options (delete old & keep new / discard new), labeled in **English AND Nepali**. Applies to outbound and inbound. (Implemented via `POST {trackingNo, force}`: existing + `!force` → `{duplicate:true, existing}`; `force` → delete old + create new.)
- **Wrong-store**: another store's item mistakenly received. On inbound, if the tracking isn't found in our records, flag `wrongStore:true` (shows red alert + `wrongStoreCount` card; today's list highlights these). An exact tracking is required before inbound is accepted (no blind inbound).
- **UI rule (explicit)**: NO single "scan with type select" form — each scan type gets its own page so staff just scan/fill, no per-scan decisions. Pages: `/dashboard/daraz/outbound`, `/returns`, `/claims`, `/alerts`.

## INBOUND MATCH RULE (for the resolve-scans feature)
A scanned return tracking matches a `DarazOrderItem` where:
- `returnTrackingNo == scan` (customer returns; `whqcDecision = return_to_merchant` = expected inbound), OR
- `trackingNo == scan` AND `status IN ("shipped_back","failed_delivery","returned")` (failed delivery reuses outbound tracking).
- `return_to_customer` items are NOT expected as inbound. (Classification details in DARAZ_API.)

## Schema (scan/claim side)
- **DarazScan**: `id, darazOrderId?, productName?` (both made optional — scan only needs tracking; were required → PrismaClientValidationError), `scanType, quantity(1), scannedBy?, notes?, trackingNo?, itemName?, price?, customerName?, storeId?, wrongStore(false), createdAt`. `scanType` values: `outbound | inbound | return | failed | missing`.
- **DarazClaim**: `id, trackingNo`(NOT null, NOT unique → use `findFirst`+create/update, never upsert on it)`, darazOrderId?, itemName?, price?, customerName?, quantity(1), returnType?, customerComment?(buyer reason), qcComment?(Daraz QC, manual), staffClaim?, claimResult?, claimStatus(default "pending"), scannedBy?, resolvedAt?, storeId?, orderDate?, createdAt, updatedAt`. Financial add-ons: `itemCondition?, claimReason?, claimType?, claimedAmount?, receivedAmount?, claimDate?, claimNote?, claimDecision(default "undecided")`.
- **DarazClaimLog** (audit): `id, claimId, field, oldValue?, newValue?, changedBy?, createdAt, @@index([claimId])`. One row per changed field per edit (full timeline, not just "last edited by").
- **DarazAlert**: `id, darazOrderId, productName, alertType, status(default "unresolved"), notes?, resolvedAt?, createdAt`. `alertType`: `Customer Return`, `Failed Delivery`.

## Routes (scan/claim)
- `/api/daraz/outbound` — GET stats (todayCount/totalCount/recentScans); POST `{trackingNo, force}` duplicate logic.
- `/api/daraz/inbound` — GET stats (+`wrongStoreCount`); POST `{trackingNo, force}` duplicate + match tracking to claim → auto-fill store/item/customer or set `wrongStore`. Returns `{success, wrongStore, matchedStore, matchedItem}`.
- `/api/daraz/scan` — GET latest 100; POST requires `darazOrderId, productName, scanType` (else 400). Side effect: `return`/`failed` scanType auto-creates a `DarazAlert`.
- `/api/daraz/returns` — GET list claims; POST create; **PATCH** updates claim fields AND writes per-field diffs to `DarazClaimLog` (`changedBy` from session; uses a `FIELD_LABELS` map). `/api/daraz/returns/fetch` incremental (supports `?store=`, `?status=<one>`, `?skipItems=1`), `maxDuration=60`.
- `/api/daraz/claims` — GET `?decision=need`; PATCH status. `/api/daraz/claim-log` — GET `?claimId=`. `/api/daraz/alerts` — GET; PATCH `{id,status,notes?}` (status `resolved` sets `resolvedAt`, else clears).

## Pages / components
- `/dashboard/daraz/outbound`, `/returns` (inbound scan), `/claims` (decision=need only; summary cards; expandable + Edit), `/returns-list` (Order ID + Tracking columns, time filter today/yesterday/this-last week/month/year/custom, store-wise sort, uses `orderDate`), `/orders` (Sync button, time filter, To-Ship filter `["pending","ready_to_ship","packed"]`, clickable Order ID popup), `/alerts`.
- `src/components/OrderDetailPopup.tsx` (reused), `ClaimEditPopup.tsx` (claimDecision dropdown; financial section hidden when `not_needed`; shows `DarazClaimLog`; QC label "Daraz QC Reason (Seller Center बाट)"). `Sidebar.tsx` Daraz submenu: Overview, Orders, Returns List, Outbound, Returns Scan, Claims, Alerts (lucide icons; "Daraz Stores" moved into submenu).

## Decisions
- Claim filing stays manual (Seller Center); CMS records only. QC reason manual (API doesn't expose). Inbound modeled as `DarazScan scanType:"inbound"` (consistent with outbound). Wrong-store = tracking not present locally. `DarazScan.darazOrderId/productName` optional. Backfill via a sequential store×status helper page (dodges Vercel 10s). Audit = full per-field history. `findFirst`+create/update (not upsert) since trackingNo/darazOrderId aren't unique.

## Reconciliation / cron (planned)
- **resolve-scans** route: match unmatched scans/alerts to `DarazOrderItem` by the INBOUND MATCH RULE; on match attach real darazOrderId/store/status/customer/product, else keep as alert. Run reconcile AFTER resolve; add `deleted:false` to reconcile queries.
- Auto-alerts for: (a) outbound scanned but not in Daraz orders (lost?), (b) Daraz shows return/failed but no inbound scan (missing?). A reconciliation dashboard joins outbound+inbound+claims/orders by tracking → matched / missing / wrong-store, auto-generating `DarazAlert`.
- **Nightly cron 8 PM NPT (=14:15 UTC)**, `CRON_SECRET`, **TARGETED** — only items on Outbound/Inbound/Alerts pages, not all orders: targeted fetch/tracking-fill → resolve-scans → reconcile. Use `TradeOrderLineCreatedTimeRange` for incremental (recent windows). Constrained by Vercel Hobby (2 daily crons).

## Reports / tenancy (planned)
- Separate Daraz-only, Social-only, and an Admin-only Combined report (gate by `role==='admin'` OR `canViewReports && canViewPnL`). Subscription tenancy + per-staff RBAC: restrict each subscriber to own rows, then staff per `Staff.can*`.

## Store cuids (verified)
yagyapremiums `cmprwajvg0000mqyvdz6wtw98` · budgetdealsnepal `cmprxpxqy0000jmafgoe2cxxd` · blackdragonnepal `cmprxw8jg0001jmafa97cnedj` · dealmeonsnepal `cmpry2jil0002jmafz062s19p` · firstdrop79 `cmpry6t130003jmafp262sgzp` · gadgetfinder2020 `cmpryagir0004jmafkp9sqkp6` · gadgetsfindernepal `cmpryeoep0005jmafjrgbrb2p` · selfcarenepa `cmpryj9pm0006jmafim0lj9c5` · tb200247 `cmprymwy00007jmaf9z110uiy`.
(Note: a Yagya cuid `cmprymwy0...` also appeared for tb200247 in one chat vs `cmprwajvg...` for yagya in another — the latter is from the live delivered-order test, treat it as authoritative for yagyapremiums.)
