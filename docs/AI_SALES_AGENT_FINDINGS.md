# OlkoCMS — AI Sales Agent Findings

The autonomous FB Messenger sales agent (runs inside the webhook POST handler). Webhook/model mechanics are in WEBHOOK_AI.

## Conversation flow (`AIConversation.stage`)
`greeting → product_info → bargaining → collecting_order → phone_verify → confirmed`
1. **greeting** — understand need, suggest product.
2. **product_info** — benefits, price, ask interest.
3. **bargaining** — hold price firm, max 3 attempts.
4. **collecting_order** — naam, phone, address.
5. **phone_verify** — tell customer an agent will call before shipping ("हामी courier मा पठाउनु अघि एक पटक phone गर्नेछौं"); order proceeds only after the call.
6. **confirmed** — full order summary.
- History stored as a JSON string in `AIConversation.messages`; looked up by `findFirst({ where:{ senderId, pageId, resolved:false } })`.

## Bargaining
- 1st ask: explain value. 2nd: "yo nai final price ho". 3rd: collect info → emit `[NEEDS_HUMAN]` → create a Pending order → Activity log.
- Discount: **max 5% only after the 3rd attempt**; never free delivery as the discount (protect margin). No discount until the flow is exhausted.

## `[NEEDS_HUMAN]` handoff
- Triggers: 3 failed bargaining attempts, angry customer, or a question the AI can't answer.
- Effect: create Pending order + Activity log `human_handoff_needed`.
- Manual side (Messages page): a Human-Handoff button (shows when `aiReplied===true` and not yet handed off) POSTs `/api/messages/handoff {senderId,pageId,staffName}` → sets `AIConversation.resolved=true` (AI stops auto-replying) → green "Human Mode" banner.

## Delivery charges (weight-based)
- ≤2kg: Valley Rs 100 / Outside Rs 150. 2–4kg Rs 250. 4–7kg Rs 500. >7kg Rs 100/kg.
- Branch pickup Rs 650 flat (any weight). Remote (Humla/Jumla etc.): courier can't reach → branch pickup only.
- Driven by `Product.weightKg` (Float, default 0).

## Same-day delivery
- Keywords: `aaja, today, ahile, turant, urgent, आज, अहिले`.
- Kathmandu Valley only, on-demand bike (InDrive/Yango), **charge confirmed by phone** (not fixed). Outside Valley → next day / 2 days.
- Creates a Pending order with `SAMEDAY-` prefix orderId (Orders UI should badge these).

## Language rules
- Nepali words → Devanagari; English words/digits/brands → English; match the customer's exact language (Roman Nepali → Roman reply).
- **Never** use bhai/bahini/didi/dai/ta/timi/timro. Male → "Sir", Female → "Madam", unknown → "hajur".

## Anti-hallucination
- Only mention features/warranty explicitly in the `Product` description. If warranty isn't in DB, don't mention it. Product context carries an explicit "only mention features listed above" note.
- **Product alias map** expands Nepali terms before matching, e.g. `dari/daari/dhari → beard trimmer shaver`, `kapal → hair trimmer clipper`, `khur → shaver razor trimmer`.

## Decisions
- Model `claude-sonnet-4-5` (see WEBHOOK_AI). Delivery = manual rate card (no NCM/Upaya public API). Same-day = bike + phone confirm. Messages displayed threaded by `senderId`.

## Pending
- Verify `AIConversation` history persists correctly across messages in production. Orders page `SAMEDAY-` badge. Full same-day end-to-end test (blocked on real FB messages → app publish).
