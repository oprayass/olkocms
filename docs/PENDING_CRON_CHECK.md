# PENDING CHECK - Daraz Nightly Cron (built 2026-06-03, verify after first auto-run)

## What was built today (commits 493c861 -> 1ca844a)
Central-DB integration: every Daraz page reads/verifies against DarazOrderItem + DarazOrder.
Incremental write everywhere (new/changed only). Alerts derived from scan-vs-central-DB.
- src/lib/daraz/upsertOrderItem.ts   incremental helper (key=orderItemId, field-scoped, null never wipes)
- to-ship/route.ts                   All-To-Ship: live incremental + DB-read fallback
- orders/fetch/route.ts              Sync step A: skip-unchanged upsert into DarazOrder
- resolve-scans/route.ts   [NEW]     INBOUND MATCH RULE vs DarazOrderItem
- reconcile/route.ts                 central-DB-first alerts (3 types), deleted:false
- cron/nightly/route.ts    [NEW]     8PM NPT orchestrator: fetch -> refresh -> resolve -> reconcile
- vercel.json                        dropped orders/fetch cron; added nightly "15 14 * * *" (=8PM NPT)
- orders/page.tsx                    Sync now 5-step: ... -> resolve-scans -> reconcile
- alerts/page.tsx                    Reconcile button now runs resolve-scans first
- removed 12 orphan debug/fix/cleanup routes (kept debug-stores, import-scans, fetch-missing-orders)

## TO VERIFY (after the cron has run at least once, ~2026-06-05)
1. Vercel -> Deployments -> (latest) -> cron log for /api/daraz/cron/nightly.
   Expect: { success:true, step1_fetch, step2_refreshStatus, step3_resolveScans, step4_reconcile, durationMs }.
2. CHECK durationMs vs Hobby ~10s. If near/over ~10000, trim: fetch window 7d->3d, or drop step1 full fetch.
3. CRON_SECRET exists in Vercel (Production+Preview, added May 24) - value masked/unretrievable.
   Vercel auto-sends it on its own cron call, so auto-run is fine. Manual test needs the real value.
   ODD: stored value shows "sk_live_a12..." (looks like a Stripe key). Investigate separately; does not affect cron auth.
4. Open Alerts page: confirm 3 types render & make sense:
   outbound_not_delivered (sent but no Daraz progress = possibly lost),
   return_not_received (customer return OR failed delivery, no inbound scan),
   wrong_store (inbound scan unmatched).

## Manual test (browser console on olkocms.vercel.app tab, real secret)
fetch(window.location.origin + "/api/daraz/cron/nightly", { headers: { authorization: "Bearer <REAL_SECRET>" } }).then(r => r.json()).then(console.log)