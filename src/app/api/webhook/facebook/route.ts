import { prisma } from '@/lib/prisma'

const NEPALI_BABU_TOKEN = process.env.NEPALI_BABU_PAGE_TOKEN
const PINK_ME_TOKEN = process.env.PINK_ME_PAGE_TOKEN
const NEPALI_BABU_PAGE_ID = process.env.NEPALI_BABU_PAGE_ID
const PINK_ME_PAGE_ID = process.env.PINK_ME_PAGE_ID

async function getPageToken(pageId: string): Promise<string | null> {
  if (pageId === NEPALI_BABU_PAGE_ID) return NEPALI_BABU_TOKEN || null
  if (pageId === PINK_ME_PAGE_ID) return PINK_ME_TOKEN || null
  return null
}

async function getFacebookUserName(senderId: string, pageToken: string): Promise<string> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${senderId}?fields=name&access_token=${pageToken}`
    )
    const data = await res.json()
    return data.name || senderId
  } catch {
    return senderId
  }
}

async function sendTypingIndicator(pageToken: string, recipientId: string) {
  try {
    await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${pageToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        sender_action: 'typing_on'
      })
    })
  } catch {}
}

async function sendFacebookMessage(pageToken: string, recipientId: string, text: string) {
  try {
    await sendTypingIndicator(pageToken, recipientId)
    const typingDelay = Math.min(Math.max(text.length * 25, 2000), 5000)
    await new Promise(resolve => setTimeout(resolve, typingDelay))
    await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${pageToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text }
      })
    })
  } catch (err) {
    console.error('Send message error:', err)
  }
}

const productAliases: Record<string, string> = {
  'dari': 'beard trimmer shaver',
  'daari': 'beard trimmer shaver',
  'dhari': 'beard trimmer shaver',
  'jhunga': 'beard trimmer shaver',
  'khur': 'shaver razor trimmer',
  'kaatnae': 'cutting trimmer clipper',
  'kaatne': 'cutting trimmer clipper',
  'kapal': 'hair trimmer clipper',
  'projector': 'projector screen display',
  'trimmer': 'trimmer hair beard clipper',
  'machine': 'machine device gadget',
  'light': 'light lamp bulb LED',
  'fan': 'fan cooler air',
  'camera': 'camera CCTV security',
  'speaker': 'speaker sound bluetooth',
  'earphone': 'earphone headphone earbud',
  'charger': 'charger adapter cable',
  'watch': 'watch smartwatch band',
  'bag': 'bag backpack purse',
}

function calculateDeliveryCharge(weightKg: number, isHomeDelivery: boolean): number {
  if (!isHomeDelivery) return 650 // branch pickup
  if (weightKg <= 2) return 150
  if (weightKg <= 4) return 250
  if (weightKg <= 7) return 500
  return Math.round(weightKg * 100)
}

function expandMessage(message: string): string {
  const words = message.toLowerCase().split(/\s+/)
  return words.map(word => {
    const alias = productAliases[word]
    return alias ? `${word} ${alias}` : word
  }).join(' ')
}

// Detect if customer seems to be leaving/disinterested
function isConversationEnding(message: string): boolean {
  const lower = message.toLowerCase()
  const endingSignals = [
    'ok', 'okay', 'thik xa', 'sochxu', 'pachi', 'later', 'bye', 'thanks',
    'dhanyabad', 'nai parcha', 'naparcha', 'xaina', 'hudaina', 'no thanks',
    'nope', 'chhodo', 'chhadnu', 'janxu', 'gaye', 'afu nai hernxu'
  ]
  return endingSignals.some(signal => lower.includes(signal)) && message.length < 30
}

async function generateAIReply(
  senderId: string,
  pageId: string,
  customerMessage: string,
  platform: string,
  senderName: string
): Promise<string> {
  let conversation = await prisma.aIConversation.findFirst({
    where: { senderId, pageId, resolved: false },
    orderBy: { createdAt: 'desc' }
  })

  const history = conversation ? JSON.parse(conversation.messages) : []
  const orderData = conversation?.orderData ? JSON.parse(conversation.orderData) : {}
  const stage = conversation?.stage || 'greeting'

  // Check if conversation seems to be ending
  if (isConversationEnding(customerMessage) && stage !== 'collecting_order' && stage !== 'confirmed') {
    const endingReply = `ठीक छ, कुनै प्रश्न भए फेरि सम्पर्क गर्नुहोला। धन्यवाद!`
    
    history.push({ role: 'user', content: customerMessage })
    history.push({ role: 'assistant', content: endingReply })
    
    if (conversation) {
      await prisma.aIConversation.update({
        where: { id: conversation.id },
        data: { messages: JSON.stringify(history), resolved: true }
      })
    }
    return endingReply
  }

  const products = await prisma.product.findMany({
    where: { status: 'Active' },
    take: 30
  })

  const productContext = products.length > 0
    ? products.map(p =>
        `• ${p.name} — Rs ${p.price}${p.salePrice ? ` (Sale: Rs ${p.salePrice})` : ''} | Weight: ${(p as any).weightKg || 0}kg
  Description: ${p.description || 'N/A'}
  Features: ${p.features || 'N/A'}
  Usage: ${p.usage || 'N/A'}
  Category: ${p.category || 'General'}`
      ).join('\n\n')
    : 'No specific products listed.'

  const expandedMessage = expandMessage(customerMessage)

  history.push({
    role: 'user',
    content: customerMessage === expandedMessage
      ? customerMessage
      : `${customerMessage}\n[Context: ${expandedMessage}]`
  })

  const systemPrompt = `तिमी एक real Nepali sales person हौ जसले Facebook Messenger मा customer सँग कुरा गर्छ। तिमी AI होइनौ — real human जस्तो गर्नू।

Customer Name: ${senderName}

PRODUCTS:
${productContext}

CONVERSATION STAGE: ${stage}
ORDER INFO: ${JSON.stringify(orderData)}

LANGUAGE RULES (MOST IMPORTANT):
- Nepali words: देवनागरी script मा लेख्नू (राम्रो, छ, हुन्छ, गर्नुस्)
- English words, digits, product names: English मा राख्नू (Rs 1100, VGR V-071, 180 minutes)
- Mixed naturally: "यो product को price Rs 1100 छ, quality ekdam राम्रो छ"
- If customer writes in Roman Nepali (hajur, xa, xaina): reply in Roman Nepali too
- If customer writes in English: reply in English
- Super flexible — match customer's language exactly
- Customer can't read Nepali script → switch to Roman/English immediately

ADDRESS RULES (NEVER BREAK):
- NEVER say "bhai", "bahini", "didi", "dai" — EVER
- Male customer → "Sir"
- Female customer → "Madam"  
- Unknown gender → "hajur" only
- NEVER use "ta", "timi", "timro" — always polite form
- New friend tone: warm but respectful, like meeting someone at a shop for first time

CONVERSATION INTELLIGENCE:
- Read the ENTIRE message — give ONE reply to whole message
- Track conversation history — never repeat same info
- If customer seems disinterested (short replies, "ok", "sochxu"): gently ask if they have questions, don't push
- If customer asks same question twice: apologize and clarify better
- If customer goes quiet: don't spam messages
- Understand context from full conversation history

DELIVERY CHARGES (explain clearly):
- Weight ≤ 2kg: Rs 150 home delivery / Rs 650 branch pickup
- Weight 2-4kg: Rs 250 home delivery
- Weight 4-7kg: Rs 500 home delivery
- Weight >7kg: Rs 100 per kg home delivery
- Branch pickup always Rs 650 (but cheaper for heavy items)
- Home delivery not available everywhere — branch pickup recommended for remote areas
- Always ask location to confirm delivery availability

SALES FLOW:
1. greeting: understand need, suggest product naturally
2. product_info: one key benefit + price, ask interest
3. bargaining: explain value, hold firm politely
4. collecting_order: get naam, phone, address
5. phone_verification: inform agent will call before shipping
6. confirmed: full order summary

BARGAINING (firm but polite):
- 1st request: explain value clearly — "यो quality को product यति कम मा पाउनु गाह्रो छ Sir/Madam"
- 2nd request: hold firm — "यो नै हाम्रो best price हो, सबैलाई यही मा दिन्छौं"
- 3rd request: collect info, pass to human — "Sir/Madam, हाम्रो senior agent ले call गर्नुहुनेछ, राम्रो deal मिलाउनुहुनेछ [NEEDS_HUMAN]"
- NO discount more than 5% ever
- NO free delivery as discount

AFTER COLLECTING NAME+PHONE+ADDRESS:
Give order summary then add:
"एउटा कुरा Sir/Madam — हामी courier मा सामान पठाउनु अघि एक पटक phone गर्नेछौं। Phone उठाउनुभयो भने मात्र order process हुन्छ। कृपया phone उठाइदिनुहोला।"

HUMAN HANDOFF [NEEDS_HUMAN]:
- After 3 failed bargaining attempts
- Customer very angry
- Complex question can't answer
- Technical issue

ORDER SUMMARY FORMAT:
"Order confirm!
Product: [name]
Naam: [naam]
Phone: [phone]
Address: [address]
Product price: Rs [price]
Delivery: Rs [delivery]
Total: Rs [total]

हामी courier मा पठाउनु अघि एक पटक phone गर्नेछौं। Phone उठाउनुभयो भने मात्र order process हुन्छ। कृपया phone उठाइदिनुहोला।"

REPLY RULES:
- MAX 3 sentences
- No asterisks, no bold, no bullet points
- Plain conversational text only
- Sound genuine, not scripted
- No [NEEDS_HUMAN] visible to customer — only add it at very end if needed

STAGE: ${stage}
${stage === 'greeting' ? 'Understand need, suggest product' : ''}
${stage === 'product_info' ? 'Brief pitch, price, ask interest' : ''}
${stage === 'bargaining' ? 'Hold price, explain value' : ''}
${stage === 'collecting_order' ? `Need: ${!orderData.name ? 'naam ' : ''}${!orderData.phone ? 'phone ' : ''}${!orderData.address ? 'address' : ''}` : ''}
${stage === 'phone_verification' ? 'Inform about phone verification before shipping' : ''}
${stage === 'confirmed' ? 'Full summary with phone verification message' : ''}

Plain text reply only.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: systemPrompt,
        messages: history
      })
    })

    const data = await response.json()
    const replyText = data.content?.[0]?.text || `hajur, k help garna sakxu?`

    history[history.length - 1] = { role: 'user', content: customerMessage }
    history.push({ role: 'assistant', content: replyText })

    // Stage detection
    let newStage = stage
    const lowerMsg = customerMessage.toLowerCase()
    const lowerReply = replyText.toLowerCase()

    if (stage === 'greeting') {
      if (lowerMsg.length > 5 && (
        lowerMsg.includes('price') || lowerMsg.includes('kati') || lowerMsg.includes('xa') ||
        lowerMsg.includes('kinna') || lowerMsg.includes('dari') || lowerMsg.includes('machine') ||
        lowerMsg.includes('kapal') || lowerMsg.includes('छ') || lowerMsg.includes('हुन्छ') ||
        products.some(p => lowerMsg.includes(p.name.toLowerCase().split(' ')[0])))) {
        newStage = 'product_info'
      }
    } else if (stage === 'product_info') {
      if (lowerMsg.includes('sasto') || lowerMsg.includes('discount') || lowerMsg.includes('kam') ||
          lowerMsg.includes('ghata') || lowerMsg.includes('सस्तो') || lowerMsg.includes('घटाउ')) {
        newStage = 'bargaining'
      } else if (lowerMsg.includes('ok') || lowerMsg.includes('linu') || lowerMsg.includes('order') ||
          lowerMsg.includes('pathau') || lowerMsg.includes('interested') || lowerMsg.includes('किन्छु')) {
        newStage = 'collecting_order'
      }
    } else if (stage === 'bargaining') {
      if (lowerMsg.includes('ok') || lowerMsg.includes('hunu') || lowerMsg.includes('linu') ||
          lowerMsg.includes('pathau') || lowerMsg.includes('order') || lowerMsg.includes('किन्छु')) {
        newStage = 'collecting_order'
      }
    } else if (stage === 'collecting_order') {
      const hasName = orderData.name || customerMessage.match(/(?:naam|name|नाम)[:\s]+/i)
      const hasPhone = orderData.phone || customerMessage.match(/(98|97|96)\d{8}/)
      const hasAddress = orderData.address
      if (hasName && hasPhone && hasAddress) {
        newStage = 'phone_verification'
      }
    } else if (stage === 'phone_verification') {
      if (lowerReply.includes('order confirm') || lowerReply.includes('total:')) {
        newStage = 'confirmed'
      }
    }

    const needsHuman = replyText.includes('[NEEDS_HUMAN]')
    const cleanReply = replyText.replace('[NEEDS_HUMAN]', '').trim()

    // Extract order info
    const updatedOrderData = { ...orderData }
    const nameMatch = customerMessage.match(/(?:naam|name|नाम)[:\s]+([A-Za-z\u0900-\u097F\s]{2,30})/i)
    const phoneMatch = customerMessage.match(/(98|97|96)\d{8}/)
    const addressKeywords = ['kathmandu', 'ktm', 'lalitpur', 'bhaktapur', 'kirtipur',
      'pokhara', 'chitwan', 'butwal', 'biratnagar', 'birgunj', 'dharan',
      'काठमाडौं', 'ललितपुर', 'भक्तपुर', 'पोखरा']
    if (nameMatch) updatedOrderData.name = nameMatch[1].trim()
    if (phoneMatch) updatedOrderData.phone = phoneMatch[0]
    if (addressKeywords.some(k => lowerMsg.includes(k))) updatedOrderData.address = customerMessage

    if (conversation) {
      await prisma.aIConversation.update({
        where: { id: conversation.id },
        data: {
          messages: JSON.stringify(history),
          stage: newStage,
          orderData: JSON.stringify(updatedOrderData),
          resolved: newStage === 'confirmed'
        }
      })
    } else {
      await prisma.aIConversation.create({
        data: {
          senderId,
          pageId,
          platform,
          messages: JSON.stringify(history),
          stage: newStage,
          orderData: JSON.stringify(updatedOrderData),
          resolved: newStage === 'confirmed'
        }
      })
    }

    if (needsHuman) {
      try {
        await prisma.order.create({
          data: {
            orderId: `PENDING-${Date.now()}`,
            customerName: updatedOrderData.name || senderName,
            phone: updatedOrderData.phone || 'Unknown',
            address: updatedOrderData.address || 'Unknown',
            product: 'Agent Follow Up Needed',
            price: 0,
            status: 'Pending',
            platform: platform,
          }
        })
      } catch (e) {
        console.error('Pending order error:', e)
      }

      await fetch(`${process.env.NEXTAUTH_URL}/api/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'human_handoff_needed',
          description: `⚠️ AGENT CALL गर्नुस्: ${senderName} — ${updatedOrderData.phone || 'phone unknown'}`,
          entityType: 'message',
          performedBy: 'AI',
          staffName: 'AI Sales Agent',
          isAI: true,
        })
      }).catch(() => {})
    }

    await fetch(`${process.env.NEXTAUTH_URL}/api/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ai_reply_sent',
        description: `AI → ${senderName} [${newStage}]`,
        entityType: 'message',
        performedBy: 'AI',
        staffName: 'AI Sales Agent',
        isAI: true,
      })
    }).catch(() => {})

    return cleanReply
  } catch (error) {
    console.error('AI reply error:', error)
    return `माफ गर्नुहोला, एक छिन पछि फेरि सम्पर्क गर्नुहोला।`
  }
}

export const POST = async (req: Request) => {
  try {
    const body = await req.json()
    console.log('Webhook received:', JSON.stringify(body).slice(0, 200))

    if (body.object === 'page') {
      for (const entry of body.entry) {
        const pageId = entry.id

        if (entry.messaging) {
          for (const event of entry.messaging) {
            if (event.message && !event.message.is_echo) {
              const senderId = event.sender.id
              const messageText = event.message.text || '[media]'
              const isVoice = event.message.attachments?.some((a: any) => a.type === 'audio')

              const pageToken = await getPageToken(pageId)

              let senderName = senderId
              if (pageToken) {
                senderName = await getFacebookUserName(senderId, pageToken)
              }

              try {
                await prisma.message.create({
                  data: {
                    platform: 'facebook',
                    senderId,
                    senderName,
                    pageId,
                    message: messageText,
                    timestamp: new Date(event.timestamp),
                    status: 'new',
                  }
                })
                await prisma.message.updateMany({
                  where: { senderId, senderName: senderId },
                  data: { senderName }
                })
              } catch (dbErr) {
                console.error('DB error:', dbErr)
              }

              if (pageToken) {
                let replyText: string
                if (isVoice) {
                  replyText = `Voice message आयो, तर अहिले voice process गर्न सकिँदैन। के चाहिएको छ type गरेर लेख्नुहोला।`
                } else {
                  replyText = await generateAIReply(senderId, pageId, messageText, 'facebook', senderName)
                }

                await sendFacebookMessage(pageToken, senderId, replyText)
                await prisma.message.updateMany({
                  where: { senderId, pageId, replied: false },
                  data: { replied: true, replyText, aiReplied: true }
                })
              }
            }
          }
        }
      }
    }

    return new Response('EVENT_RECEIVED', { status: 200 })
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response('Bad Request', { status: 400 })
  }
}

export const GET = async (req: Request) => {
  try {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const challenge = url.searchParams.get('hub.challenge')
    const token = url.searchParams.get('hub.verify_token')
    if (mode === 'subscribe' && (token === process.env.WEBHOOK_VERIFY_TOKEN || token === 'olkocms2024')) {
      return new Response(challenge ?? '', { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  } catch (err) {
    return new Response('Bad Request', { status: 400 })
  }
}