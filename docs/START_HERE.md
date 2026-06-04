# START HERE ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â OlkoCMS Findings Map

> **This is the master map.** It lives in the repo at `docs/START_HERE.md`.
> Paste or upload THIS file at the very start of any new chat. It tells the assistant
> what knowledge exists and in which file, so the assistant can then ask you to pull
> the specific file(s) it needs. (The assistant cannot open the private GitHub repo
> itself ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â you upload/paste the file it names.)

---

## How to start a new chat (copy-paste this to the assistant)

> "This is my OlkoCMS project. I'm pasting `START_HERE.md` (the findings map). All detailed
> findings live in my GitHub repo at `github.com/oprayass/olkocms` under `docs/`. When you need
> the details for a task, tell me exactly which file from the map to upload, and I'll paste/upload
> it. Today I want to work on: <DESCRIBE TASK>."

The assistant will look at the map below, decide which file(s) cover your task, and say something like:
> "For that I need `DARAZ_API_FINDINGS.md` from `docs/` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â please upload it." 

Then you upload that file (paperclip) or paste its contents. Upload only the file(s) the assistant names ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â keeps context light.

---

## Project snapshot (always true)
- **Stack**: Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + PostgreSQL (Neon) + Prisma 5.22 + NextAuth (JWT).
- **Repo**: `github.com/oprayass/olkocms` Ãƒâ€šÃ‚Â· **Live**: `https://olkocms.vercel.app` (push to `main` ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ auto-deploy ~2-3 min).
- **Code under `src/app/...`** (NOT root `app/`). Docs under `docs/`.
- **Machines**: Home `C:\Users\Prayash\Desktop\olkocms` Ãƒâ€šÃ‚Â· Office `C:\Users\Dell\Desktop\olkocms`.
- **Login**: `admin@olkocms.com` (password varied by phase: `admin123` / `password123`).

---

## The map ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â which file holds what (file lives in `docs/`)

### `PROJECT_SETUP_FINDINGS.md`  ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â **read first for almost any coding task**
Stack & folder layout Ãƒâ€šÃ‚Â· Neon + Vercel infra Ãƒâ€šÃ‚Â· all env var names Ãƒâ€šÃ‚Â· Prisma 5-vs-7 Ãƒâ€šÃ‚Â· the full working-method gotcha list: PowerShell `WriteAllText`/`$PWD`/BOM, CRLF-vs-LF, heredoc, fetch-vs-PowerShell, git (filter-branch, pull lock, rejected push), Next.js/Vercel build (force-dynamic, no edge runtime, ESLint ignore), Neon SQL editor.
**Pull this when**: writing/editing any file, build errors, env/deploy issues, "where does X live", PowerShell/git trouble.

### `AUTH_FINDINGS.md`
NextAuth single `lib/auth.ts` config Ãƒâ€šÃ‚Â· CredentialsProvider Ãƒâ€šÃ‚Â· bcrypt (bcryptjs) Ãƒâ€šÃ‚Â· User-then-Staff authorize Ãƒâ€šÃ‚Â· password-change auto-logout (`passwordChangedAt` + `SessionGuard` + session `expired` flag) Ãƒâ€šÃ‚Â· Staff schema Ãƒâ€šÃ‚Â· the duplicate-config bug.
**Pull this when**: login, sessions, passwords, RBAC auth, auto-logout, middleware protection.

### `WEBHOOK_AI_FINDINGS.md`
Meta/Facebook webhook (verify token `olkocms2024`, hardcoded fallback, Graph API v25, page subscribe, app unpublished limits) Ãƒâ€šÃ‚Â· Anthropic Claude API (**model `claude-sonnet-4-5`**, not -20250514) Ãƒâ€šÃ‚Â· `/api/ai-reply` Ãƒâ€šÃ‚Â· ngrok setup Ãƒâ€šÃ‚Â· webhook test commands.
**Pull this when**: Facebook/Instagram/WhatsApp webhook, Claude API calls, AI reply plumbing, Meta app/publish.

### `AI_SALES_AGENT_FINDINGS.md`
Autonomous FB Messenger sales agent: stage flow (greetingÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢confirmed) Ãƒâ€šÃ‚Â· bargaining (3 attempts, max 5%) Ãƒâ€šÃ‚Â· weight-based delivery charges Ãƒâ€šÃ‚Â· same-day rules Ãƒâ€šÃ‚Â· language rules (Devanagari/Sir/Madam) Ãƒâ€šÃ‚Â· `[NEEDS_HUMAN]` handoff Ãƒâ€šÃ‚Â· product-alias map Ãƒâ€šÃ‚Â· anti-hallucination.
**Pull this when**: the chatbot/sales agent behaviour, bargaining, delivery pricing, conversation stages.

### `CMS_CORE_FINDINGS.md`
The social-commerce CMS: all schema (User/Order/Message/Product/Followup/Shipment/AIConversation/ActivityLog/Plan/Subscription/Payment/AdCampaign/AdExpense/AdOrder) Ãƒâ€šÃ‚Â· all non-Daraz API routes Ãƒâ€šÃ‚Â· Orders flags Ãƒâ€šÃ‚Â· SMS (Sparrow)/WhatsApp(`wa.me`)/Call Ãƒâ€šÃ‚Â· dashboard ad-stats & P&L formulas Ãƒâ€šÃ‚Â· subscriptions/billing Ãƒâ€šÃ‚Â· content Ãƒâ€šÃ‚Â· followups Ãƒâ€šÃ‚Â· default role permissions Ãƒâ€šÃ‚Â· key pages/components.
**Pull this when**: Dashboard, Orders, Messages, Products, Staff/RBAC, Followups, Courier, Reports, Content, Subscriptions/billing, Ad campaigns/P&L, SMS/WhatsApp.

### `DARAZ_API_FINDINGS.md`  ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â **the big Daraz reference**
Everything about the Daraz Open Platform API: signature Ãƒâ€šÃ‚Â· ID types Ãƒâ€šÃ‚Â· forward `/orders/get` & `/order/items/get` (tracking) Ãƒâ€šÃ‚Â· `/logistic/order/trace` (true delivered date) Ãƒâ€šÃ‚Â· reverse `/reverse/getreverseordersforseller` (+page-100 cap + `TradeOrderLineCreatedTimeRange` window fix) Ãƒâ€šÃ‚Â· `/order/reverse/return/detail/list` (return tracking, GET) Ãƒâ€šÃ‚Â· return classification by `whqc_decision` Ãƒâ€šÃ‚Â· `DarazOrderItem` schema Ãƒâ€šÃ‚Â· all fetch routes (fill-tracking, fill-returns, fill-delivered-dates, refresh-status, reconcile) Ãƒâ€šÃ‚Â· Sync button Ãƒâ€šÃ‚Â· verified counts & test order/tracking IDs.
**Pull this when**: anything calling Daraz, order/return fetching, tracking, delivered dates, signature, the central `DarazOrderItem` table.

### `DARAZ_SCANS_CLAIMS_FINDINGS.md`
**CENTRAL-DB ARCHITECTURE (single source of truth ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â read this for the core design)** Ãƒâ€šÃ‚Â· warehouse workflow: outbound/inbound scan rules Ãƒâ€šÃ‚Â· duplicate-scan popup (EN/NP) Ãƒâ€šÃ‚Â· wrong-store flag Ãƒâ€šÃ‚Â· claim management (financial fields + `DarazClaimLog` audit) Ãƒâ€šÃ‚Â· `DarazScan`/`DarazClaim`/`DarazAlert` schema Ãƒâ€šÃ‚Â· scan/claim routes & pages Ãƒâ€šÃ‚Â· **INBOUND MATCH RULE** Ãƒâ€šÃ‚Â· resolve-scans + nightly-cron plan Ãƒâ€šÃ‚Â· store cuids.
**Pull this when**: the central-DB design, scanning UI/logic, claims, alerts, reconciliation, the tracking-match feature, the nightly cron, "how should All-To-Ship / Orders sync / Alerts all share one DB".
> **STATUS 2026-06-05 (commits dd39038 -> 4e1f469):** Daraz UI polish + Nepal-time fix. NEW `src/lib/nepalTime.ts` (nepalTodayStartUTC, nepalPeriodRange) - ALL calendar date filters (today/week/month/year on outbound/inbound/scan-manage/dashboard/orders/returns-list/alerts) now compute in NPT (UTC+5:45); Vercel-UTC midnight bug fixed. Orders page "Delivered Revenue" card adapts to status filter. Scans page: whole-DB tracking search (barcode-validated) + clickable tracking -> OrderDetailPopup (works for outbound null-orderId via tracking->DarazOrderItem lookup); popup now has qty + order date. Alerts popup: raw notes removed, product image+name added. NEW reusable `src/components/ZoomableImage.tsx` (click product image -> full-screen). See DARAZ_SCANS_CLAIMS + PROJECT_SETUP UPDATE 2026-06-05.
> **STATUS 2026-06-04 (commits 487b73d, c4c6e48):** QR-vs-barcode scan guard. Daraz label has tracking in BARCODE, address in QR; mis-scanned QR was entering as junk tracking. trackingValidator gained looksLikeQrOrAddress() (whitespace / address punctuation / non-ASCII / len>25 / no-alphanumeric). Force Add loophole closed on outbound + returns pages: Force Add now HARD-blocks QR/address but still lets a clean unknown-prefix new courier through (no per-subscriber code edit). See DARAZ_SCANS_CLAIMS UPDATE 2026-06-04.
> **STATUS 2026-06-04 (commit d9e4f3f):** reconcile blank-status guard - outbound loop now skips when matched item has empty status (prevents false 'Not Delivered' alerts on fresh/incomplete fetches; real alerts + resolved alerts untouched). Temp diagnose-nomatch debug route added then removed. Confirmed multi-tenant tenancy is NOT yet in schema (no subscriptionId on Daraz models); per-subscriber match guard deferred. See DARAZ_SCANS_CLAIMS UPDATE 2026-06-04.
> **STATUS 2026-06-04 (commits 853890e -> c61a08d):** Alerts resolve mgmt DONE - per-alert checkbox + bulk Select-all/Resolve, outbound scan date on card, sticky dedupe (resolved/lost never re-created). Outbound alert logic finalized: match scan vs DarazOrderItem (tracking lives there, NOT DarazOrder); alert when ready_to_ship/packed/pending OR no-match; failed_delivery + shipped_back_success excluded (return-side). ROOT-CAUSE FIX: tracking only in DarazOrderItem and Daraz removes it after delivery -> Sync now 6-step with fill-tracking (recentOnly), cron has Step 1b fill-tracking; reconcile/cron outbound-match uses DarazOrderItem. PND tracking slash->dash normalize on scan save + backfill. See DARAZ_SCANS_CLAIMS + DARAZ_API UPDATE 2026-06-04.
> **STATUS 2026-06-03 (commits 493c861 -> 1ca844a):** central-DB integration DONE. Sources unified under incremental write; `resolve-scans` + `cron/nightly` (8PM NPT) + DB-derived 3-type alerts now exist; Orders Sync is 5-step (resolve before reconcile); 12 orphan debug routes removed. Post-deploy checks pending in `docs/PENDING_CRON_CHECK.md`.

---

## Quick task ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ file cheat-sheet
- "Daraz order/return/tracking/delivered date" ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ `DARAZ_API_FINDINGS.md` (+ `DARAZ_SCANS_CLAIMS` if scanning/claims/cron).
- "scan / claim / alert / reconcile / tracking-match" ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ `DARAZ_SCANS_CLAIMS_FINDINGS.md` (+ `DARAZ_API` for the API calls).
- "login / password / session" ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ `AUTH_FINDINGS.md`.
- "facebook webhook / Claude API / AI reply" ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ `WEBHOOK_AI_FINDINGS.md`.
- "chatbot behaviour / bargaining / delivery charge" ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ `AI_SALES_AGENT_FINDINGS.md`.
- "orders / products / subscriptions / ads / reports / SMS" ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ `CMS_CORE_FINDINGS.md`.
- "build error / powershell / git / env / where is X" ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ `PROJECT_SETUP_FINDINGS.md`.
- Most coding tasks also want `PROJECT_SETUP_FINDINGS.md` for the working-method rules.

## Cross-cutting reminders (true everywhere ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â so the assistant won't re-learn them)
- PowerShell write: `[System.IO.File]::WriteAllText("$PWD\path", $c, (New-Object System.Text.UTF8Encoding $false))` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â always `$PWD\`, BOM-free.
- `fetch()` = browser console on the olkocms.vercel.app tab only; `npm`/`git`/`Select-String`/`$c=` = PowerShell only.
- Daraz `DARAZ_APP_SECRET` must be `.trim()`ed before signing; routes reading `request.url` need `export const dynamic = "force-dynamic"`.
- Neon = pooler URL on Vercel. Vercel Hobby = ~10s timeout (batch loops), max 2 daily crons.
- Keep injected code English-only (heredoc corrupts Nepali ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ `???`).

## Keeping this current
After a big chat, run the findings-extraction prompt at the end of that chat, then update or add the matching `docs/*.md` file and, if a new topic appeared, add a row to the map above. Commit: `git add docs ; git commit -m "docs: update findings" ; git push`.