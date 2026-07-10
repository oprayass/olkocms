# Customer Phone Capture (Daraz)

**Status:** Live in production
**Owner:** Prayash
**Last updated:** 2026-07-10

Captures the customer's contact phone number for every Daraz order and displays
it (tap-to-call) in the order detail popup. Built to survive Daraz's habit of
stripping fields after an order is delivered.

---

## 1. Where the phone comes from

The phone is **only** available in the **list-mode** response of Daraz's
`/orders/get` endpoint, inside the address objects:

```json
"address_shipping": {
  "phone": "9779843292986",
  "phone2": "",
  "first_name": "Suman kc",
  "city": "Kathmandu Outside Ring Road",
  ...
}
```

### Critical Daraz quirks (learned the hard way)

- **`/orders/get` by `order_id` alone FAILS** with `E018: Either CreatedAfter or
  UpdatedAfter is mandatory`. It only works in **list mode** with a
  `created_after` (or `update_after`) window. Any code calling it with just an
  order id has always silently failed.
- **The phone is NOT in `/order/items/get`.** That endpoint returns line items
  (name, sku, tracking, status) but no customer contact.
- **Tracking codes die after delivery.** This is why the DB keys everything on
  `darazOrderId` (stable, `@unique`), never on tracking. The phone attaches to
  `darazOrderId` and survives status changes.

---

## 2. Data model

Two nullable columns on `DarazOrder`:

| Column             | Purpose                                  | Example         |
|--------------------|------------------------------------------|-----------------|
| `customerPhone`    | Normalized 10-digit local number         | `9843292986`    |
| `customerPhoneRaw` | Exactly what Daraz sent (audit/debug)    | `9779843292986` |

Both nullable — some orders genuinely have no phone in Daraz's response, and the
write must never crash on a missing value.

---

## 3. Capture logic

Location: `src/app/api/daraz/orders/fetch/route.ts`

### Source priority (first non-empty wins)

1. `address_shipping.phone`
2. `address_shipping.phone2`
3. `address_billing.phone`
4. `address_billing.phone2`

### Normalization (`normalizePhone` helper)

- Strip everything non-digit.
- If 13 digits starting `977` -> drop the `977` prefix (keep last 10).
- If 11 digits starting `977` -> drop the `977` prefix.
- Result is 10 digits -> store in `customerPhone`; otherwise `customerPhone`
  stays null but `customerPhoneRaw` keeps the cleaned raw value.

### Write rule (incremental, non-destructive)

Follows the same discipline as the rest of `upsertDarazOrder`:

- On **create**: write both phone fields from the order.
- On **update**: only write a phone field if the new value is **non-empty AND
  different** from what's stored. Never overwrite a good phone with null/empty.

This means once an order has a phone, a later status-change fetch cannot erase it.

---

## 4. Display

- API: `src/app/api/daraz/order-detail/route.ts` reads `customerPhone` from our
  **own DB** (`DarazOrder`), NOT a live Daraz call (that call fails with E018).
  Returns it in the JSON response.
- UI: `src/components/OrderDetailPopup.tsx` renders it in the modal header as a
  green tap-to-call link (`<a href={"tel:" + customerPhone}>`).

Reading from the DB (not live Daraz) makes the display fast, reliable, and
independent of Daraz's flaky order-detail behavior.

---

## 5. Security & tenancy

- `DarazOrder` is tenant-scoped (`subscriptionId`). Phone data inherits full
  tenant isolation automatically — a tenant can only ever see their own orders'
  phones. Verified: the isolation-test tenant sees zero orders/phones.
- **PII in logs:** customer phone numbers are PII. Temporary debug logs that
  printed raw phone data to Vercel logs (`DARAZ_PHONE_DEBUG`, `PHONE_DEBUG`)
  were used during development and have been **removed**. Do not reintroduce
  plaintext phone logging.
- **Future exports / shipping labels:** any feature that exports phone numbers
  (CSV, shipping labels, invoices) sends PII outside the system boundary. Scope
  it to the tenant's own data and treat the output as sensitive.

---

## 6. Backfill procedure (for the last-10-day window)

The phone only lands via a list-mode fetch, so backfilling older orders means
re-fetching their window. The scope we support is **last ~10 days + going
forward** (older delivered orders are intentionally left null).

### Normal case

Resetting a store's `lastOrderFetch` and running the normal fetch captures
phones for that window:

```sql
UPDATE "DarazStore"
SET "lastOrderFetch" = NOW() - INTERVAL '10 days'
WHERE "isActive" = true;
```

Then trigger `/api/daraz/orders/fetch` (main admin, logged in).

### The 100-per-fetch cap

Daraz `/orders/get` returns max `limit=100` per call, and the normal fetch only
requests `offset=0`. Stores with **more than 100 orders in the window** will have
the overflow un-captured.

For those stores, a temporary offset-paginated backfill endpoint was used
(`/api/daraz/orders/backfill-phone?store=<id>&offset=<n>`), calling
`offset=100,200,300...` until `updated` dropped to ~0. **That endpoint was
temporary and has been deleted** after the one-time backfill. If a future bulk
backfill is needed, recreate a similar phone-only, tenant-scoped, offset-based
endpoint.

### Result of the initial backfill (2026-07-10)

- Recent orders (last 10 days): ~1030 of ~1033 have phones (**99.7%**).
- The ~3 missing are orders where Daraz returned no phone at all (the real floor).

---

## 7. Known constraints

- **Vercel Hobby 10s timeout.** A full 9-store fetch took ~14.8s in-browser (the
  browser tolerates it, but a cron trigger would be killed at 10s). Keep bulk
  operations batched per-store or offset-paged.
- **Going-forward capture is safe** under the cap: incremental fetches pull only
  new orders (a handful at a time), well under 100.
- Older-than-10-day orders are intentionally not backfilled.
