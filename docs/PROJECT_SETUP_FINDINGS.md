# OlkoCMS â€” Project Setup, Infra & Working-Method Findings

Consolidated from all phases. This is the "how we work + where things live" file. Read first.

## Stack & Layout
- Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + PostgreSQL (Neon) + Prisma 5.22 + NextAuth (JWT).
- **All code under `src/app/...`** (NOT root `app/`). Pages live at `src/app/dashboard/...`; e.g. products is `src/app/dashboard/products/page.tsx`, NOT `src/app/products/page.tsx`.
- `src/lib/prisma.ts` = PrismaClient singleton. `src/lib/auth.ts` = NextAuth config (single source of truth â€” see AUTH file). `src/middleware.ts` = protects `/dashboard/:path*`.
- Repo: https://github.com/oprayass/olkocms Â· Live: https://olkocms.vercel.app Â· Branch `main` (push = auto-deploy ~2-3 min).
- Machines: Home `C:\Users\Prayash\Desktop\olkocms` Â· Office `C:\Users\Dell\Desktop\olkocms`.

## Infrastructure
- **Neon PostgreSQL** (free tier), Postgres 16. Host `ep-bold-moon-apfn4ql8-pooler.c-7.us-east-1.aws.neon.tech`, db `neondb`, user `neondb_owner`.
  - **Use the POOLER url on Vercel** (`-pooler` host). Non-pooler / port 5432 causes "No outgoing requests" / timeouts on Vercel; direct URL is only for migrations.
  - SSL: `sslmode=require&channel_binding=require`.
  - **Neon SQL Editor**: click **Run**, not "Explain Analyze" â€” Explain prefixes `EXPLAIN(...)` which makes DDL (`ALTER`/`CREATE`) throw `syntax error at or near "ALTER"`.
  - `prisma db execute --stdin` does NOT print SELECT output â†’ inspect DB via a tiny debug API route + browser instead.
- **Vercel** (Hobby/free). Live `https://olkocms.vercel.app`.
  - Serverless timeout ~**10s** on Hobby even if a route sets `maxDuration=60` (ignored) â†’ batch big loops (store-wise / status-wise / offset paginated).
  - Cron: max **2 jobs, daily only** (6-hourly not allowed). Current `vercel.json`: `expire-subscriptions` `0 0 * * *`, `orders/fetch` `0 1 * * *`.
  - Env-var changes do **not** auto-redeploy â€” push a commit or redeploy.
  - GitHub must be connected (Vercel â†’ Settings â†’ Git â†’ Install GitHub App) for auto-deploy.

## Environment Variables (names; secrets set in Vercel + local `.env.local`)
```
DATABASE_URL=postgresql://neondb_owner:...@ep-bold-moon-apfn4ql8-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
NEXTAUTH_URL=https://olkocms.vercel.app          # local: http://localhost:3000
NEXTAUTH_SECRET=olkocms-secret-key-2024
ANTHROPIC_API_KEY=sk-ant-...
WEBHOOK_VERIFY_TOKEN=olkocms2024                  # see WEBHOOK file (was olkocms_webhook_2024; simplified)
NEPALI_BABU_PAGE_ID=344520078737283
NEPALI_BABU_PAGE_TOKEN=EAAfri...
PINK_ME_PAGE_ID=296064883592821
PINK_ME_PAGE_TOKEN=EAAfri...
DARAZ_APP_KEY=505290
DARAZ_APP_SECRET=...                              # MUST .trim() in code
CRON_SECRET=...                                   # cron routes require Bearer <CRON_SECRET>
SPARROW_SMS_TOKEN=...                             # pending; missing token returns success:false, doesn't break flow
```
- `.env` and `.env.local` are git-ignored â€” created manually on each machine.
- **Next.js API routes reliably load `.env.local`, not always `.env`** (symptom: 401 `invalid x-api-key` though `.env` looks right). Fix: `Copy-Item .env .env.local`. Prisma reads `.env`. Keep both in sync; restart dev server after env change.

## Prisma
- **Use Prisma 5.22, NOT 7.x** â€” v7 schema format is incompatible; v5 stable. (`npm install prisma@5 @prisma/client@5`.)
- Build script: `"build": "prisma generate && next build"`. Also `"postinstall": "prisma generate"` (required for Vercel) â€” mind trailing commas or `package.json` parse fails on build.
- Schema changes: either `npx prisma db push` (most work was done this way, no migration files) or SQL `ALTER` via Neon, then `npx prisma generate`. After pulling schema on another machine, regenerate client.
- 2-space indentation being slightly off still validates.

## Working-Method Gotchas (painful to rediscover)
### PowerShell file writing
- **Always**: `[System.IO.File]::WriteAllText("$PWD\path", $content, (New-Object System.Text.UTF8Encoding $false))`.
  - `$PWD\` prefix is **mandatory**: .NET uses the process working dir (often stuck at `C:\WINDOWS\System32`), not PowerShell's `cd`. Bare relative paths throw "Could not find a part of the path â€¦ System32". `Test-Path` may say True while .NET still fails.
- `Set-Content`/`Out-File -Encoding UTF8` add a **BOM** â†’ Prisma schema (`P1012` on line 1) and JSON break. The `WriteAllText` + `UTF8Encoding $false` form is BOM-free.
- **Heredoc `@'...'@` (literal) vs `@"..."@` (expandable)**: `@'...'@` is safest for code, but `$variables`/backticks inside `@"..."@` get interpreted by PowerShell. For files with `'use client'` single quotes, the literal form is fine; some chats switched forms to dodge quote conflicts.
- **PowerShell heredoc corrupts Nepali â†’ `???`** â€” keep injected code/comments ENGLISH-ONLY; rewrite mangled `???`/`Ã°Å¸"`/`Ã Â¤â€¢Ã Â¥â€¹` strings in English. Emoji needs real unicode written via UTF-8, not escapes.
- **PROVEN 2026-06-03 (Alerts page, commit 50ea664):** emoji + Nepali UI text written via PowerShell heredoc got double-corrupted into mojibake (`gxlat sttor`, `aceâ€¦`, broken emoji) that even showed in production. Fix: keep ALL injected UI strings ASCII-only; for emoji/Nepali in React, use `\u{...}` escapes or type directly via `code <file>` (VS Code) - never heredoc. To detect leftover mojibake: `Select-String -Path <file> -Pattern "[^\x00-\x7F]"` (should be empty). Never type corrupt bytes back into a PowerShell string - the chars (e.g. acute accent) break the parser; use line-anchored replace on the ASCII part of the line instead.
- For an alternative reliable writer, the `node fix.cjs` pattern (JS array of lines â†’ `fs.writeFileSync`) also works.

### CRLF vs LF
- Multi-line `.Replace()` from an `@'...'@` heredoc (LF) **silently fails** on CRLF files. Prefer **single-line short unique replaces**; or use `-replace` regex with `(?s)` and `\r?\n`; confirm bytes with `Format-Hex` (`0A` LF vs `0D 0A` CRLF). Always `Select-String`-verify before `db push`/push.
- "LF will be replaced by CRLF" git warning is harmless.

### Path / shell quirks
- `Get-Content` treats `[id]` as a wildcard â†’ use `Get-Content -LiteralPath`, or open bracketed paths with `code <file>`. `.NET WriteAllText` handles `[...]` fine.
- New folders need `New-Item -ItemType Directory -Force` before writing into them.
- **`fetch('/api/...')` runs in the BROWSER CONSOLE on the `olkocms.vercel.app` tab ONLY.** On claude.ai it hits `https://claude.ai/api/...` (404) or even a Stripe override (403). Use `fetch(window.location.origin + '/api/...')` if unsure. `npm`/`git`/`Select-String`/`$c=` are **PowerShell only** â€” pasting one into the other = SyntaxError.
- Do NOT paste TypeScript directly into PowerShell (parse errors) â€” write via `WriteAllText` or `code <file>`.

### Git
- Order matters: `git add .` â†’ `git commit` â†’ `git push`. PowerShell uses `;` not `&&`.
- Token URLs with `@github.com` break PowerShell splatting â†’ wrap whole URL in quotes.
- `git push` rejected (fetch first) when GitHub changed elsewhere (e.g. schema edited in web UI) â†’ `git pull --rebase` then push.
- `git pull` lock: "Unlink of file '.git/objects/pack/...' failed (y/n)" â†’ answer `n` repeatedly, Fast-forward still completes; reboot clears the lock.
- `git filter-branch` needs a clean tree (commit first). Used to purge a leaked `.env` from history: `git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env"` + force push. `.env`/`.env.local` in `.gitignore`. **Rotate any key that ever hit git** (GitHub Push Protection GH013 blocks committed keys).
- Unrelated histories between machines: `git pull origin main --allow-unrelated-histories` then resolve.

### Next.js / Vercel build
- Routes reading `request.url`/searchParams need `export const dynamic = "force-dynamic";`.
- Do **NOT** set `export const runtime = "edge"` on routes using Prisma â€” edge breaks Prisma (needs Node runtime).
- `useSession()` needs a `'use client'` `SessionProvider` wrapper in `dashboard/layout.tsx`; server components use `getServerSession`.
- ESLint/TS errors block builds â†’ in `next.config.js`: `eslint:{ignoreDuringBuilds:true}`, `typescript:{ignoreBuildErrors:true}`.
- Wait for deploy **Ready** before testing a pushed route (else 404/stale); hard refresh Ctrl+Shift+R. If a pushed file 404s, `git commit --allow-empty -m "trigger redeploy"`.
- Local `npm run build` throws a harmless `PrismaClientInitializationError` with no local DB; production is fine because data routes are `force-dynamic`. Success line: `âœ“ Compiled successfully`.
- Next 14.2.x default `layout.tsx` Geist font import errors (`Unknown font 'Geist'`) â†’ remove font import.
- `globals.css`: keep plain `@tailwind base; @tailwind components; @tailwind utilities;` (shadcn init's `@import "tw-animate-css"`/`shadcn/tailwind.css` cause `border-border` errors).
- `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` to allow `npx`.

## Build / Verify cheatsheet
```powershell
# write a file (BOM-free)
[System.IO.File]::WriteAllText("$PWD\src\app\...\route.ts", $c, (New-Object System.Text.UTF8Encoding $false))
# verify substrings landed
Select-String -Path "$PWD\src\app\...\route.ts" -Pattern "..." | Select-Object LineNumber, Line
# build check
npm run build 2>&1 | Select-String -Pattern "Failed|Compiled successfully|error" | Select-Object -First 5
# ship
git add . ; git commit -m "..." ; git push
```
## Nepal-time (NPT) date filters - shared helper (added 2026-06-05)
- Vercel runs in UTC. NEVER compute calendar boundaries with raw `new Date(); setHours(0,0,0,0)` - at night that returns the WRONG day in Nepal (UTC+5:45).
- Use `src/lib/nepalTime.ts`: `nepalTodayStartUTC()` for "today" start, `nepalPeriodRange(period)` for today/yesterday/this_week/last_week/this_month/last_month/2_months_ago/3_months_ago/this_year/last_year. Both return real UTC instants computed on NPT wall-clock, safe to compare against stored UTC timestamps.
- Rolling windows (last-30-days purge, twoMonthsAgo lost cutoff, billing periods) are NPT-irrelevant - leave as plain Date math, do NOT route through the helper.
- VERIFY GOTCHA: when replacing `setHours(0,0,0,0)` with the helper, confirm the USE line changed, not just the import - a heredoc/CRLF mismatch can land the import while leaving the old UTC line, so the bug ships silently. Always Select-String the actual usage.

## Reusable UI: ZoomableImage (added 2026-06-05)
- `src/components/ZoomableImage.tsx` - `<ZoomableImage src={url} className="..." />`. Click -> full-screen overlay (z-[70]), click overlay -> close. stopPropagation so it works inside other click-through popups.
- Use for ANY product-image display (already in OrderDetailPopup + alerts popup) to get click-to-expand for free.

## Nepal-time (NPT) date filters - shared helper (added 2026-06-05)
- Vercel runs in UTC. NEVER compute calendar boundaries with raw `new Date(); setHours(0,0,0,0)` - at night that returns the WRONG day in Nepal (UTC+5:45).
- Use `src/lib/nepalTime.ts`: `nepalTodayStartUTC()` for "today" start, `nepalPeriodRange(period)` for today/yesterday/this_week/last_week/this_month/last_month/2_months_ago/3_months_ago/this_year/last_year. Both return real UTC instants computed on NPT wall-clock, safe to compare against stored UTC timestamps.
- Rolling windows (last-30-days purge, twoMonthsAgo lost cutoff, billing periods) are NPT-irrelevant - leave as plain Date math, do NOT route through the helper.
- VERIFY GOTCHA: when replacing `setHours(0,0,0,0)` with the helper, confirm the USE line changed, not just the import - a heredoc/CRLF mismatch can land the import while leaving the old UTC line, so the bug ships silently. Always Select-String the actual usage.

## Reusable UI: ZoomableImage (added 2026-06-05)
- `src/components/ZoomableImage.tsx` - `<ZoomableImage src={url} className="..." />`. Click -> full-screen overlay (z-[70]), click overlay -> close. stopPropagation so it works inside other click-through popups.
- Use for ANY product-image display (already in OrderDetailPopup + alerts popup) to get click-to-expand for free.

## Nepal-time (NPT) date filters - shared helper (added 2026-06-05)
- Vercel runs in UTC. NEVER compute calendar boundaries with raw `new Date(); setHours(0,0,0,0)` - at night that returns the WRONG day in Nepal (UTC+5:45).
- Use `src/lib/nepalTime.ts`: `nepalTodayStartUTC()` for "today" start, `nepalPeriodRange(period)` for today/yesterday/this_week/last_week/this_month/last_month/2_months_ago/3_months_ago/this_year/last_year. Both return real UTC instants computed on NPT wall-clock, safe to compare against stored UTC timestamps.
- Rolling windows (last-30-days purge, twoMonthsAgo lost cutoff, billing periods) are NPT-irrelevant - leave as plain Date math, do NOT route through the helper.
- VERIFY GOTCHA: when replacing `setHours(0,0,0,0)` with the helper, confirm the USE line changed, not just the import - a heredoc/CRLF mismatch can land the import while leaving the old UTC line, so the bug ships silently. Always Select-String the actual usage.

## Reusable UI: ZoomableImage (added 2026-06-05)
- `src/components/ZoomableImage.tsx` - `<ZoomableImage src={url} className="..." />`. Click -> full-screen overlay (z-[70]), click overlay -> close. stopPropagation so it works inside other click-through popups.
- Use for ANY product-image display (already in OrderDetailPopup + alerts popup) to get click-to-expand for free.
