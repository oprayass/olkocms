# OlkoCMS — CMS Core Findings

The social-commerce CMS (everything except Daraz and the webhook/AI internals): Dashboard, Orders, Messages, Products, Staff/RBAC, Followups, Courier, Reports, Content, Subscriptions/Billing, Ad-campaign P&L, SMS/WhatsApp. Merged from Phase 1 + Full Build + Ad/P&L chats.

## Schema (Prisma → Neon)

### Core models
- **User**: `id, name, email(unique), password, role(default "staff"), passwordChangedAt?`, relations orders/messages.
- **Staff**: see AUTH. Has **15 RBAC boolean flags**: `canViewDashboard, canViewOrders, canConfirmOrders, canViewMessages, canReplyMessages, canViewStaff, canManageStaff, canViewCourier, canManageCourier, canViewReports, canViewPnL, canCreateContent, canPostContent, canViewSettings, canManageDaraz`.
- **Order**: `id, orderId(unique), customerName, phone, address, product, quantity, price, status(default "Pending"), courier, trackingNo, platform, staffId`,
  plus flags/fields added over time: `isSameDay, isCancelledAtDoor, isExchange, isFailedDelivery` (all Bool default false), `darazOrderId?, darazStatus?, darazPlatform?`, `pageId?, pageName?`, `campaignId?, adId?, costPrice?, shippingCharge?(courier pays), customerShippingCharge?(customer pays)`.
- **Message**: `id, platform, senderId, senderName, pageId?, message, timestamp, status, isFromUs, aiReplied, replied, replyText?, staffId?, createdAt`. (Early schema used `customerId/customerName/content`; replaced.)
- **Followup**: `id, customerName, phone, platform, lastMsg, followupDate, status(default "Upcoming"), notes`.
- **Shipment**: `id, orderId, customer, phone, product, courier, tracking, status(default "Pending Pickup"), charge, estimated`.
- **Product**: `id, name, description, price, salePrice?, stock, images?, videoUrl?, features?, usage?, implications?, category?, weightKg(default 0), costPrice?, status(default "Active")`.
- **AIConversation**: `id, senderId, pageId, platform, messages(JSON string), stage(default "greeting"), orderData?(JSON), productId?, campaignId?, resolved(default false)`. (See AI_SALES_AGENT.)
- **ActivityLog**: `id, action, description, entityType?, entityId?, performedBy, staffName?, isAI(default false), metadata?(JSON), createdAt`. Actions: `ai_reply_generated, ai_reply_sent, human_reply_sent, order_confirm, human_handoff_needed`.

### Billing models
- **Plan**: `id, name, priceMonthly, priceYearly, maxPages(1), maxStaff(2), aiReply(true), darazAccess(false), reportsAccess(false), isActive(true)`.
- **Subscription**: `id, businessName, email(unique), phone?, planId, status(default "Trial"), billingCycle(default "monthly"), trialEndsAt, currentPeriodEnd, pagesConnected, staffCount, notes?`.
- **Payment**: `id, subscriptionId, amount, method, status(default "Pending"), reference?, paidAt?, periodStart, periodEnd`.

### Ad models
- **AdCampaign**: `id, name, platform(default "facebook"), adId?, productId?, budget(0), spent(0 — auto-incremented by expense API), status(default "Active")`, relations expenses/orders.
- **AdExpense**: `campaignId, type('Daily Ad Spend'|'Boost Post'|'Influencer'|'Other'), amount, description?, date`.
- **AdOrder**: `adId?, customerShippingCharge(0), costPrice(0), salePrice(0), isFailedDelivery(false)`.

### Migration history (mostly `db push`; some SQL ALTER via Neon)
`init`(User/Order/Message) → `add_all_tables`(Followup/Shipment/Staff, Order.orderId unique) → `add-rbac-content-pnl-daraz`(Staff perms, Content, Transaction, DarazStore, DarazOrder, AdCampaign/AdExpense/AdOrder) → `add-activity-log` → `add-products-ads-ai-conversations` → `add-product-weight` → order flag fields → subscription model → ad fields (`add-ad-fields.sql` adds campaignId/adId/costPrice/shipping/customerShipping/isFailedDelivery to Order+AdOrder, costPrice to Product).

## API Routes (non-Daraz, non-webhook)
| Route | Methods | Notes |
|-------|---------|-------|
| `/api/dashboard` | GET | todayOrders, pendingOrders, newMessages, revenueToday, todayDelivered, todayCancelledAtDoor, todayExchange, todayAdSpent, bestAd, worstAd |
| `/api/orders` `/api/orders/[id]` | GET/POST, PATCH/DELETE | flag toggles; PATCH→Confirmed fires SMS |
| `/api/messages` `/[id]` `/handoff` `/customer` | GET/POST, PATCH/DELETE, POST, GET | `customer?senderId=` or `?phone=` |
| `/api/products` `/[id]` | GET/POST, GET/PATCH/DELETE | |
| `/api/staff` `/[id]` `/change-password` `/emergency-reset` | full CRUD | default role perms on create |
| `/api/followups` `/[id]` | GET/POST, PATCH/DELETE | |
| `/api/activity` | GET(`?limit=N`)/POST | |
| `/api/courier` | GET/POST/PATCH | PATCH body `{ id, ...data }` — no `[id]` route |
| `/api/reports` | GET | totals, deliveryRate, avgOrderValue, platformStats, orders[] |
| `/api/plans` | GET | active, by priceMonthly asc |
| `/api/subscriptions` `/[id]` | GET/POST, GET/PATCH/DELETE | DELETE = status Cancelled (soft) |
| `/api/payments` | POST | sets sub Active, extends currentPeriodEnd |
| `/api/content` `/[id]` | GET/POST, PATCH/DELETE | |
| `/api/ad-campaigns` `/[id]` `/expense` | GET/POST, PATCH/DELETE, POST | expense also increments `spent` |
| `/api/cron/expire-subscriptions` | GET | needs `Authorization: Bearer <CRON_SECRET>`; 401 from browser is correct |
| `/api/sms/confirm` | POST | Sparrow SMS (below) |

## Business Rules
### Orders
- Statuses: `Pending → Confirmed → Processing → Delivered | Cancelled`.
- Flags: `isSameDay` (KTM same-day), `isCancelledAtDoor` (delivered-but-refused), `isFailedDelivery` (courier couldn't deliver), `isExchange`. **Failed Delivery and Cancelled-at-Door are treated as ONE thing in the social-Orders UI** (merged "Failed / Door" card+filter+checkbox), though stored as two columns.
- Filters: All/Pending/Confirmed/Processing/Delivered/Cancelled/SameDay/Exchange/FailedDoor.
- **Daraz orders MUST NOT be mixed with social orders** — reports stay fully separate; a combined report is Admin-only.

### SMS / WhatsApp / Call (Orders page Customer column)
- **Call** = `tel:` link (Twilio rejected — Nepal outbound ~$0.25/min; NTC SIP PBX rejected — needs fiber; cloud PBX EkGhanti/VoxCrow/GetDesk noted for future single-number outbound).
- **WhatsApp** = `wa.me` deep link (Business API needs Meta review): `https://wa.me/977{number-WITHOUT-leading-0}?text={encodeURIComponent(...)}`. Leading `0` silently breaks open on some Android builds.
- **SMS** via Sparrow (`POST https://api.sparrowsms.com/v2/sms/`, body `{token, from:"Demo", to, text}`, success = `response_code===200`). Fires only when status → **Confirmed**. `/api/sms/confirm` normalizes phone to `977` prefix; if `SPARROW_SMS_TOKEN` unset returns `{success:false}` with HTTP 200 so the order flow never breaks.
- Company name in SMS/WhatsApp is **dynamic from the originating FB page**: `PAGE_NAMES` map `344520078737283→Nepali Babu`, `296064883592821→PINK ME` (why `Order.pageId/pageName` were added; `campaignId` doesn't identify the page).

### Dashboard ad stats / P&L
- `bestAd`/`worstAd` = highest/lowest ROAS among Active campaigns; `todayAdSpent` = today's AdExpense sum.
- `Net Profit = Revenue(Delivered) − ProductCost − CourierShipping + CustomerShipping − AdSpent`; `Gross = Revenue − ProductCost`; `Margin = Net/Revenue*100`; `ROAS = Revenue/AdSpent`.
- Campaign P&L counts only `status==='Delivered'`. `Order.campaignId` is an FK to AdCampaign; `Order.adId` is a plain FB Ad ID string. `AdCampaign.spent` is tracked via the expense API (not derived from orders) so spend can be logged before orders arrive. Both failed/door count as loss (shipping lost).

### Subscriptions
- **Trial = 1 day** (`trialEndsAt = now+1d`), not 14. Plans: Starter Rs 999/mo (9999/yr), Growth Rs 2499 (24999), Pro Rs 4999 (49999). Pay methods: eSewa/Khalti/Bank/Cash. Payment → status Active + extend `currentPeriodEnd` (+1mo or +1yr). DELETE = soft (Cancelled). Cron expires Trial when `trialEndsAt<now` and Active when `currentPeriodEnd<now`.
- **Multi-tenant RBAC (planned)**: each subscription owner sees only their own rows by default; their staff get access per `Staff.can*` flags. Schema in place; queries/middleware need to honor it.

### Content
- Platforms facebook/instagram/tiktok; statuses draft/scheduled/posted. AI generator uses `/api/ai-reply` with custom systemPrompt. "Mark as Posted" → status posted + postedAt. Copy-to-clipboard.

### Followups / Courier / Platform codes
- Followup status: Overdue (`<today`), Today, Upcoming (`>today`), Done. Couriers: Nepal Can Move, Upaya, Fab Bud, Delivery Sansar. Platform codes FB/IG/WA.

### Default role permissions (on staff create)
- Sales: ViewDashboard, ViewOrders, ConfirmOrders, ViewMessages, ReplyMessages, ViewCourier, CreateContent.
- Support: ViewDashboard, ViewMessages, ReplyMessages.
- Manager: all except ViewPnL, ViewSettings. Admin: all.

## Key files
- Pages under `src/app/dashboard/`: `page.tsx, orders, messages, products, staff, followups, courier, reports, content, subscriptions, ads, settings, activity`. Public: `pricing`, `privacy`, `data-deletion`. Auth: `login`.
- Components `src/components/dashboard/`: `Sidebar.tsx` (uses lucide-react icons — replaced broken emoji), `StatsCards.tsx`, `RecentOrders.tsx`, `RecentMessages.tsx`. `src/components/SessionProvider.tsx` ('use client'). `src/components/SessionGuard.tsx` (auto-logout).
- `vercel.json` cron config. Plans seeded via `node seed-plans.cjs`. Courier PATCH uses `{id,...data}`. Messages handoff uses `prisma.aIConversation.updateMany`.

## Decisions
- Mock data for Courier/Reports in Phase 1, wired to real DB later. JWT sessions. Twilio/NTC-PBX rejected (above). Daraz/NCM/IG/WA deferred to their own tracks.

## Pending
- Ad campaign management UI (create/edit). Subscription auto-expire verified via cron. WhatsApp number in pricing CTA. Combined Admin-only report gated by `role==='admin'` OR (`canViewReports && canViewPnL`). Wire IG/WA after Meta approval. Daraz CSV import as a stopgap (superseded — Daraz API now works; see DARAZ_API).

## Messages page platform filter fix (2026-06-07)
- File: src/app/dashboard/messages/page.tsx. Filter tabs are labeled All/Facebook/IG/WA but DB platform strings are facebook/instagram/whatsapp.
- BUG: old filter did t.platform === filter.toLowerCase() || t.platform === filter -> "WA"->"wa" != "whatsapp", "IG"->"ig" != "instagram". WA/IG tabs showed "No messages yet". Facebook worked only by coincidence ("Facebook"->"facebook").
- FIX: added filterToPlatform map { Facebook:"facebook", IG:"instagram", WA:"whatsapp" }; filter now: filter === "All" || t.platform === filterToPlatform[filter].
- Also platformStyle/platformLabel maps only had FB/IG/WA keys -> whatsapp/instagram threads got gray avatar + blank header label. Added lowercase keys facebook/instagram/whatsapp to both maps (kept old keys for back-compat). WA avatar now emerald, label "WhatsApp".
- Verified 2026-06-07: WA tab shows the whatsapp thread with green avatar + correct label. Commit d0dfe58.