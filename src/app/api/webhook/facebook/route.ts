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

// Nepali colloquial → English product keyword mapping
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
}

function expandMessage(message: string): string {
  const words = message.toLowerCase().split(/\s+/)
  const expanded = words.map(word => {
    const alias = productAliases[word]
    return alias ? `${word} ${alias}` : word
  })
  return expanded.join(' ')
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

  // Expand customer message with aliases
  const expandedMessage = expandMessage(customerMessage)

  // Add to history with expanded context
  history.push({
    role: 'user',
    content: customerMessage === expandedMessage
      ? customerMessage
      : `${customerMessage}\n[Context hint: ${expandedMessage}]`
  })

  const systemPrompt = `You are a friendly, smart Nepali social commerce sales agent chatting on Facebook Messenger.
Customer Name: ${senderName}

PRODUCTS WE SELL:
${productContext}

CONVERSATION STAGE: ${stage}
ORDER INFO COLLECTED SO FAR: ${JSON.stringify(orderData)}

YOUR PERSONALITY:
- Natural Nepali/English mixed tone — sound like a REAL human, never robotic
- Use customer's name naturally once in a while
- Use "hajur", "bhai/didi", "la", "ho ni", "ta" naturally
- Short replies (2-4 sentences max) — no long paragraphs
- Be warm, helpful, and gently persuasive

PRODUCT MATCHING RULES:
- "dari/daari kaatne machine" = beard trimmer/shaver
- "khur" = razor/shaver
- Match colloquial Nepali names to products intelligently
- If product matches: explain it enthusiastically
- If no exact match: suggest closest available product
- If nothing similar: say "yo product hami sanga xaina hajur, tara [suggest something] xa ki?"

SALES FLOW:
1. greeting → understand what customer needs, recommend product
2. product_info → explain benefits clearly, price, motivate to buy
3. collecting_order → collect: full name, phone number, delivery address
4. confirmed → confirm with order summary

DELIVERY CHARGES:
- Kathmandu Valley (KTM/Lalitpur/Bhaktapur): Rs 100
- Outside Valley: Rs 150
- Always ask location before confirming delivery charge

BARGAINING:
- Max 10% discount if they insist hard
- Use: "Tapailai special price dirakou xa, arko customer lai yo price gardainau"
- Don't give discount easily — first explain value

HUMAN HANDOFF:
- If customer is very angry or issue is complex: say "Hajur, ma hamro senior team lai connect gardinxu, ek chin wait garnu hola 🙏" and add [NEEDS_HUMAN] at end

ORDER CONFIRMATION (use when you have name + phone + address):
"🎉 Order confirm bhayo ${senderName} ji!
━━━━━━━━━━━━━━━
📦 [Product name]
👤 Naam: [naam]
📞 Phone: [phone]
📍 Address: [address]
━━━━━━━━━━━━━━━
💰 Product: Rs [price]
🚚 Delivery: Rs [delivery]
💵 TOTAL: Rs [total]
━━━━━━━━━━━━━━━
Hamro team le 2-3 din ma deliver garxa! Dhanyabad 🙏"

CURRENT STAGE INSTRUCTIONS:
${stage === 'greeting' ? '→ Greet warmly, understand what they need, recommend relevant product' : ''}
${stage === 'product_info' ? '→ Explain product benefits well, share price, ask if they want to order' : ''}
${stage === 'collecting_order' ? `→ Collecting order. Already have: ${JSON.stringify(orderData)}. Ask for missing info: ${!orderData.name ? 'naam ' : ''}${!orderData.phone ? 'phone ' : ''}${!orderData.address ? 'address' : ''}` : ''}
${stage === 'confirmed' ? '→ Order already confirmed! Thank customer, reassure delivery timeline' : ''}

Reply with message text ONLY. No quotes, no formatting tags.`

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

    // Store actual customer message (not expanded) in history
    history[history.length - 1] = { role: 'user', content: customerMessage }
    history.push({ role: 'assistant', content: replyText })

    // Stage detection
    let newStage = stage
    const lowerMsg = customerMessage.toLowerCase()
    const lowerReply = replyText.toLowerCase()

    if (stage === 'greeting') {
      if (lowerMsg.includes('price') || lowerMsg.includes('kati') || lowerMsg.includes('xa') ||
          lowerMsg.includes('kinna') || lowerMsg.includes('buy') || lowerMsg.includes('order') ||
          lowerMsg.includes('dari') || lowerMsg.includes('daari') || lowerMsg.includes('machine') ||
          products.some(p => lowerMsg.includes(p.name.toLowerCase().split(' ')[0]))) {
        newStage = 'product_info'
      }
    } else if (stage === 'product_info') {
      if (lowerMsg.includes('ok') || lowerMsg.includes('hunu') || lowerMsg.includes('linu') ||
          lowerMsg.includes('order') || lowerMsg.includes('yes') || lowerMsg.includes('kinna') ||
          lowerMsg.includes('pathau') || lowerMsg.includes('din')) {
        newStage = 'collecting_order'
      }
    } else if (stage === 'collecting_order') {
      if (lowerReply.includes('order confirm') || lowerReply.includes('total:') ||
          lowerReply.includes('deliver garxa')) {
        newStage = 'confirmed'
      }
    }

    // Check if needs human
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

    // Log if needs human handoff
    if (needsHuman) {
      await fetch(`${process.env.NEXTAUTH_URL}/api/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'human_handoff_needed',
          description: `⚠️ ${senderName} को conversation मा human help चाहिन्छ!`,
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
                // Update old messages with real name
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