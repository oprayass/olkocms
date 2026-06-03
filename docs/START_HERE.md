# START HERE — OlkoCMS Findings Map

> **This is the master map.** It lives in the repo at `docs/START_HERE.md`.
> Paste or upload THIS file at the very start of any new chat. It tells the assistant
> what knowledge exists and in which file, so the assistant can then ask you to pull
> the specific file(s) it needs. (The assistant cannot open the private GitHub repo
> itself — you upload/paste the file it names.)

---

## How to start a new chat (copy-paste this to the assistant)

> "This is my OlkoCMS project. I'm pasting `START_HERE.md` (the findings map). All detailed
> findings live in my GitHub repo at `github.com/oprayass/olkocms` under `docs/`. When you need
> the details for a task, tell me exactly which file from the map to upload, and I'll paste/upload
> it. Today I want to work on: <DESCRIBE TASK>."

The assistant will look at the map below, decide which file(s) cover your task, and say something like:
> "For that I need `DARAZ_API_FINDINGS.md` from `docs/` — please upload it." 

Then you upload that file (paperclip) or paste its contents. Upload only the file(s) the assistant names — keeps context light.

---

## Project snapshot (always true)
- **Stack**: Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + PostgreSQL (Neon) + Prisma 5.22 + NextAuth (JWT).
- **Repo**: `github.com/oprayass/olkocms` · **Live**: `https://olkocms.vercel.app` (push to `main` → auto-deploy ~2-3 min).
- **Code under `src/app/...`** (NOT root `app/`). Docs under `docs/`.
- **Machines**: Home `C:\Users\Prayash\Desktop\olkocms` · Office `C:\Users\Dell\Desktop\olkocms`.
- **Login**: `admin@olkocms.com` (password varied by phase: `admin123` / `password123`).

---

## The map — which file holds what (file lives in `docs/`)

### `PROJECT_SETUP_FINDINGS.md`  — **read first for almost any coding task**
Stack & folder layout · Neon + Vercel infra · all env var names · Prisma 5-vs-7 · the full working-method gotcha list: PowerShell `WriteAllText`/`$PWD`/BOM, CRLF-vs-LF, heredoc, fetch-vs-PowerShell, git (filter-branch, pull lock, rejected push), Next.js/Vercel build (force-dynamic, no edge runtime, ESLint ignore), Neon SQL editor.
**Pull this when**: writing/editing any file, build errors, env/deploy issues, "where does X live", PowerShell/git trouble.

### `AUTH_FINDINGS.md`
NextAuth single `lib/auth.ts` config · CredentialsProvider · bcrypt (bcryptjs) · User-then-Staff authorize · password-change auto-logout (`passwordChangedAt` + `SessionGuard` + session `expired` flag) · Staff schema · the duplicate-config bug.
**Pull this when**: login, sessions, passwords, RBAC auth, auto-logout, middleware protection.

### `WEBHOOK_AI_FINDINGS.md`
Meta/Facebook webhook (verify token `olkocms2024`, hardcoded fallback, Graph API v25, page subscribe, app unpublished limits) · Anthropic Claude API (**model `claude-sonnet-4-5`**, not -20250514) · `/api/ai-reply` · ngrok setup · webhook test commands.
**Pull this when**: Facebook/Instagram/WhatsApp webhook, Claude API calls, AI reply plumbing, Meta app/publish.

### `AI_SALES_AGENT_FINDINGS.md`
Autonomous FB Messenger sales agent: stage flow (greeting→confirmed) · bargaining (3 attempts, max 5%) · weight-based delivery charges · same-day rules · language rules (Devanagari/Sir/Madam) · `[NEEDS_HUMAN]` handoff · product-alias map · anti-hallucination.
**Pull this when**: the chatbot/sales agent behaviour, bargaining, delivery pricing, conversation stages.

### `CMS_CORE_FINDINGS.md`
The social-commerce CMS: all schema (User/Order/Message/Product/Followup/Shipment/AIConversation/ActivityLog/Plan/Subscription/Payment/AdCampaign/AdExpense/AdOrder) · all non-Daraz API routes · Orders flags · SMS (Sparrow)/WhatsApp(`wa.me`)/Call · dashboard ad-stats & P&L formulas · subscriptions/billing · content · followups · default role permissions · key pages/components.
**Pull this when**: Dashboard, Orders, Messages, Products, Staff/RBAC, Followups, Courier, Reports, Content, Subscriptions/billing, Ad campaigns/P&L, SMS/WhatsApp.

### `DARAZ_API_FINDINGS.md`  — **the big Daraz reference**
Everything about the Daraz Open Platform API: signature · ID types · forward `/orders/get` & `/order/items/get` (tracking) · `/logistic/order/trace` (true delivered date) · reverse `/reverse/getreverseordersforseller` (+page-100 cap + `TradeOrderLineCreatedTimeRange` window fix) · `/order/reverse/return/detail/list` (return tracking, GET) · return classification by `whqc_decision` · `DarazOrderItem` schema · all fetch routes (fill-tracking, fill-returns, fill-delivered-dates, refresh-status, reconcile) · Sync button · verified counts & test order/tracking IDs.
**Pull this when**: anything calling Daraz, order/return fetching, tracking, delivered dates, signature, the central `DarazOrderItem` table.

### `DARAZ_SCANS_CLAIMS_FINDINGS.md`
Warehouse workflow: outbound/inbound scan rules · duplicate-scan popup (EN/NP) · wrong-store flag · claim management (financial fields + `DarazClaimLog` audit) · `DarazScan`/`DarazClaim`/`DarazAlert` schema · scan/claim routes & pages · **INBOUND MATCH RULE** · resolve-scans + nightly-cron plan · store cuids.
**Pull this when**: scanning UI/logic, claims, alerts, reconciliation, the tracking-match feature, the nightly cron.

---

## Quick task → file cheat-sheet
- "Daraz order/return/tracking/delivered date" → `DARAZ_API_FINDINGS.md` (+ `DARAZ_SCANS_CLAIMS` if scanning/claims/cron).
- "scan / claim / alert / reconcile / tracking-match" → `DARAZ_SCANS_CLAIMS_FINDINGS.md` (+ `DARAZ_API` for the API calls).
- "login / password / session" → `AUTH_FINDINGS.md`.
- "facebook webhook / Claude API / AI reply" → `WEBHOOK_AI_FINDINGS.md`.
- "chatbot behaviour / bargaining / delivery charge" → `AI_SALES_AGENT_FINDINGS.md`.
- "orders / products / subscriptions / ads / reports / SMS" → `CMS_CORE_FINDINGS.md`.
- "build error / powershell / git / env / where is X" → `PROJECT_SETUP_FINDINGS.md`.
- Most coding tasks also want `PROJECT_SETUP_FINDINGS.md` for the working-method rules.

## Cross-cutting reminders (true everywhere — so the assistant won't re-learn them)
- PowerShell write: `[System.IO.File]::WriteAllText("$PWD\path", $c, (New-Object System.Text.UTF8Encoding $false))` — always `$PWD\`, BOM-free.
- `fetch()` = browser console on the olkocms.vercel.app tab only; `npm`/`git`/`Select-String`/`$c=` = PowerShell only.
- Daraz `DARAZ_APP_SECRET` must be `.trim()`ed before signing; routes reading `request.url` need `export const dynamic = "force-dynamic"`.
- Neon = pooler URL on Vercel. Vercel Hobby = ~10s timeout (batch loops), max 2 daily crons.
- Keep injected code English-only (heredoc corrupts Nepali → `???`).

## Keeping this current
After a big chat, run the findings-extraction prompt at the end of that chat, then update or add the matching `docs/*.md` file and, if a new topic appeared, add a row to the map above. Commit: `git add docs ; git commit -m "docs: update findings" ; git push`.
