# OlkoCMS — Daraz Open Platform API Findings (consolidated)

Everything learned about the Daraz/Lazada Open Platform API across all chats: signature, forward order endpoints, the true delivered-date source, reverse/return endpoints, the page-100 cap and its fix, return classification, the `DarazOrderItem` central table, fetch routes, and verified data. The scan/claim workflow and the tracking-match feature plan are in DARAZ_SCANS_CLAIMS.

> Supersedes the older split notes. Where an early chat and a later chat disagree, the LATER finding wins and is marked.

## Accounts / basics
- App key **`505290`**; `DARAZ_APP_SECRET` set in Vercel and **MUST be `.trim()`ed** before signing (trailing whitespace caused ~15 IncompleteSignature failures). NP base `https://api.daraz.com.np/rest{apiPath}?{query}`.
- Seller ID `900155829345`. **9 connected stores** (store cuids in DARAZ_SCANS_CLAIMS). `DarazStore.storeName` holds the store's EMAIL, not a display name — don't filter by display name; loop all active stores.
- API Explorer at App Console → Manage app 505290 → API Explorer. Permission groups (Order Mgmt, Reverse Order Mgmt, etc.) all Active. Call limit 6,000,000/day. "Get Token" popup is often blocked → prefer debug routes over Explorer.
- OAuth: `/api/daraz/auth` (redirect, `force_auth=true`), `/api/daraz/callback` (token exchange). `/auth/token/refresh` params `app_key, refresh_token, sign_method, timestamp` → new `access_token, refresh_token, expires_in`. `/api/daraz/token/refresh` refreshes tokens expiring within 7 days.

## Signature (verified, all calls)
- HMAC-SHA256, key = `DARAZ_APP_SECRET.trim()`. Build string = `apiPath` + concat of (sortedKey + value) for every param (no separators). Output **hex UPPERCASE**.
- Query = params sorted by key, each `k=encodeURIComponent(v)`, joined `&`, then `&sign=<SIGN>` appended **last**.
- **Timestamp = epoch milliseconds** (`Date.now().toString()`). ISO `+00:00` works on some endpoints but FAILS on `/logistic/order/trace` (`IllegalTimestamp`) — use epoch ms everywhere.
- Routes reading `request.url` need `export const dynamic = "force-dynamic"`.

## ID types (don't mix)
`order_id` (= `trade_order_id`) ≠ `reverse_order_id` ≠ `order_item_id` (= `trade_order_line_id`) ≠ `reverse_order_line_id`. `order_item_id == trade_order_line_id` is the 1:1 link between a forward item and its reverse line. Passing a reverse id to `/order/items/get` fails with `code:"16"`.

## FORWARD endpoints

### `/orders/get` — order list (NO tracking)
- Params: `access_token, app_key, sign_method:"sha256", timestamp, limit, offset, sort_by, sort_direction, status?` and **`created_after` OR `update_after` is mandatory** (else `E018`).
  - `created_after` (ISO) filters by creation — MISSES status changes on old orders.
  - `update_after` (ISO) filters by last-update — CATCHES status changes (pending→delivered). Use `sort_by:"updated_at"`.
- Response `data.orders[]`, `data.count/countTotal`, top-level `code:"0"`. Order fields: `order_id, order_number, statuses[0], price, items_count, created_at` (`"2026-05-19 02:34:39 +0800"`), `updated_at, payment_method, shipping_fee, warehouse_code(="dropshipping")`, `address_billing.{first_name,last_name,phone,city,...}`. Customer = billing first+last (fallback `customer_first_name`, else N/A). **Order-level only — no tracking number here.**

### `/order/items/get` — items + tracking [the only place tracking lives]
- Params: `order_id` + standard auth. GET. Response `data[]` (array of items), `code:"0"`.
- Correct store: `code==="0"` AND `data.length>0`; **wrong store returns `code==="16"`** (early note said `E016 Invalid Order ID` — same idea: must use the owning store).
- Per-item fields: `tracking_code` (outbound courier tracking), `order_id`, `order_item_id`(=trade_order_line_id), `status`(lowercase), `name`, `paid_price`/`item_price`, `shipment_provider` (e.g. "Drop-off: NP-DEX, Delivery: NP-DEX"), `sku`, `shop_sku`, `variation`, `reason` (buyer return reason), `cancel_return_initiator` ("buyer-return"; "null-null" when none), `return_status`, `product_main_image`, `shop_id`, `package_id`, `buyer_id`, `warehouse_code`, `created_at`, `updated_at`, +~60 more.
- **Item `updated_at` is NOT the true delivered time** — it changes again post-delivery (settlement), so it set `deliveredAt` ~1 day late. Do not use it. (Proven on order 215639386580372.)
- **QC return reason is NOT exposed**: `reason_detail`/`return_status` are empty even on returned orders. Daraz doesn't surface QC reason via API → keep manual.
- Date parse: `new Date(s.replace(" ","T").replace(" ",""))` for `"+0800"` strings.

### `/logistic/order/trace` — TRUE delivered timestamp [CONFIRMED]
- GET, business param `order_id` + auth. **Timestamp must be epoch ms.** Available to app 505290, no extra permission.
- Response: `data.result.data[].package_detail_info_list[].logistic_detail_info_list[]` = delivery stages. Each: `{status_code, detail_type, title, description, event_time(epoch ms), package_location_name, proof_images, receive_time}`.
- **Delivered stage** = `detail_type==="delivered"` OR `status_code==="1400"` OR `title==="Delivered"`; its `event_time` is the true delivered timestamp (matches Seller Center Order History exactly; NPT = UTC+5:45).
- Stage sequence seen: `ready_to`(1200) → `shipped`(1210) → ship_info(100013/100102/100103/100014) → out-for-delivery(100018) → `delivered`(1400).
- **Wrong-store gotcha**: a store that doesn't own the order returns `code:"0"` with an EMPTY `logistic_detail_info_list` (NOT an error). Each order's trace is visible from exactly ONE of the 9 stores → count stages, skip empties, find the owning store.
- **No endpoint finds an order by tracking number.** Tracking→order must be matched locally after fetching orders/items.

## REVERSE / RETURN endpoints
> Early chats concluded "no working reverse list endpoint" and used `/orders/get?status=returned|shipped_back|shipped_back_success|failed_delivery`. **LATER (current) finding: the reverse endpoints below DO work** with the right method + params. Both approaches are recorded; prefer the reverse endpoints for return tracking + classification.

### `/reverse/getreverseordersforseller` — reverse list (summary, NO tracking) [POST]
- Biz params merged into the signed param set and sent as **QUERY params** (NOT JSON body — JSON body → IncompleteSignature). Params: `page_size`(req), `page_no`(req), `reverse_order_id?, trade_order_id?, ofc_status_list[]?, reverse_status_list[]?, return_to_type?`, and time filters (below).
- Response `result.items[]` summary only: `reverse_order_id, trade_order_id, request_type("CANCEL"|"RETURN"), is_rtm, shipping_type("PICK_UP"|"DROP_OFF")`. `result.total`.
- **PAGE-100 CAP**: returns NOTHING past page 100 (page 101 → total 0), even when total > 5000. Deep/offset pagination is capped.
- **FIX — time-window filter**: `TradeOrderLineCreatedTimeRangeStart` / `TradeOrderLineCreatedTimeRangeEnd` (epoch ms) DO filter (verified total 11008 → 355 for a 2-month window). Other guessed names (`ReverseOrderLineCreatedTimeRange...`) do NOT filter. Walk **15-day windows from 2019-01-01 → now** (181 windows/store) to stay under the cap. Flag `capRisk = total>5000` (never hit with 15-day windows). Other Explorer params exist: `ReverseOrderLineModifiedTimeRangeStart/End`, `QC_Decision`, `dispute_in_progress`.

### `/order/reverse/return/detail/list` — reverse detail [GET — KEY for return tracking]
- **Method MUST be GET** (POST → UnsupportedHTTPMethod). Param `reverse_order_id` + auth. (Early note saw `E0106 ROC internal error` — unreliable then; works now via GET.)
- Correct store: `data.reverseOrderLineDTOList` non-empty. Each line: `tracking_number` (RETURN tracking), `reverse_order_line_id`, `trade_order_line_id`(=forward order_item_id, the link), `ofc_status`, `reverse_status`, `whqc_decision`, `reason_text/reason_code`, `refund_amount/item_unit_price` (in **PAISA**, /100 = Rs), `seller_sku_id`, `productDTO{product_id,sku}`, timestamps (epoch SECONDS).

### Return classification (verified with 3 real orders) — is it inbound-scannable?
Decisive field = **`whqc_decision`** (ofc_status agrees):
- `request_type "CANCEL"` → NO tracking (never shipped, e.g. payment fail). NOT inbound. (We skip CANCEL; only process RETURN.)
- `RETURN` + `whqc_decision "return_to_merchant"` (ofc `RETURN_RTM_*`) → comes back to OUR store → **INBOUND scan happens**. (order 215524547256631, tracking DEXNP025419650)
- `RETURN` + `whqc_decision "return_to_customer"` (ofc `RETURN_RTC_*`) → QC sent back to customer → NOT inbound. (order 215593960436740, ofc RETURN_RTC_DELIVERY_FAILED)
- **FAILED DELIVERY** (customer never received) → NOT in the reverse API at all. Lives in FORWARD `/order/items/get` with status `shipped_back`/`failed_delivery`; `tracking_code` is the SAME outbound tracking → INBOUND scan happens. (order 215468222820925, status shipped_back, tracking DEXNP025635049)

### Status value vocab
- Forward `status`: delivered, shipped, pending, ready_to_ship, packed, canceled, returned, failed_delivery, shipped_back, shipped_back_success. (tracking null for canceled/pending = never shipped, correct.)
- Reverse `ofc_status`: RETURN_RTM_DELIVERED, RETURN_RTC_DELIVERY_FAILED. `reverse_status`: REFUND_SUCCESS, REQUEST_REJECT, CANCEL_SUCCESS, REQUEST_INITIATE. `whqc_decision`: return_to_merchant, return_to_customer (null while in process).
- Tracking formats: `DEXNP`/`UPANP` + 9 digits; `PND-NP-...`; sometimes plain numeric.

### Business facts
- One `order_id` can have MULTIPLE items, each with its own status/tracking. One `tracking_code` can cover MULTIPLE items (bundle = same outbound tracking) → **trackingNo is NOT unique**. A returned item gets a SEPARATE return tracking, EXCEPT failed-delivery which reuses the outbound tracking. Scrap returns never come back → never inbound-scanned.

## Schema — `DarazOrderItem` (central forward+reverse table)
Added after DarazOrder, before ActivityLog; `npx prisma db push`.
- `id(cuid)`, **`orderItemId @unique`** (= trade_order_line_id; the upsert key), `darazOrderId, itemName, sku, status, price, storeId,`
  `trackingNo, shipmentProvider, cancelReturnInitiator, deliveredAt,`
  `returnTrackingNo, reverseOrderId, reverseOrderLineId, ofcStatus, reverseStatus, whqcDecision, returnReason, refundAmount, requestType, shippingType, createdAt, updatedAt`.
- Indexes: `@@index([trackingNo])`, `@@index([returnTrackingNo])`, `@@index([darazOrderId])`. **trackingNo / returnTrackingNo NOT unique** (bundle).
- Related: `DarazOrder` has `trackingNo?, returnStatus?, paymentStatus?, storeId?, orderDate?, deliveredAt?`. `DarazStore` has `lastOrderFetch?, lastReturnFetch?`. `DarazScan.trackingNo?` holds scanned tracking.

## Routes built (Daraz data layer)
- `/api/daraz/orders/fetch` (GET) — all-store loop, `/orders/get` incremental (`createdAfter = lastOrderFetch ?? now-90d`, then `update_after`), upsert `DarazOrder`, update `lastOrderFetch`. 2nd call returns fetched:0 (rate saved).
- `/api/daraz/refresh-status` (POST) — `update_after` last 7 days, `sort_by:updated_at`, update changed statuses; internal pagination, offset cap 500.
- `/api/daraz/fill-delivered-dates` (POST `{offset}`, batch 12) — rewritten to use `/logistic/order/trace`; helpers `extractDeliveredTime`, `countStages` (skip wrong/empty stores); re-fills ALL delivered/shipped (overwrites old wrong values); auto-paginate to done.
- `/api/daraz/fill-tracking` (POST `{offset}`, batch 12) — forward: per DarazOrder, try saved storeId first then all stores, `/order/items/get`, upsert `DarazOrderItem` (tracking_code, status, name, sku, price, shipment_provider, cancel_return_initiator).
- `/api/daraz/fill-returns` (POST `{storeIndex, windowIndex, pageNo}`) — reverse: window-by-window (15-day windows from 2019); per window list reverse orders, filter `request_type==="RETURN"`, call detail (GET), upsert return fields onto `DarazOrderItem` by `orderItemId`(=trade_order_line_id); create a new row if the forward item is absent (return-only rows lack forward fields; itemName falls back to seller_sku_id). Advances page→window→store; `capRisk = total>5000`.
- `/api/daraz/reconcile` (POST `{offset}`, paginated, `nextOffset:null` at end). `/api/daraz/order-detail` (GET `?orderId=&store=`) live item details. Debug (temporary, delete later): `debug-items`, `debug-reverse`, `debug-order-trace`, plus older `debug-*`/`fix-*`/`cleanup-*`.

### Sync orchestration (Orders page)
- One **Sync Orders** button drives 4 steps with a 0–100% bar (frontend-driven because one backend call can't finish within Vercel's 10s): A(0–25) `orders/fetch` → B(25–50) `refresh-status` → C(50–75) `fill-delivered-dates`(auto-paginate) → D(75–100) `reconcile`(auto-paginate). Orders page reads DB, not live Daraz, on open.

## Verified data / counts
- Forward fill: DarazOrder 1407; DarazOrderItem 1566 items, withTracking 921 (645 null = canceled/pending).
- Reverse fill (2019→now, 15-day windows, ~54 min, 2465 calls): returnsFound 4257, upserted 4509.
- Final `DarazOrderItem`: totalItems 5793, withTracking 921, withReturnTracking 3923, withReverseId 4255, whqcMerchant 2667, whqcCustomer 253.
- Delivered-date trace re-fill: 581/703 delivered/shipped got accurate `deliveredAt`; rest correctly null (in transit). Seller Center lifetime: 8028 delivered items.
- Store order (orderBy id asc, used by window/store index): 0 yagyapremiums, 1 budgetdealsnepal, 2 blackdragonnepal, 3 dealmeonsnepal, 4 firstdrop79, 5 gadgetfinder2020, 6 gadgetsfindernepal, 7 selfcarenepa, 8 tb200247.

## Known-good test data
- Delivered: **order 215639386580372** → tracking DEXNP025640432, true Delivered 2026-05-29 16:21:22 NPT (epoch ms 1780050982948), store Yagya Premiums (idx 0, cuid cmprwajvg0000mqyvdz6wtw98). Our system once wrongly showed 5/30 (item updated_at bug).
- Return (merchant): order 215524547256631, reverse_order_id 505789557356631, return tracking DEXNP025419650 / DEXNP025444591, whqc return_to_merchant.
- Return (customer/QC): order 215593960436740, ofc RETURN_RTC_DELIVERY_FAILED, whqc return_to_customer.
- Failed delivery: order 215468222820925, forward status shipped_back, tracking DEXNP025635049.
- Other verified items: 215532508106182 (DEXNP025439200), 215572158888398 (DEXNP025511239), 215321287636677 (returned, DEXNP025345916), 215414061852555 (DEXNP025527352). Tracking-only "unknown" scan to test matching: DEXNP025700056.

## Decisions
- Orders page reads central DB (not live Daraz per open) — live-everywhere rejected (~11k orders, 10s timeout, rate-limit/penalty). Filled by Sync button + nightly cron. Auto-sync-on-change rejected (Daraz sends no push → constant polling). Reverse via the reverse endpoints (current) for tracking+classification; the `/orders/get?status=` approach is the older fallback. Fix delivered-date accuracy BEFORE surfacing it in the Sync button.

## Pending / Next
1. **resolve-scans** (`/api/daraz/resolve-scans`): match unmatched `DarazScan`/alerts locally by tracking using the INBOUND MATCH RULE (DARAZ_SCANS_CLAIMS); attach darazOrderId+store+status+customer+product on match. Manual-test on DEXNP025640432 (outbound) and DEXNP025444591 (return) first.
2. Nightly cron 8 PM NPT (= 14:15 UTC), `CRON_SECRET`, TARGETED (only items on Outbound/Inbound/Alerts pages): targeted fetch → resolve-scans → reconcile. Use `TradeOrderLineCreatedTimeRange` for incremental (recent windows only, not all 181).
3. Reconcile: run AFTER resolve; add `deleted:false` filter.
4. Token refresh job so store access_tokens don't silently expire. Cleanup debug routes + unused Orders-page handlers.

## UPDATE 2026-06-04: tracking capture into central DB + Sync 6-step + PND format

### KEY FINDING - tracking is only on shipped-stage items, Daraz REMOVES it after delivery
- Tracking (`tracking_code`) lives ONLY in `/order/items/get` -> `DarazOrderItem.trackingNo`. `/orders/get` never returns it (confirmed: all 1399 DarazOrder rows had trackingNo null).
- **Daraz drops `tracking_code` once the order is delivered.** A shipped order (e.g. 215687775239258) returns `tracking_code: DEXNP025726135`; a delivered order (215673152249477) returns the item with status `delivered` but NO tracking_code. So tracking MUST be captured while the order is still ready_to_ship/packed/shipped - if you only run fill-tracking after delivery, tracking is already gone.
- Root cause of the "Unknown / Order: unknown" outbound alert flood: outbound scans carry tracking, but the matching order's tracking was never captured into DarazOrderItem (Sync had no fill-tracking step), AND reconcile was matching against DarazOrder.trackingNo (always null) instead of DarazOrderItem.trackingNo.

### Fixes (commits 853890e, a7cf953, 4d6392f, c61a08d)
- **Sync is now 6-step** (orders page): 1 orders/fetch -> 2 fill-tracking (recentOnly) -> 3 refresh-status -> 4 fill-delivered-dates -> 5 resolve-scans -> 6 reconcile.
- **`fill-tracking` got a `recentOnly` flag**: when `{ recentOnly: true }`, it only walks DarazOrder with status in [ready_to_ship, packed, shipped, pending] (ordered by orderDate desc), so Sync/cron stay under Vercel 10s. Without the flag it walks ALL orders (manual backfill).
- **Nightly cron** added Step 1b: same targeted fill-tracking (top 120 ship-stage orders) between fetch and refresh-status. Reports `step1b_fillTracking`.
- **reconcile + cron outbound match** now hits `DarazOrderItem` by tracking FIRST (then DarazOrderId), NOT DarazOrder. DarazOrder is only a status fallback.
- **PND tracking format**: Daraz = `PND-NP-000718204` (dash); scanners read `PND/NP/...` (slash). Scan save now converts `/` -> `-`. DEX/UPA have no separators.

### Sync step bands (orders page progress bar)
1/6 fetch (0-20) -> 2/6 fill-tracking (20-25) -> 3/6 refresh-status (25-45) -> 4/6 fill-delivered (45-70) -> 5/6 resolve-scans (70-78) -> 6/6 reconcile (78-100).
