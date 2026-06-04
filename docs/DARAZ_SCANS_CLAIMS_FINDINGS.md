# OlkoCMS ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Daraz Scans, Claims & Tracking-Match Findings

The warehouse-side workflow: outbound/inbound scanning, duplicate + wrong-store handling, claim management (financial + audit), and the central-DB tracking-match feature. API mechanics are in DARAZ_API.

## Core problem / vision
- Staff scan **only a tracking number**. The system must auto-pull everything else (order id, customer, product, store, status, return type) from Daraz and match locally.
- Daraz has **no "find order by tracking" endpoint** ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ orders/returns (which carry tracking) are fetched into a central DB and matched locally by tracking.
- **Primary identifier is `trackingNo`**, not `darazOrderId`. Tracking is the bridge: `DarazScan.trackingNo` ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬Â `DarazOrderItem`/`DarazClaim` ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬Â Daraz `tracking_code`.

## CENTRAL-DB ARCHITECTURE (the core design ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â single source of truth)
`DarazOrderItem` is the **one central database** that every Daraz page reads from and verifies against. No page makes its own independent Daraz calls for data it can get from the central DB. The model:

- **Write rule = incremental, never duplicate.** Any source (All-To-Ship, Orders sync, fetch routes, cron) that pulls from Daraz must:
  - look up the row in the central DB by its key (`orderItemId`, and tracking where relevant);
  - **if it already exists AND nothing changed ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ ignore** (do NOT re-write);
  - **only a NEW order/item OR a CHANGED status gets written/updated.**
  - This is why Daraz calls use `update_after` / time windows ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â fetch only new-or-changed, not everything.
- **All-To-Ship page**: pulls to-ship orders, matches central DB; same ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ skip, new/changed status only ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ store. It is allowed to be the FIRST to learn a status.
- **Orders page Sync**: same incremental rule. Because All-To-Ship (or cron) may have ALREADY written a status into the central DB, Orders sync must NOT re-fetch what's already current ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â only new orders / new statuses. So whichever source runs first wins; the others see "already current" and skip.
- **Outbound / Inbound / Returns / Alerts pages**: all verify against the SAME central DB. Inbound/outbound scans match a row in the central DB by tracking.
- **Alerts are derived FROM the central-DB match**, not created at scan time in isolation. An alert exists when scan-vs-central-DB don't agree (e.g. outbound scanned but no matching order; Daraz shows a return/failed-delivery but no inbound scan). Alert page shows data based on this match.
- **Net effect**: minimal Daraz API calls, no duplicate fetching, one consistent status everywhere, and scans/alerts judged against a single authoritative dataset.

> NOTE (DONE 2026-06-03, commits 493c861 -> 1ca844a): sources now UNIFIED under the incremental write rule. All-To-Ship (to-ship/route.ts) pulls live to-ship orders, writes only new/changed into central DB, renders from DB (fallback if live fails). Orders Sync step A (orders/fetch) is incremental skip-unchanged. resolve-scans exists (INBOUND MATCH RULE vs DarazOrderItem). reconcile is central-DB-first, derives 3 alert types (outbound_not_delivered, return_not_received, wrong_store) with deleted:false. Nightly cron (cron/nightly, 8PM NPT = 14:15 UTC) orchestrates fetch -> refresh-status -> resolve-scans -> reconcile. Orders Sync and Alerts reconcile button both run resolve-scans before reconcile. See docs/PENDING_CRON_CHECK.md for verification.

## Warehouse workflow (as described by user)
- **Outbound scan** (stock ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ Daraz warehouse): capture only `trackingNo`; `timestamp` + `scannedBy` auto-filled from the logged-in session.
- **Inbound scan** (return / failed delivery coming back): `trackingNo` (+ quantity); everything else auto-fetched/matched.
- **Claim process** after a return arrives:
  1. `customerComment` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â buyer's return reason (from Daraz).
  2. `qcComment` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Daraz QC verdict (manual; API doesn't expose QC reason).
  3. `staffClaim` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â our staff's claim ("item missing", "damaged in transit").
  4. `claimResult` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â entered 2ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“4 days later when Daraz responds.
- **"Daraz Claim" = a financial claim**, not just a return record. If a returned item is damaged, we file a claim in Seller Center to recover money; Daraz pays after deducting commission/charges (sometimes 10ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“15%, sometimes partial per our demand). **CMS only stores the record ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no claim-filing API.**
- Each return gets a `claimDecision`: `undecided`(default)/`need`/`not_needed`. Only `need` shows on the Claims page; financial fields hidden when `not_needed`.

## Scan rules
- **Double-scan**: a button double-press or re-scan must NOT create duplicates. Show a popup with prior scan timestamp + who scanned, two options (delete old & keep new / discard new), labeled in **English AND Nepali**. Applies to outbound and inbound. (Implemented via `POST {trackingNo, force}`: existing + `!force` ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ `{duplicate:true, existing}`; `force` ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ delete old + create new.)
- **Wrong-store**: another store's item mistakenly received. On inbound, if the tracking isn't found in our records, flag `wrongStore:true` (shows red alert + `wrongStoreCount` card; today's list highlights these). An exact tracking is required before inbound is accepted (no blind inbound).
- **UI rule (explicit)**: NO single "scan with type select" form ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â each scan type gets its own page so staff just scan/fill, no per-scan decisions. Pages: `/dashboard/daraz/outbound`, `/returns`, `/claims`, `/alerts`.

## INBOUND MATCH RULE (for the resolve-scans feature)
A scanned return tracking matches a `DarazOrderItem` where:
- `returnTrackingNo == scan` (customer returns; `whqcDecision = return_to_merchant` = expected inbound), OR
- `trackingNo == scan` AND `status IN ("shipped_back","failed_delivery","returned")` (failed delivery reuses outbound tracking).
- `return_to_customer` items are NOT expected as inbound. (Classification details in DARAZ_API.)

## Schema (scan/claim side)
- **DarazScan**: `id, darazOrderId?, productName?` (both made optional ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â scan only needs tracking; were required ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ PrismaClientValidationError), `scanType, quantity(1), scannedBy?, notes?, trackingNo?, itemName?, price?, customerName?, storeId?, wrongStore(false), createdAt`. `scanType` values: `outbound | inbound | return | failed | missing`.
- **DarazClaim**: `id, trackingNo`(NOT null, NOT unique ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ use `findFirst`+create/update, never upsert on it)`, darazOrderId?, itemName?, price?, customerName?, quantity(1), returnType?, customerComment?(buyer reason), qcComment?(Daraz QC, manual), staffClaim?, claimResult?, claimStatus(default "pending"), scannedBy?, resolvedAt?, storeId?, orderDate?, createdAt, updatedAt`. Financial add-ons: `itemCondition?, claimReason?, claimType?, claimedAmount?, receivedAmount?, claimDate?, claimNote?, claimDecision(default "undecided")`.
- **DarazClaimLog** (audit): `id, claimId, field, oldValue?, newValue?, changedBy?, createdAt, @@index([claimId])`. One row per changed field per edit (full timeline, not just "last edited by").
- **DarazAlert**: `id, darazOrderId, productName, alertType, status(default "unresolved"), notes?, resolvedAt?, createdAt`. `alertType`: `Customer Return`, `Failed Delivery`.

## Routes (scan/claim)
- `/api/daraz/outbound` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â GET stats (todayCount/totalCount/recentScans); POST `{trackingNo, force}` duplicate logic.
- `/api/daraz/inbound` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â GET stats (+`wrongStoreCount`); POST `{trackingNo, force}` duplicate + match tracking to claim ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ auto-fill store/item/customer or set `wrongStore`. Returns `{success, wrongStore, matchedStore, matchedItem}`.
- `/api/daraz/scan` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â GET latest 100; POST requires `darazOrderId, productName, scanType` (else 400). Side effect: `return`/`failed` scanType auto-creates a `DarazAlert`.
- `/api/daraz/returns` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â GET list claims; POST create; **PATCH** updates claim fields AND writes per-field diffs to `DarazClaimLog` (`changedBy` from session; uses a `FIELD_LABELS` map). `/api/daraz/returns/fetch` incremental (supports `?store=`, `?status=<one>`, `?skipItems=1`), `maxDuration=60`.
- `/api/daraz/claims` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â GET `?decision=need`; PATCH status. `/api/daraz/claim-log` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â GET `?claimId=`. `/api/daraz/alerts` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â GET; PATCH `{id,status,notes?}` (status `resolved` sets `resolvedAt`, else clears).

## Pages / components
- `/dashboard/daraz/outbound`, `/returns` (inbound scan), `/claims` (decision=need only; summary cards; expandable + Edit), `/returns-list` (Order ID + Tracking columns, time filter today/yesterday/this-last week/month/year/custom, store-wise sort, uses `orderDate`), `/orders` (Sync button, time filter, To-Ship filter `["pending","ready_to_ship","packed"]`, clickable Order ID popup), `/alerts`.
- `src/components/OrderDetailPopup.tsx` (reused), `ClaimEditPopup.tsx` (claimDecision dropdown; financial section hidden when `not_needed`; shows `DarazClaimLog`; QC label "Daraz QC Reason (Seller Center ÃƒÂ Ã‚Â¤Ã‚Â¬ÃƒÂ Ã‚Â¤Ã‚Â¾ÃƒÂ Ã‚Â¤Ã…Â¸)"). `Sidebar.tsx` Daraz submenu: Overview, Orders, Returns List, Outbound, Returns Scan, Claims, Alerts (lucide icons; "Daraz Stores" moved into submenu).

## Decisions
- Claim filing stays manual (Seller Center); CMS records only. QC reason manual (API doesn't expose). Inbound modeled as `DarazScan scanType:"inbound"` (consistent with outbound). Wrong-store = tracking not present locally. `DarazScan.darazOrderId/productName` optional. Backfill via a sequential storeÃƒÆ’Ã¢â‚¬â€status helper page (dodges Vercel 10s). Audit = full per-field history. `findFirst`+create/update (not upsert) since trackingNo/darazOrderId aren't unique.

## Reconciliation / cron (planned)
- **resolve-scans** route: match unmatched scans/alerts to `DarazOrderItem` by the INBOUND MATCH RULE; on match attach real darazOrderId/store/status/customer/product, else keep as alert. Run reconcile AFTER resolve; add `deleted:false` to reconcile queries.
- Auto-alerts for: (a) outbound scanned but not in Daraz orders (lost?), (b) Daraz shows return/failed but no inbound scan (missing?). A reconciliation dashboard joins outbound+inbound+claims/orders by tracking ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ matched / missing / wrong-store, auto-generating `DarazAlert`.
- **Nightly cron 8 PM NPT (=14:15 UTC)**, `CRON_SECRET`, **TARGETED** ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â only items on Outbound/Inbound/Alerts pages, not all orders: targeted fetch/tracking-fill ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ resolve-scans ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ reconcile. Use `TradeOrderLineCreatedTimeRange` for incremental (recent windows). Constrained by Vercel Hobby (2 daily crons).

## Reports / tenancy (planned)
- Separate Daraz-only, Social-only, and an Admin-only Combined report (gate by `role==='admin'` OR `canViewReports && canViewPnL`). Subscription tenancy + per-staff RBAC: restrict each subscriber to own rows, then staff per `Staff.can*`.

## Store cuids (verified)
yagyapremiums `cmprwajvg0000mqyvdz6wtw98` Ãƒâ€šÃ‚Â· budgetdealsnepal `cmprxpxqy0000jmafgoe2cxxd` Ãƒâ€šÃ‚Â· blackdragonnepal `cmprxw8jg0001jmafa97cnedj` Ãƒâ€šÃ‚Â· dealmeonsnepal `cmpry2jil0002jmafz062s19p` Ãƒâ€šÃ‚Â· firstdrop79 `cmpry6t130003jmafp262sgzp` Ãƒâ€šÃ‚Â· gadgetfinder2020 `cmpryagir0004jmafkp9sqkp6` Ãƒâ€šÃ‚Â· gadgetsfindernepal `cmpryeoep0005jmafjrgbrb2p` Ãƒâ€šÃ‚Â· selfcarenepa `cmpryj9pm0006jmafim0lj9c5` Ãƒâ€šÃ‚Â· tb200247 `cmprymwy00007jmaf9z110uiy`.
(Note: a Yagya cuid `cmprymwy0...` also appeared for tb200247 in one chat vs `cmprwajvg...` for yagya in another ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â the latter is from the live delivered-order test, treat it as authoritative for yagyapremiums.)
## UPDATE 2026-06-04 (commits 853890e -> c61a08d): alerts resolve + tracking-capture + PND normalize

### Alerts page (resolve management)
- **Per-alert checkbox** + **bulk "Select all" / "Resolve N selected"** added to `/dashboard/daraz/alerts`. Clears the large old backlog in one action.
- **Outbound alert card shows the scan date** ("Scanned M/D/YYYY"), parsed from the alert notes ("... on <date>") or scan-derived orderDate.
- **Sticky resolve (dedupe fix):** `alertExists()` in reconcile + cron now matches `notes contains alertKey` with NO status filter (previously `status: { not: "resolved" }`), so a resolved/lost alert counts as existing and is NOT re-created on the next run. The offset-0 stale-clear only touches `status in ["unresolved","investigating"]` -> NEVER deletes resolved/lost. Result: once resolved, an alert stays resolved across reconcile/cron.
- `/api/daraz/alerts` PATCH now accepts BOTH single `{ id, status }` and bulk `{ ids: string[], status }` (uses updateMany for bulk).

### Outbound alert logic (the real meaning) - decided 2026-06-04
Outbound alert = "scanned out from our store (outbound scan) but Daraz does NOT yet show transit_to_ship/shipped". Daraz Order History stage order: Delivery Order Create -> Handled By Seller -> Packed -> Ready To Ship -> Ready To Ship Pending -> Transit To Ship -> Shipped -> Delivered.
- Match the outbound scan against central **DarazOrderItem** FIRST by tracking (tracking lives there, NOT in DarazOrder), then fall back to DarazOrder by orderId for status.
- `DELIVERED_OR_DONE` (NO alert): delivered, shipped, transit_to_ship, shipped_back, shipped_back_success, failed_delivery, returned, canceled, cancelled.
- ALERT when: match found but status is ready_to_ship/packed/pending (scanned but not handed to courier yet) OR no match at all (status unknown - "went out but Daraz does not show it"). User confirmed: match-fail SHOULD alert; old backlog is cleared by bulk-resolve (which now sticks).
- `failed_delivery` is NOT an outbound alert (parcel reached courier, customer refused -> return-side `return_not_received` handles it). `failed_delivery` + `shipped_back_success` were added to DELIVERED_OR_DONE so they no longer appear as outbound alerts.

### PND tracking slash vs dash (normalize)
- Daraz stores PND tracking as `PND-NP-000718204` (DASH). Scanners read it as `PND/NP/000722689` (SLASH). DEX/UPA have no separators.
- Fix: on scan save (outbound + inbound POST), `trackingNo = body.trackingNo.replace(/\//g,"-").trim()` -> all slashes become dashes so scan matches Daraz. One-time backfill route (now deleted) rewrote 5 existing slash rows (4 real PND + 1 junk row that had a whole comma-line in trackingNo).
- Outbound/inbound route Nepali comments were converted to English (they had become mojibake) to prevent future corruption.

## UPDATE 2026-06-04 (commit d9e4f3f): reconcile blank-status guard
- Diagnosed outbound no-match via a temporary read-only route (now removed): of 11459 outbound scans, ~9874 were old (213...) orders never fetched into central DB (Daraz drops tracking after delivery -> unfetchable), 599 matched an item but had BLANK status, only 8 were real alerts. Decision: ignore old 213... data (Daraz no longer has it); fix only forward-looking logic.
- FIX: reconcile outbound loop now skips when `hasMatch && !status` (matched a DarazOrderItem but status not yet populated = fresh/incomplete fetch). Prevents false 'Outbound -> Not Delivered' alerts when a new item's status is briefly empty. Real alerts (ready_to_ship/packed/pending, or true no-match) unchanged. Applies to new reconcile/cron runs only; old/resolved alerts untouched (sticky resolve still holds).
- NOTE (multi-tenant): system is sold per-subscription, but schema currently has NO tenancy link on Daraz models (DarazScan/DarazStore/DarazOrder/DarazOrderItem have no subscriptionId; storeId is a plain string filled at match-time, not at scan-time). All Daraz data shares one pool today. A real per-subscriber match-time guard needs schema tenancy fields first - deferred as a separate project, not patched piecemeal.

## UPDATE 2026-06-04 (commits 487b73d, c4c6e48): QR-vs-barcode scan guard
- Daraz shipping label: tracking is in the BARCODE, address is in the QR. Scanning the QR by mistake injects address text as a tracking -> junk scan.
- trackingValidator.ts already accepts only 2 real patterns ([A-Z]{5}\d{9} like DEXNP/UPANP, and [A-Z]{3}-[A-Z]{2}-\d{9} like PND-NP-) and rejects comma/slash/space. Added `looksLikeQrOrAddress()`: flags whitespace, address punctuation (,/\;:|), non-ASCII (Devanagari), length > 25, or no-alphanumeric.
- Force Add loophole fixed: outbound + returns pages' forceAdd() previously skipped validation entirely. Now forceAdd HARD-blocks anything looksLikeQrOrAddress() flags, so a mis-scanned QR can NEVER enter even via Force Add. A genuinely new courier (clean alphanumeric, unknown prefix) STILL passes via Force Add - no code edit needed per subscriber (chose this over hardcoding patterns or a DB-pattern table).

---

## UPDATE 2026-06-05 (Daraz Orders / Scans / Alerts UI polish + Nepal-time fix)

### Nepal-time (NPT, UTC+5:45) date filters - NEW shared helper
- ROOT BUG: Vercel runs in UTC. `new Date(); setHours(0,0,0,0)` gave UTC midnight, so at night (NPT 12am-5:45am) "Today" counts showed the PREVIOUS UTC day's scans. Confirmed on Outbound page: June 4 evening scans showed under "Today" at June 5 00:xx NPT.
- FIX: new `src/lib/nepalTime.ts` exports `nepalTodayStartUTC()` (NPT midnight as a real UTC instant) and `nepalPeriodRange(period)` (today/yesterday/this_week/last_week/this_month/last_month/2_months_ago/3_months_ago/this_year/last_year -> {from,to} as UTC instants computed on NPT wall-clock). Strategy: shift now by +5:45, compute boundary on shifted date, shift result back -5:45.
- Applied to: outbound/route.ts, inbound/route.ts, scan-manage/route.ts (today filter), dashboard/route.ts (today stats), orders/page.tsx + returns-list/page.tsx (startOf -> nepalPeriodRange), alerts/page.tsx (getDateRange -> nepalPeriodRange).
- NOT touched (rolling windows, NPT-irrelevant): cron/nightly + reconcile twoMonthsAgo purge, scan-manage 30-day deleted purge, payments/subscriptions billing periods, reports relative dates.
- GOTCHA: the outbound `setHours` line did NOT get replaced on first pass (heredoc/CRLF mismatch) - import landed but code stayed UTC, so the bug persisted after deploy. Always Select-String-verify the USE line, not just the import. Fixed with `-replace` regex `(?m)^\s*const todayStart = new Date\(\);\r?\n\s*todayStart\.setHours\(0, 0, 0, 0\);`.

### Daraz Orders page - stat card adapts to status filter
- orders/page.tsx: the "Delivered Revenue" card now reads the selected status filter. All Status -> Delivered Revenue (delivered total, unchanged default). Specific status -> "<Status> Value" = sum of that status's filtered orders (e.g. Pending Value, Canceled Value, To Ship Value). `cardValue` + `cardLabel` computed from `statusFilter`; works because `filtered` already has statusFilter applied.

### Scans page - tracking search + clickable tracking + detail popup
- scan-manage/route.ts GET: new `search` param -> `where.trackingNo = { contains: search.trim(), mode: "insensitive" }` (server-side, whole DB, not just loaded 500).
- scans/page.tsx: search bar (type or scanner). Uses validateTracking + looksLikeQrOrAddress (@/lib/trackingValidator): QR/address -> "QR/address scan, scan barcode only"; invalid format -> "Tracking number invalid"; valid -> sets searchTerm -> refetch. `searchTerm` added to fetch URL (`&search=`) + useEffect deps.
- Tracking number is now a clickable blue button -> opens OrderDetailPopup. Works for BOTH inbound (has darazOrderId) and outbound (darazOrderId often null - 332/500). For null-orderId scans the popup is opened by TRACKING.
- order-detail/route.ts: now accepts `tracking` param. If no orderId, looks up DarazOrderItem by trackingNo (indexed) -> darazOrderId + storeId, then normal /order/items/get. Also now calls /orders/get for `created_at` (orderDate) and uses real `quantity` (was hardcoded 1).
- OrderDetailPopup.tsx: accepts optional `tracking` prop; fetches by orderId else tracking. Now shows Qty + "Ordered: <date>".
- TEXT-CORRUPTION INCIDENT: editing scans/page.tsx via clipboard round-trip corrupted Nepali/em-dash into mojibake (Inbound a EUR" Today's Scans, etc). Replaced ALL Nepali UI strings with ASCII English (delete confirm, "Scan records - delete, undo, and manage", "No scans found", header em-dash -> hyphen). Reconfirms PROJECT_SETUP rule: keep injected strings ASCII-only.

### Alerts popup - product image/name, no raw notes, zoom
- alerts/page.tsx DetailPopup: removed the raw `alert.notes` paragraph (ugly "outbound scanned but no delivery progress..." text). Added product image + name fetched from order-detail API on open (by orderDetails.darazOrderId/storeId).

### Reusable ZoomableImage component - NEW
- `src/components/ZoomableImage.tsx`: `<ZoomableImage src className />`. Click image -> full-screen black overlay (z-[70]), click overlay -> close. Used in OrderDetailPopup (scans/orders) and alerts DetailPopup. Use this for ANY future product-image display to get click-to-expand for free.

### Commits (this session)
dd39038 (status card) -> 2800b49/e8c64c4 (outbound NPT, 2nd was the real setHours fix) -> b6dfcf1 (all date filters NPT) -> 51167c8 (scans search) -> 6ecf842 (clickable tracking + popup qty/date) -> e8c64c4-era order-detail tracking lookup -> 0fed0d1 (notes removed) -> ac32a60 (alert product img/name) -> 4e1f469 (ZoomableImage everywhere).
