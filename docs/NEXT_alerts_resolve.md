# NEXT TASK — Daraz Alerts: resolve management + fixes (planned 2026-06-04)

## Context (what is already built — commits up to d98f9bd + a debug route)
Central-DB integration is DONE (see DARAZ_SCANS_CLAIMS_FINDINGS.md STATUS line + PENDING_CRON_CHECK.md).
Alerts page derives 3 types from reconcile: outbound_not_delivered, return_not_received, wrong_store.
Alerts page is at src/app/dashboard/daraz/alerts/page.tsx ; reconcile at src/app/api/daraz/reconcile/route.ts ; cron at src/app/api/daraz/cron/nightly/route.ts.

## IMPORTANT correction to prior assumption
Outbound workflow: items pack from 6pm, reach the hub by ~midnight, and ARE scanned there.
So an outbound scan showing up as an alert on the SAME day ("Today") is NORMAL and fine.
=> Do NOT delay/hide alerts by time. The earlier "cutoff / must-wait-X-days" idea was WRONG.

## FIRST: revert the bad cutoff
Commit d98f9bd added `CUTOFF = new Date("2026-05-01...")` with `createdAt: { gte: CUTOFF }` in
both reconcile/route.ts and cron/nightly/route.ts. This made outbound alerts BALLOON (275 -> 1402)
because it widened the window. REVERT this (git revert --no-edit d98f9bd) or restore the prior
`tenDaysAgo` logic. Outbound alerts should NOT be gated by a fixed date.

## THE 5 REQUIREMENTS (what the user actually wants)
1. Tick (checkbox) an outbound alert to resolve it. Same for inbound/return alerts.
2. BULK select: select many (or all) alerts at once and resolve in one action.
   Purpose: quickly sort out the large backlog of old alerts into "resolved".
3. CRITICAL: once resolved, an alert must NOT be re-created when reconcile/cron runs again.
   Current bug: reconcile dedupe uses `notes: { contains: alertKey }` AND `status: { not: "resolved" }`,
   so a resolved alert is treated as "absent" and re-created => infinite loop. Fix the dedupe to
   also count resolved (and lost) alerts, OR keep a resolved-tracking skip set, so resolved stays resolved.
4. Outbound alert card: show the outbound scan DATE in small text on the side.
5. (implied) After the above, the big "unknown" backlog can be bulk-resolved and stays gone.

## Data facts (from debug-outbound route, keep it for now)
- 11,397 outbound scans total. withTracking only 270; withOrderId 11,127; none with neither.
- Most outbound scans do NOT match central DarazOrderItem/DarazOrder by tracking (fresh scans whose
  order has not been fetched into central DB yet, plus older imported scans).
- This is why almost every outbound scan becomes an "Unknown Item / Order: unknown" alert.
- Decide: should an outbound scan with NO central-DB match still be an alert? Probably yes (it is
  "sent, not yet confirmed"), but it must be bulk-resolvable and stay resolved.

## debug route (temporary)
src/app/api/daraz/debug-outbound/route.ts  — GET, returns counts/dateRange/sampleMatch. Delete later.

## Schema note for resolve
DarazAlert: id, darazOrderId, productName, alertType, status(default "unresolved"), notes?, resolvedAt?, createdAt.
Alerts PATCH route already exists: /api/daraz/alerts PATCH { id, status } (status "resolved" sets resolvedAt).
Bulk resolve will need either a new endpoint (PATCH array of ids) or loop the existing one.

## Working method reminders (see PROJECT_SETUP_FINDINGS.md)
- PowerShell write: [System.IO.File]::WriteAllText("$PWD\path", $c, (New-Object System.Text.UTF8Encoding $false)) ; create folder first.
- Multi-line edits: use line-by-line ForEach (match on ASCII anchor) — .Replace()/regex on CRLF heredoc often silently fail.
- Keep ALL injected strings ASCII-only (heredoc corrupts emoji/Nepali -> mojibake; proven on Alerts page).
- typescript ignoreBuildErrors is ON: build can pass while page crashes at runtime — open the page in browser to confirm.
- After edits: build, then git add . ; git commit ; git push. Pull on the other machine first.