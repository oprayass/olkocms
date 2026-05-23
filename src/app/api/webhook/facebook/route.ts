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

async function sendFacebookMessage(pageToken: string, recipientId: string, text: string) {
  try {
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
  'projector': 'projector screen display',
  'trimmer': 'trimmer hair beard clipper',
  'machine': 'machine device gadget',
  'light': 'light lamp bulb LED',
  'fan': 'fan cooler air',
  'camera': 'camera CCTV security',
  'speaker': 'speaker sound bluetooth',
  'earphone': 'earphone headphone earbud',
  'charger': 'charger adapter cable',
  'cover': 'cover case mobile phone',
  'watch': 'watch smartwatch band',
  'bag': 'bag backpack purse',
  'kapal': 'hair trimmer clipper',
}

function expandMessage(message: string): string {
  const words = message.toLowerCase().split(/\s+/)
  return words.map(word => {
    const alias = productAliases[word]
    return alias ? `${word} ${alias}` : word
  }).join(' ')
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

  const products = await prisma.product.findMany({
    where: { status: 'Active' },
    take: 30
  })

  const productContext = products.length > 0
    ? products.map(p =>
        `• ${p.name} — Rs ${p.price}${p.salePrice ? ` (Sale: Rs ${p.salePrice})` : ''}
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

  const systemPrompt = `You are a friendly, smart Nepali social commerce sales agent on Facebook Messenger.
Customer Name: ${senderName}

PRODUCTS WE SELL:
${productContext}

CONVERSATION STAGE: ${stage}
ORDER INFO COLLECTED: ${JSON.stringify(orderData)}

YOUR PERSONALITY:
- Natural Nepali/English mixed tone — sound like a REAL human
- Use customer name naturally
- Use "hajur", "bhai/didi", "la", "ho ni" naturally
- MAXIMUM 3 sentences per reply — no exceptions
- Never repeat information already mentioned
- Product name once only — no bold/asterisk formatting
- One clear call to action per message
- Warm, helpful, gently persuasive

PRODUCT MATCHING:
- Match colloquial Nepali names intelligently (dari/daari/kapal = trimmer/shaver, khur = razor)
- If product matches: explain enthusiastically with price
- If similar product exists: suggest it
- If nothing available: "Yo product hami sanga xaina hajur, tara [nearest product] xa"

SALES FLOW:
1. greeting → understand need, recommend product
2. product_info → explain benefits, price, motivate
3. bargaining → handle price negotiation firmly but politely
4. collecting_order → get name, phone, address
5. confirmed → order summary

DELIVERY:
- Kathmandu Valley: Rs 100
- Outside Valley: Rs 150
- Ask location first

BARGAINING RULES (IMPORTANT):
- Customer asks for discount → First reply: explain the VALUE of product, why it's worth the price
  Example: "Hajur yo product ko quality ekdam ramro xa, [features] xa, yo price ma yesto quality pauna garo xa"
- Customer insists again → Acknowledge but hold firm:
  Example: "Hajur bujhxu tapaiको कुरा, tara yo already hamro best price ho, arko customer lai pani yei price ma dinxu"  
- Customer insists third time → Create urgency without discount:
  Example: "Hajur stock limited xa, aaja nai order garda ramro hola. Delivery charge pani hami cover gardinxu special case ma"
- Customer still refuses → Collect their info for callback:
  "Hajur k garda ramro hola, tapaiको naam ra number dinu na, hamro senior agent le chadai call garnu hunxa ra tapailai best deal garnu hunxa [NEEDS_HUMAN]"
- NEVER give discount on your own. Always try to sell at full price by emphasizing value and quality.
- If they ask "last price" → say "yo hamro final price ho hajur"

HUMAN HANDOFF:
- If customer is very angry: "[NEEDS_HUMAN]"
- If bargaining failed after 3 attempts: collect name+phone, add "[NEEDS_HUMAN]"
- If complex technical question you can't answer: "[NEEDS_HUMAN]"

ORDER CONFIRM FORMAT:
"🎉 Order confirm bhayo ${senderName} ji!
━━━━━━━━━━━━━━━
📦 Product: [name]
👤 Naam: [naam]
📞 Phone: [phone]
📍 Address: [address]
━━━━━━━━━━━━━━━
💰 Product: Rs [price]
🚚 Delivery: Rs [delivery]
💵 TOTAL: Rs [total]
━━━━━━━━━━━━━━━
Hamro team le 2-3 din ma deliver garxa! Dhanyabad 🙏"

STAGE GUIDE:
${stage === 'greeting' ? '→ Greet warmly, understand need, recommend product' : ''}
${stage === 'product_info' ? '→ Explain product well, price, ask if ready to order' : ''}
${stage === 'bargaining' ? '→ Handle price negotiation firmly, explain value' : ''}
${stage === 'collecting_order' ? `→ Need: ${!orderData.name ? 'naam ' : ''}${!orderData.phone ? 'phone ' : ''}${!orderData.address ? 'address' : ''}` : ''}
${stage === 'confirmed' ? '→ Order confirmed! Thank and reassure delivery' : ''}

Reply with message ONLY. No quotes or tags except [NEEDS_HUMAN].`

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
        max_tokens: 600,
        system: systemPrompt,
        messages: history
      })
    })

    const data = await response.json()
    const replyText = data.content?.[0]?.text || `Hajur ${senderName} ji, k help garna sakxu?`

    history[history.length - 1] = { role: 'user', content: customerMessage }
    history.push({ role: 'assistant', content: replyText })

    // Stage detection
    let newStage = stage
    const lowerMsg = customerMessage.toLowerCase()
    const lowerReply = replyText.toLowerCase()

    if (stage === 'greeting') {
      if (lowerMsg.includes('price') || lowerMsg.includes('kati') || lowerMsg.includes('xa') ||
          lowerMsg.includes('kinna') || lowerMsg.includes('buy') || lowerMsg.includes('dari') ||
          lowerMsg.includes('machine') || lowerMsg.includes('kapal') ||
          products.some(p => lowerMsg.includes(p.name.toLowerCase().split(' ')[0]))) {
        newStage = 'product_info'
      }
    } else if (stage === 'product_info') {
      if (lowerMsg.includes('sasto') || lowerMsg.includes('discount') || lowerMsg.includes('kam') ||
          lowerMsg.includes('milo') || lowerMsg.includes('ghata') || lowerMsg.includes('cheap')) {
        newStage = 'bargaining'
      } else if (lowerMsg.includes('ok') || lowerMsg.includes('hunu') || lowerMsg.includes('linu') ||
          lowerMsg.includes('order') || lowerMsg.includes('yes') || lowerMsg.includes('pathau')) {
        newStage = 'collecting_order'
      }
    } else if (stage === 'bargaining') {
      if (lowerMsg.includes('ok') || lowerMsg.includes('hunu') || lowerMsg.includes('linu') ||
          lowerMsg.includes('pathau') || lowerMsg.includes('order')) {
        newStage = 'collecting_order'
      }
    } else if (stage === 'collecting_order') {
      if (lowerReply.includes('order confirm') || lowerReply.includes('deliver garxa')) {
        newStage = 'confirmed'
      }
    }

    const needsHuman = replyText.includes('[NEEDS_HUMAN]')
    const cleanReply = replyText.replace('[NEEDS_HUMAN]', '').trim()

    // Extract order info
    const updatedOrderData = { ...orderData }
    const nameMatch = customerMessage.match(/(?:naam|name|मेरो नाम)[:\s]+([A-Za-z\u0900-\u097F\s]{2,30})/i)
    const phoneMatch = customerMessage.match(/(98|97|96)\d{8}/)
    const addressKeywords = ['ktm', 'kathmandu', 'lalitpur', 'bhaktapur', 'pokhara',
      'chitwan', 'butwal', 'biratnagar', 'birgunj', 'dharan', 'hetauda', 'nepalgunj']
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
      // Create pending order for human follow up
      try {
        await prisma.order.create({
          data: {
            orderId: `PENDING-${Date.now()}`,
            customerName: updatedOrderData.name || senderName,
            phone: updatedOrderData.phone || 'Unknown',
            address: updatedOrderData.address || 'Unknown',
            product: updatedOrderData.product || 'Unknown - AI Handoff',
            price: 0,
            status: 'Pending',
            platform: platform,
          }
        })
      } catch (e) {
        console.error('Pending order create error:', e)
      }

      await fetch(`${process.env.NEXTAUTH_URL}/api/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'human_handoff_needed',
          description: `⚠️ HUMAN NEEDED: ${senderName} को conversation — agent call गर्नुस्!`,
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
        description: `AI ले ${senderName} लाई reply गर्यो [stage: ${newStage}]`,
        entityType: 'message',
        performedBy: 'AI',
        staffName: 'AI Sales Agent',
        isAI: true,
      })
    }).catch(() => {})

    return cleanReply
  } catch (error) {
    console.error('AI reply error:', error)
    return `Hajur ${senderName} ji, k help garna sakxu?`
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
                  replyText = `Hajur ${senderName} ji! Voice message receive bhayo 🎤 Tara abhi voice process garna sakdainau. K help chahiyo type garera lekhnu na? 🙏`
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