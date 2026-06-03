# OlkoCMS — Auth Findings

NextAuth credentials auth, single config, bcrypt, and password-change auto-logout. (Infra/env in PROJECT_SETUP; webhook in WEBHOOK_AI.)

## Config — single source of truth
- **All auth config lives in `src/lib/auth.ts`** and exports `authOptions`. Everything imports from there.
- `src/app/api/auth/[...nextauth]/route.ts` must be only:
  ```ts
  import NextAuth from "next-auth";
  import { authOptions } from "@/lib/auth";
  const handler = NextAuth(authOptions);
  export { handler as GET, handler as POST };
  ```
- Provider: `CredentialsProvider` (email + password). Session strategy: **`jwt`**. Sign-in page `/login`. `NEXTAUTH_SECRET=olkocms-secret-key-2024`.
- `src/app/page.tsx` redirects `/` → `/login`. `src/middleware.ts` protects `/dashboard/:path*` (and must NOT block `/api/webhook/facebook`).

### `authorize` logic
- Checks **User table first, then Staff**. `bcrypt.compare(password, hash)`. Legacy plaintext auto-upgrades to bcrypt on successful login. Staff with `status === "Inactive"` blocked.
- Returns `accountType` ("user"|"staff") and `pwChangedAt` (= `passwordChangedAt.getTime()` or 0).
- `jwt` callback stores `id, role, subscriptionId, permissions, accountType, pwChangedAt`.

## Password-change auto-logout (all devices)
- Schema: `User.passwordChangedAt DateTime?` and `Staff.passwordChangedAt DateTime?`.
- Every password write sets `passwordChangedAt: new Date()` alongside the new bcrypt hash: `/api/staff/change-password`, `/api/staff` (PATCH), `/api/staff/emergency-reset`, and self-serve `src/app/dashboard/settings/password/page.tsx` (which then `signOut` the changer after ~1.8s).
- `session` callback compares DB `passwordChangedAt` vs token `pwChangedAt`; if `dbTime > tokenTime` it sets `(session as any).expired = true`.
- `src/components/SessionGuard.tsx` (client, mounted inside `<SessionProvider>` in `dashboard/layout.tsx`): if `session.expired` → `signOut({ callbackUrl: "/login" })`.
- **CRITICAL**: returning `null` from the session callback does NOT log out — it throws `CLIENT_FETCH_ERROR: Cannot convert undefined or null to object`. Use the `expired` flag + client `signOut()` instead.
- Accounts whose password was changed *before* the field existed have `passwordChangedAt = null` → no auto-logout until next change. Expected.

## Gotchas
- **Duplicate auth config bug**: `[...nextauth]/route.ts` once had its OWN inline `authOptions` while `lib/auth.ts` had another — the route's inline one actually ran, so edits to `lib/auth.ts` did nothing (auto-logout silently failed). Fix: unify into `lib/auth.ts`, route imports it.
- After unifying, `dashboard/layout.tsx` importing `authOptions` from the old route path → build error `'authOptions' is not exported`. Import from `@/lib/auth`.
- Login failures were often the route querying `prisma.staff` vs `prisma.user`, not hash format. `$2a$` and `$2b$` bcrypt prefixes are both fine.
- Use **bcryptjs** (not native bcrypt) — TS-friendly; `@types/bcryptjs` as devDependency.
- Plain-text seeded passwords fail login; fix via Neon SQL: `UPDATE "Staff" SET password='<bcrypt_hash>' WHERE email='admin@olkocms.com';`.
- Staff card may show a secondary display email; the real login is the `email` field from `/api/staff` (e.g. `dropray2080@gmail.com`, not a shown `dropati@olkocms.com`).

## Schema — Staff (Neon)
`id` (text, not int), `name`, `email`, `phone?`, `role`, `status`, `password?`, `joinDate?`, `passwordChangedAt?`, `createdAt`, `updatedAt`. Roles: `Admin`/`Manager`/`Sales`. Status: `Active`/`Inactive`.
- Known admin id: `cmpf2pxe30000wb63sdqffsrw`.

## Credentials (note the drift across phases)
- `admin@olkocms.com` — password seen as `admin123` (early phases) and `password123` (later). Known `admin123` bcrypt: `$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi`.
- Phase 1 staff: `suman@olkocms.com` / `priya@olkocms.com` = `staff123`.

## Pending
- 2FA on new-browser login — deferred. Options weighed: (A) fresh plain Gmail + nodemailer SMTP, (B) Resend (free 3000/mo, needs domain), (C) TOTP authenticator (most secure, no email/SMS). Gmail App Password was unavailable (managed/workspace account). Pick later.
