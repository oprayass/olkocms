# OlkoCMS — Meta Webhook & Claude AI Findings

Facebook/Meta webhook + Anthropic Claude API. (The autonomous sales agent built on top is in AI_SALES_AGENT.)

## Anthropic Claude API
- Endpoint `https://api.anthropic.com/v1/messages`; SDK `@anthropic-ai/sdk`; header `anthropic-version: 2023-06-01`; auth `ANTHROPIC_API_KEY`.
- **Working model: `claude-sonnet-4-5`.** `claude-sonnet-4-20250514` → **404** (wrong name). Haiku (`claude-haiku-4-5-20251001`) tested but Nepali quality insufficient.
- Wrong model name → AI silently falls back to "hajur k help garna sakxu?".
- `max_tokens`: ~400 (simple reply), ~600 (sales agent), 1024 (general). System prompt via `system` field, NOT in `messages[]`.
- Response: `data.content[0].text` (check `type === 'text'`).

## Meta / Facebook Webhook
- App name `olkocms`, **App ID `2229305921144083`**. Product = **Page** (not Catalog), use case "Manage everything on your Page". Own-pages = Business app, **NOT Tech Provider** (no extra verification for own pages).
- Graph API **v25.0**.
- **Verify token: `olkocms2024`** (simplified). Earlier `olkocms_webhook_2024` worked in PowerShell tests but Meta "Verify and save" failed (special chars suspected). Route has a **hardcoded fallback** so env mismatch can't break verify:
  ```ts
  if (mode === 'subscribe' &&
      (token === process.env.WEBHOOK_VERIFY_TOKEN || token === 'olkocms2024'))
    return new Response(challenge ?? '', { status: 200 });
  return new Response('Forbidden', { status: 403 });
  ```
- **App is Unpublished** → only **test webhooks** (dashboard / PowerShell POST) work; real message POSTs won't arrive until published / Business-Verified. Don't chase webhook-POST silence as a bug until publish state is fixed. Business Verification takes 3-5 business days.
- Graph user-info `GET /v18.0/{senderId}?fields=name` → **400** while app unpublished (can't fetch name/photo).
- Subscribe a page: `POST https://graph.facebook.com/v25.0/{PAGE_ID}/subscribed_apps?subscribed_fields=messages,feed,mention&access_token={PAGE_TOKEN}` (use `Invoke-RestMethod` in PowerShell; curl is awkward).
- Page tokens: `GET https://graph.facebook.com/v25.0/me/accounts` with a User token (scopes: pages_show_list, pages_messaging, pages_read_engagement, pages_manage_metadata).
- Pages connected: नेपाली बाबु `344520078737283`, PINK ME `296064883592821`. Gadgets Finder is under a separate Business Portfolio → needs its own system-user token. Portfolios: Raibaar, Raibaar Infotel (`126383855596312`), Gadgets Finder.

## Routes
- `src/app/api/webhook/facebook/route.ts`
  - **GET** = verify (above). **POST** = receive events; iterate `body.entry[].messaging[]` → insert `Message` (`platform:'facebook'`, `senderId`, `senderName`, `pageId`, `message`, `timestamp`, `status:'new'`). Fallback: `entry.changes[]` where `change.field === 'feed'`.
  - Must NOT be `runtime="edge"` (Prisma needs Node). Middleware must exclude this path from auth.
  - Test payload's `entry.messaging` shape differs from real webhooks.
- `src/app/api/ai-reply/route.ts` — POST `{ customerMessage|customerMessage, customerName, orderDetails? }` → `{ reply }`. Used by Messages page "Generate AI Reply" and Content generator (custom systemPrompt).
- `src/app/api/messages/route.ts` GET (desc) / POST. `src/app/api/messages/[id]/route.ts` PATCH (`replied`, `replyText`, `status:'replied'`).

## ngrok (local webhook dev)
- Needs ngrok ≥ 3.20 (winget's 3.3.1 too old) — drop a fresh `ngrok.exe` into the WinGet package folder. Auth token at `C:\Users\Prayash\AppData\Local\ngrok\ngrok.yml` (account `oprayass`, free).
- Run `npm run dev` AND `ngrok http 3000` in separate windows. Free URL changes each restart (e.g. `https://implosion-expulsion-eats.ngrok-free.dev/api/webhook/facebook`) → Vercel gives a permanent URL.

## Test commands (PowerShell)
```powershell
# Verify (returns the challenge)
Invoke-WebRequest -Uri "https://olkocms.vercel.app/api/webhook/facebook?hub.mode=subscribe&hub.verify_token=olkocms2024&hub.challenge=test123" -UseBasicParsing | Select-Object -ExpandProperty Content
# Fake inbound message
$body = '{"object":"page","entry":[{"id":"344520078737283","messaging":[{"sender":{"id":"7617558408330955"},"recipient":{"id":"344520078737283"},"timestamp":1234567890,"message":{"mid":"mid.test","text":"TEST"}}]}]}'
Invoke-WebRequest -Uri "https://olkocms.vercel.app/api/webhook/facebook" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing | Select-Object -ExpandProperty Content
```
Confirmed: message persists with platform `facebook`, given senderId/pageId, status `new`; PATCH flips `replied=true`/`status=replied`.

## Meta-required pages
- Privacy `https://olkocms.vercel.app/privacy`, Data Deletion `https://olkocms.vercel.app/data-deletion` (both built). Domain verification: business.facebook.com → Brand Safety → Domains → add `olkocms.vercel.app` → meta tag in `layout.tsx`.

## Pending
- Publish app / finish Business Verification → unblocks real POSTs and Instagram/WhatsApp (same webhook pattern). Subscribe `feed`+`mention`. WhatsApp needs a Business number. Rotate any API key ever committed.

## WhatsApp Cloud API integration (2026-06-07)
- Same route handles FB + WhatsApp: src/app/api/webhook/facebook/route.ts. WhatsApp Cloud API is the only path now (on-premise API ended Oct 2025).
- POST: WhatsApp payload differs from Messenger. object === "whatsapp_business_account" -> entry[].changes[] where change.field === "messages" -> change.value.messages[]. Each msg: msg.from (sender wa_id), msg.text?.body, msg.type, msg.timestamp. Sender name from change.value.contacts[0].profile.name. phone_number_id from change.value.metadata.phone_number_id (used BOTH as pageId and as send target).
- GOTCHA: WhatsApp msg.timestamp is Unix SECONDS as a string -> new Date(parseInt(msg.timestamp) * 1000). FB event.timestamp is already ms.
- Stored as Message platform:"whatsapp", senderId=msg.from, pageId=phone_number_id. AIConversation lookup reuses senderId+pageId, so the existing sales agent works unchanged (called with platform "whatsapp").
- Send: new fn sendWhatsAppMessage(phoneNumberId, to, text). POST https://graph.facebook.com/v21.0/{phone_number_id}/messages, header Authorization: Bearer {WHATSAPP_TOKEN}, body { messaging_product:"whatsapp", to, type:"text", text:{ body } }. Different from FB send (FB uses page token in query + recipient/message shape).
- ENV: WHATSAPP_TOKEN on Vercel. Test phase = temporary token from App Dashboard > WhatsApp > API Setup; prod = permanent System User token.
- GET verify unchanged (token olkocms2024) - WhatsApp uses the same verification.
- Non-text WA msgs stored as "[media]" and routed through AI (no special voice handling like FB). reaction/system types skipped.
- Dashboard side still needed for real msgs: add WhatsApp product, Configuration > Webhook callback https://olkocms.vercel.app/api/webhook/facebook + verify olkocms2024 + subscribe field "messages". Real number/production blocked on Business Verification (same gate as FB/IG). Test number works while unpublished.
- Meta app use case "Connect with customers through WhatsApp" already configured (green check). App ID 2229305921144083.
- Verified 2026-06-07: fake WA POST -> EVENT_RECEIVED, message saved with platform whatsapp, AI replied. Commit 4a6774b.