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
      `https://graph.facebook.com/v18.0/${senderId}?fields=name,profile_pic&access_token=${pageToken}`
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
        `• ${p.name} — Rs ${p.price}${p.salePrice ? ` (Sale: Rs ${p.salePrice})` : ''}\n  Description: ${p.description || 'N/A'}\n  Features: ${p.features || 'N/A'}\n  Usage: ${p.usage || 'N/A'}\n  Category: ${p.category || 'General'}`
      ).join('\n\n')
    : 'No specific products listed. Ask customer what they need.'

  history.push({ role: 'user', content: customerMessage })

  const systemPrompt = `You are a friendly, smart Nepali social commerce sales agent.
Customer Name: ${senderName}

PRODUCTS WE SELL:
${productContext}

CONVERSATION STAGE: ${stage}
ORDER INFO COLLECTED: ${JSON.stringify(orderData)}

YOUR STYLE:
- Natural Nepali/English mixed tone — sound like a real human
- Use customer's name naturally
- Use "hajur", "bhai/didi", "la", "ta" naturally
- Never sound robotic or copy-paste like
- Short replies (2-4 sentences max)
- Be warm, helpful, persuasive

SALES FLOW:
1. greeting → understand need, recommend product
2. product_info → explain benefits, compare, motivate to buy
3. collecting_order → get: full name, phone (98/97/96XXXXXXXX), delivery address
4. confirmed → confirm with full summary

DELIVERY:
- Kathmandu Valley: Rs 100
- Outside Valley: Rs 150
- Ask location first

BARGAINING RESPONSE:
- Max 10% discount only
- Say: "Tapailai special price dirakou xa, arko customer lai yo price dinna"

ORDER CONFIRM FORMAT (use exactly when all info collected):
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
Hamro team le 2-3 din bhitra deliver garxa! Dhanyabad 🙏"

IMPORTANT RULES:
- Match customer's language (Nepali/English/Mixed)
- If asked about product we don't have: "Yo product hami sanga xaina, tara [similar product] xa"
- If voice message: ask to type
- Always try to close the sale

STAGE GUIDE:
${stage === 'greeting' ? '→ Greet by name, ask what they need' : ''}
${stage === 'product_info' ? '→ Explain product well, highlight benefits, ask if ready to order' : ''}
${stage === 'collecting_order' ? `→ Need: ${!orderData.name ? 'naam' : ''} ${!orderData.phone ? 'phone' : ''} ${!orderData.address ? 'address' : ''}` : ''}
${stage === 'confirmed' ? '→ Already confirmed, thank and reassure delivery' : ''}

Reply with message text ONLY.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system: systemPrompt,
        messages: history
      })
    })

    const data = await response.json()
    const replyText = data.content?.[0]?.text || `Hajur ${senderName} ji, k help garna sakxu?`

    history.push({ role: 'assistant', content: replyText })

    // Stage detection
    let newStage = stage
    const lowerMsg = customerMessage.toLowerCase()
    const lowerReply = replyText.toLowerCase()

    if (stage === 'greeting') {
      if (lowerMsg.includes('price') || lowerMsg.includes('kati') || lowerMsg.includes('xa') ||
          lowerMsg.includes('kinna') || lowerMsg.includes('buy') || lowerMsg.includes('order') ||
          products.some(p => lowerMsg.includes(p.name.toLowerCase().split(' ')[0]))) {
        newStage = 'product_info'
      }
    } else if (stage === 'product_info') {
      if (lowerMsg.includes('ok') || lowerMsg.includes('hunu') || lowerMsg.includes('linu') ||
          lowerMsg.includes('order') || lowerMsg.includes('yes') || lowerMsg.includes('kinna')) {
        newStage = 'collecting_order'
      }
    } else if (stage === 'collecting_order') {
      if (lowerReply.includes('order confirm') || lowerReply.includes('total:') || lowerReply.includes('total')) {
        newStage = 'confirmed'
      }
    }

    // Extract order info
    const updatedOrderData = { ...orderData }
    const nameMatch = customerMessage.match(/(?:naam|name|मेरो नाम|म)[:\s]+([A-Za-z\u0900-\u097F\s]{3,30})/i)
    const phoneMatch = customerMessage.match(/(98|97|96)\d{8}/)
    const addressKeywords = ['ktm', 'kathmandu', 'lalitpur', 'bhaktapur', 'pokhara', 'chitwan', 'butwal', 'biratnagar', 'birgunj', 'dharan']
    if (nameMatch) updatedOrderData.name = nameMatch[1].trim()
    if (phoneMatch) updatedOrderData.phone = phoneMatch[0]
    if (addressKeywords.some(k => lowerMsg.includes(k))) {
      updatedOrderData.address = customerMessage
    }

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

    await fetch(`${process.env.NEXTAUTH_URL}/api/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ai_reply_sent',
        description: `AI ले ${senderName} (${senderId}) लाई reply गर्यो`,
        entityType: 'message',
        performedBy: 'AI',
        staffName: 'AI Sales Agent',
        isAI: true,
      })
    }).catch(() => {})

    return replyText
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

              // Get sender name from Facebook
              let senderName = senderId
              if (pageToken) {
                senderName = await getFacebookUserName(senderId, pageToken)
              }

              // Save message to DB
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

                // Update all previous messages with real name
                await prisma.message.updateMany({
                  where: { senderId, senderName: senderId },
                  data: { senderName }
                })
              } catch (dbErr) {
                console.error('DB error:', dbErr)
              }

              // Auto AI reply
              if (pageToken) {
                let replyText: string

                if (isVoice) {
                  replyText = `Hajur ${senderName} ji! Voice message receive bhayo 🎤 Tara hami voice process garna sakdainau. K help chahiyo type garera lekhnu na? 🙏`
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