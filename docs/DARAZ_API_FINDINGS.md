# OlkoCMS - Daraz Tracking-Match Feature: Research Findings

> Created during the session that researched the Daraz Reverse Order API to build the
> central-DB tracking-match feature. This file is the single source of truth for the
> forward + reverse order/return data model. Read this before building schema or match logic.

## GOAL (recap)
Staff scan ONLY a tracking number (outbound or return). The system must auto-pull all
other data (order id, customer, product, store, status, return type) from Daraz and match
locally. Daraz has NO "find order by tracking" endpoint, so we fetch orders/returns (which
contain tracking) and match locally by tracking number.

## KEY BUSINESS RULES (confirmed by user)
- One Daraz order_id can contain MULTIPLE items; each item can have a DIFFERENT status
  (pending / shipping / shipped / delivered / return-process / returned / cancelled-at-door /
  seller-cancel / system-cancel) and potentially a DIFFERENT tracking.
- One tracking_code can cover MULTIPLE items (bundle): if the seller packs several items of
  the same order into one package, they share ONE outbound tracking. So tracking is NOT unique.
- A returned item gets a SEPARATE return (reverse) tracking number, different from the outbound
  one. Outbound tracking != return tracking. order_id stays the same across both.
- Outbound scan = forward tracking. Inbound (return) scan = return tracking.
- OlkoCMS inbound includes BOTH "failed delivery" returns AND "customer" returns. Staff scan
  one tracking number; the system must auto-detect: delivery vs return, and which return type.
- "Scrap" returns do NOT physically come back to the store, so they are never inbound-scanned.

## ID TYPES (critical - do not confuse)
- order_id  (a.k.a. trade_order_id)        e.g. 215639386580372 / 207558548878945  - the purchase order
- order_item_id (a.k.a. trade_order_line_id) e.g. 207558548978945                  - one item line in a forward order
- reverse_order_id                          e.g. 502443085678945                    - a return/cancel request (unique)
- reverse_order_line_id (= Return Item ID)  e.g. 502443085778945                    - one item line in a return
NOTE: Return IDs are NOT order IDs. Passing a return id to /order/items/get fails (code 16).

---

## ENDPOINT 1 (FORWARD) - /order/items/get  [GET]
Param: order_id. Returns data[] = array of items.
Correct store detection: code === "0" AND data.length > 0. A WRONG store returns code === "16".
Per-item fields we use:
- tracking_code        outbound tracking (e.g. DEXNP025640432)
- order_id, order_item_id
- status               item-level, lowercase (e.g. "delivered")
- name                 product name
- paid_price, item_price
- shipment_provider    e.g. "Drop-off: NP-DEX, Delivery: NP-DEX"
- cancel_return_initiator   "null-null" when not cancelled/returned; otherwise values like
                            cancellation-customer / cancellation-seller / cancellation-failed Delivery /
                            return-customer / cancellation-internal / refund-internal
- return_status
Verified delivered: order 215639386580372 -> item tracking DEXNP025640432, status "delivered",
store Yagya Premiums.

---

## ENDPOINT 2 (REVERSE LIST) - /reverse/getreverseordersforseller  [POST]
Signature: ALL params (system + business: page_size, page_no, etc.) merged, sorted, signed
together; business params sent as QUERY params (NOT JSON body). POST with empty body.
(First attempt with JSON body + body appended to sign string gave IncompleteSignature; the
merged-query approach works -> code "0".)
Params: page_size (req), page_no (req), reverse_order_id?, trade_order_id?, ofc_status_list[]?,
reverse_status_list[]?, return_to_type?, dispute_in_progress?, time-range filters (ms).
Returns result.items[] with SUMMARY ONLY (NO tracking):
- reverse_order_id, trade_order_id, request_type ("CANCEL" | "RETURN"), is_rtm, shipping_type
  ("PICK_UP" | "DROP_OFF", present on RETURN).
result.total gives total count per store (thousands each).
Use this to LIST reverse orders (filter by trade_order_id or time range), get reverse_order_id,
then call ENDPOINT 3 for tracking + status.

---

## ENDPOINT 3 (REVERSE DETAIL) - /order/reverse/return/detail/list  [GET]
THIS IS THE KEY ENDPOINT FOR RETURN TRACKING.
Method MUST be GET (POST returns UnsupportedHTTPMethod). Path is valid even though API Explorer
once showed "does not exist" (that was due to empty Region in Explorer).
Param: reverse_order_id.
Correct store detection: data.reverseOrderLineDTOList is NON-EMPTY (wrong stores return code "0"
with reverseOrderLineDTOList: []).
Response shape: data.{ reverse_order_id, request_type, shipping_type, is_rtm, trade_order_id,
reverseOrderLineDTOList[] }
Each reverseOrderLineDTOList[] item:
- tracking_number          RETURN tracking (e.g. DEXNP009570773) <- staff inbound scan matches THIS
- reverse_order_line_id    return item id (e.g. 502443085778945)
- trade_order_line_id      forward order_item_id (links back to forward item, e.g. 207558548978945)
- ofc_status               logistic status, e.g. "RETURN_RTM_DELIVERED" (= "Returned to seller")
- reverse_status           e.g. "REFUND_SUCCESS"
- whqc_decision            warehouse QC, e.g. "return_to_merchant" (vs scrap) - decides if item
                           physically comes back to store
- reason_text / reason_code   e.g. "Item is defective or not working" / 10010025
- refund_amount, item_unit_price   in PAISA (divide by 100 for Rs) e.g. 67600 -> Rs 676
- seller_sku_id, platform_sku_id, productDTO{product_id, sku}, buyer{user_id}
- is_need_refund, is_dispute
- timestamps (epoch SECONDS): return_order_line_gmt_create, return_order_line_gmt_modified,
  trade_order_gmt_create
Verified: reverse_order_id 502443085678945 -> tracking_number DEXNP009570773, ofc_status
RETURN_RTM_DELIVERED, reverse_status REFUND_SUCCESS, whqc_decision return_to_merchant,
store Yagya Premiums. Matches Seller Center return detail exactly.

---

## SIGNATURE NOTES
- HMAC-SHA256, key = DARAZ_APP_SECRET.trim(), hex UPPERCASE.
- Build string = apiPath + (sortedKey+value concatenated for ALL params except sign).
- Query = sorted keys, each k=encodeURIComponent(v), joined by &, then &sign=... LAST.
- For these reverse endpoints we do NOT append a JSON body to the sign string; business params
  go into the merged param set as query params instead.

## STORE NOTE
- DarazStore.storeName holds the EMAIL (e.g. yagyapremiums@gmail.com), NOT the display name.
  Do NOT filter by storeName: "Yagya Premiums" - it won't match. Use storeMap.ts resolveStoreName()
  for display, or loop all active stores and detect the correct one by non-empty data.
- 9 active stores; each order/return is visible from exactly ONE store; others return empty.

## PROVISIONAL DATA MODEL (decided direction, not yet built)
Real unit = ITEM (and tracking), not order. Plan: a per-item table (e.g. DarazOrderItem) with
BOTH outbound and return tracking, because one item can have an outbound tracking AND later a
return tracking. trackingNo must NOT be @unique (bundle = same outbound tracking on many items).
order_item_id (trade_order_line_id) is the stable unique key. Suggested fields:
- orderItemId (@unique), darazOrderId, itemName, sku, status (forward), price, storeId,
  trackingNo (outbound, indexed, not unique), shipmentProvider, cancelReturnInitiator,
  deliveredAt?
- return side: returnTrackingNo (indexed), reverseOrderId, reverseOrderLineId, ofcStatus,
  reverseStatus, whqcDecision, returnReason, refundAmount, requestType (CANCEL/RETURN),
  shippingType
Match logic: outbound scan tracking -> DarazOrderItem.trackingNo; return scan tracking ->
DarazOrderItem.returnTrackingNo. Auto-detect delivery vs return vs failed-delivery from
request_type + cancel_return_initiator + ofc_status.

## BUILD ORDER (unchanged from handoff, now unblocked)
1. Save outbound tracking during fetch (separate paginated pass calling /order/items/get).
2. Add reverse fetch: list (/reverse/getreverseordersforseller) -> detail
   (/order/reverse/return/detail/list) -> save return tracking + status to DB.
3. resolve-scans: match unmatched scans/alerts locally by tracking (outbound + return).
4. Manual test on known trackings: DEXNP025640432 (outbound), DEXNP009570773 (return).
5. Nightly cron 8 PM NPT (targeted: only items on Outbound/Inbound/Alerts pages).
6. Reconcile fix: run after resolve; add deleted:false filter.

## DEBUG ROUTES CREATED THIS SESSION (clean up later)
- /api/daraz/debug-items   (forward items inspection; batch full-raw)
- /api/daraz/debug-reverse  (reverse list + detail probe)
Both are temporary; delete after the real fetch/resolve routes are built.

## KNOWN TEST DATA
- Forward delivered: order 215639386580372, item tracking DEXNP025640432, store Yagya Premiums.
- Return: order 207558548878945, reverse_order_id 502443085678945, return tracking DEXNP009570773,
  ofc_status RETURN_RTM_DELIVERED, store Yagya Premiums.
- Tracking format: DEXNP + 9 digits (also UPANP); PND uses XXX-XX-9digits.
---

# SESSION 2 UPDATE (reverse fetch built, forward+reverse foundation complete)

## SCHEMA BUILT — DarazOrderItem (Option A: forward + return in one table)
Model added to prisma/schema.prisma (after DarazOrder, before ActivityLog). Pushed via `npx prisma db push`.
Fields: id(cuid), orderItemId(@unique), darazOrderId, itemName, sku, status, price, storeId,
trackingNo, shipmentProvider, cancelReturnInitiator, deliveredAt,
returnTrackingNo, reverseOrderId, reverseOrderLineId, ofcStatus, reverseStatus, whqcDecision,
returnReason, refundAmount, requestType, shippingType, createdAt, updatedAt.
Indexes: @@index([trackingNo]), @@index([returnTrackingNo]), @@index([darazOrderId]).
KEY: orderItemId is the @unique upsert key. trackingNo / returnTrackingNo are NOT unique
(bundle = one outbound tracking on many items). order_item_id = trade_order_line_id links
forward item and reverse line (1:1).

## ROUTES BUILT
- /api/daraz/fill-tracking [POST {offset}, batch 12] — forward: loops DarazOrder, for each
  uses saved storeId first (1 call), falls back to all stores; calls /order/items/get; upserts
  DarazOrderItem with tracking_code, status, name, sku, paid_price, shipment_provider,
  cancel_return_initiator. Auto-paginate {offset}->done.
- /api/daraz/fill-returns [POST {storeIndex, windowIndex, pageNo}] — reverse: window-by-window
  (see cap fix below); per window lists reverse orders, filters request_type==="RETURN", calls
  detail, upserts return fields onto DarazOrderItem by orderItemId (=trade_order_line_id);
  creates new row if forward item absent. Advances page->window->store.

## PAGE-100 CAP (critical) + SOLUTION
/reverse/getreverseordersforseller returns NOTHING past page 100 (page 101 -> total 0, items 0),
even when total > 5000. Deep pagination is capped. SOLUTION: filter by time window using
TradeOrderLineCreatedTimeRangeStart / TradeOrderLineCreatedTimeRangeEnd (epoch MS) — these
DO filter (verified: total dropped 11008 -> 355 for a 2-month window). Other guessed names like
ReverseOrderLineCreatedTimeRange did NOT filter. We walk 15-day windows from 2019-01-01 to now
(181 windows/store); each window stays under the 100-page cap. capRisk flag = total>5000 (none hit).

## RETURN TYPE CLASSIFICATION (verified with 3 real orders) — how to know inbound-scannable
Decisive field = whqc_decision (ofc_status agrees):
- request_type "CANCEL" -> NO tracking at all (item never shipped, e.g. payment fail). NOT inbound.
  We skip CANCEL in reverse fetch (only process RETURN).
- request_type "RETURN" + whqc_decision "return_to_merchant" (ofc_status RETURN_RTM_*) -> comes
  back to OUR store -> INBOUND scan happens. (verified: order 215524547256631, tracking DEXNP025419650)
- request_type "RETURN" + whqc_decision "return_to_customer" (ofc_status RETURN_RTC_*) -> QC sent
  back to customer -> NOT inbound. (verified: order 215593960436740, ofc RETURN_RTC_DELIVERY_FAILED)
- FAILED DELIVERY (customer never received) -> NOT in reverse API at all. Lives in FORWARD
  /order/items/get with status "shipped_back" (or "failed_delivery"); tracking_code is the SAME
  outbound tracking. INBOUND scan happens. (verified: order 215468222820925, status shipped_back,
  tracking DEXNP025635049)

## INBOUND SCAN MATCH RULE (for Step 3 resolve-scans)
A return tracking scanned by staff matches DarazOrderItem where:
  returnTrackingNo == scan   (customer returns; whqcDecision return_to_merchant = expected inbound)
  OR trackingNo == scan AND status IN ("shipped_back","failed_delivery","returned")  (failed delivery)
return_to_customer items are NOT expected as inbound.

## FORWARD ITEM STATUS VALUES SEEN (/order/items/get status field)
delivered, shipped, pending, ready_to_ship, canceled, returned, failed_delivery, shipped_back,
shipped_back_success. (tracking null for canceled/pending — never shipped; correct.)

## REVERSE status VALUES SEEN
ofc_status: RETURN_RTM_DELIVERED (returned to seller), RETURN_RTC_DELIVERY_FAILED (back to customer).
reverse_status: REFUND_SUCCESS, REQUEST_REJECT, CANCEL_SUCCESS, REQUEST_INITIATE.
whqc_decision: return_to_merchant, return_to_customer (null while still in process).

## DATA LOADED (verified counts after full run)
- DarazOrder: 1407 orders.
- fill-tracking: 1566 forward items, withTracking 921 (645 null = canceled/pending, correct).
- fill-returns (2019->now, 15-day windows, ~54 min, 2465 calls): returnsFound 4257, upserted 4509.
- Final DarazOrderItem: totalItems 5793, withTracking 921, withReturnTracking 3923,
  withReverseId 4255, whqcMerchant 2667, whqcCustomer 253.
- Return-only rows have no forward fields (itemName falls back to seller_sku_id).

## STORE LIST ORDER (orderBy id asc; used by window/store index)
0 yagyapremiums, 1 budgetdealsnepal, 2 blackdragonnepal, 3 dealmeonsnepal, 4 firstdrop79,
5 gadgetfinder2020, 6 gadgetsfindernepal, 7 selfcarenepa, 8 tb200247.

## DEBUG ROUTES NOW (clean up later)
debug-items, debug-reverse are temporary. fill-tracking, fill-returns are REAL (keep).

## NEXT (Step 3 onward)
3. resolve-scans: match unmatched DarazScan/alerts by tracking using INBOUND SCAN MATCH RULE.
4. Manual test, then nightly cron 8PM NPT (targeted: Outbound/Inbound/Alerts page items only).
5. Reconcile: run after resolve; add deleted:false filter.
6. INCREMENTAL cron: reuse TradeOrderLineCreatedTimeRange to fetch only recent windows, not all 181.