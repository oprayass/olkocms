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

function expandMessage(message: string): string {
  const words = message.toLowerCase().split(/\s+/)
  return words.map(word => {
    const alias = productAliases[word]
    return alias ? `${word} ${alias}` : word
  }).join(' ')
}

function detectSameDay(message: string): boolean {
  const lower = message.toLowerCase()
  const sameDayKeywords = [
    'aaja', 'today', 'ahile', 'aile', 'abhi', 'turant', 'chito',
    'aaja nai', 'same day', 'urgent', 'jaldi', 'emergency',
    'आज', 'अहिले', 'तुरुन्त', 'चाँडो'
  ]
  return sameDayKeywords.some(k => lower.includes(k))
}

function isConversationEnding(message: string): boolean {
  const lower = message.toLowerCase()
  const endingSignals = [
    'bye', 'thanks', 'dhanyabad', 'nai parcha', 'naparcha',
    'hudaina', 'no thanks', 'chhodo', 'janxu', 'sochxu',
    'पछि', 'later', 'thik xa', 'ok bye'
  ]
  return endingSignals.some(signal => lower.includes(signal)) && message.length < 25
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
  const isSameDay = detectSameDay(customerMessage) || orderData.isSameDay

  if (isSameDay) orderData.isSameDay = true

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
  Category: ${p.category || 'General'}
  IMPORTANT: Only mention features/warranty/specs that are explicitly listed above. Never add information not in this list.`
      ).join('\n\n')
    : 'No specific products listed.'

  const expandedMessage = expandMessage(customerMessage)

  history.push({
    role: 'user',
    content: customerMessage === expandedMessage
      ? customerMessage
      : `${customerMessage}\n[Context: ${expandedMessage}]`
  })

  const systemPrompt = `तिमी एक real Nepali sales person हौ — Facebook Messenger मा customer सँग कुरा गर्छौ। AI होइनौ।

Customer Name: ${senderName}
Same Day Request: ${isSameDay ? 'YES' : 'NO'}

PRODUCTS:
${productContext}

STAGE: ${stage}
ORDER INFO: ${JSON.stringify(orderData)}

LANGUAGE (STRICT):
- Nepali words → देवनागरी: राम्रो, छ, हुन्छ, गर्नुस्, धन्यवाद
- English words, digits, brand names → English: Rs 1100, VGR V-071, 180 min
- Match customer language exactly
- Roman Nepali customer → Roman Nepali reply
- English customer → English reply
- MAX 3 sentences per reply
- No asterisks (*), no bold, no bullets
- Plain text only

GENDER RULES (NEVER BREAK):
- Male → "Sir" 
- Female → "Madam"
- Unknown → "hajur"
- NEVER: bhai, bahini, didi, dai, ta, timi, timro

PRODUCT RULES (CRITICAL):
- ONLY mention features/specs/warranty that are explicitly in product description
- NEVER add warranty, features, specs not listed
- If warranty not mentioned → don't mention warranty
- If asked about warranty not listed → "यो product को warranty details हामीसँग available छैन"

DELIVERY (weight-based):
- Get product weight from product info
- ≤2kg: Rs 100 Valley / Rs 150 outside
- 2-4kg: Rs 250
- 4-7kg: Rs 500  
- >7kg: Rs 100/kg
- Remote areas (Humla, Jumla, etc): courier नपुग्ने ठाउँ → "हाम्रो courier यहाँ पुग्दैन, nearest city मा pickup गर्नुपर्छ"

SAME DAY DELIVERY:
${isSameDay ? `
Customer wants SAME DAY delivery.
- Kathmandu Valley मात्र same day possible
- On-demand bike (InDrive/Yango जस्तो) use गरिन्छ
- Exact charge call गरेर confirm गरिन्छ — depend on distance
- "हामी तपाईंलाई call गरेर exact delivery charge बताउनेछौं"
- Naam, phone, address माग्नुस्
- Outside Valley same day → "माफ गर्नुस् Sir/Madam, Kathmandu बाहिर आज delivery सम्भव छैन। भोलि वा 2 दिनमा पुग्छ, हामी call गर्नेछौं"
` : `
Normal delivery: 2-3 days via courier
`}

BARGAINING:
- 1st: explain value — "यो quality यति कम मा पाउनु गाह्रो छ"
- 2nd: hold firm — "यो नै final price हो Sir/Madam"  
- 3rd: [NEEDS_HUMAN] — collect info, agent will call

NO DISCOUNT — collect info then [NEEDS_HUMAN] after 3rd attempt

ORDER FLOW:
1. greeting → understand need
2. product_info → brief pitch
3. bargaining → hold firm
4. collecting_order → naam, phone, address
5. phone_verify → confirm agent will call
6. confirmed → summary

AFTER ALL INFO COLLECTED:
"Order details लिइयो। हामी courier मा पठाउनु अघि एक पटक phone गर्नेछौं — phone उठाउनुभयो भने मात्र order process हुन्छ। कृपया phone उठाइदिनुहोला।"

ORDER SUMMARY:
"Order confirm!
Product: [name]
Naam: [naam]
Phone: [phone]
Address: [address]
Product: Rs [price]
Delivery: ${isSameDay ? 'Call गरेर confirm गरिन्छ' : 'Rs [charge]'}
Total: ${isSameDay ? 'Delivery charge थपेर' : 'Rs [total]'}

हामी phone गर्नेछौं, उठाउनुहोला।"

CURRENT STAGE GUIDE:
${stage === 'greeting' ? '→ Understand need, suggest product' : ''}
${stage === 'product_info' ? '→ Brief pitch, price, ask interest' : ''}
${stage === 'bargaining' ? '→ Explain value, hold price firm' : ''}
${stage === 'collecting_order' ? `→ Need: ${!orderData.name ? 'naam ' : ''}${!orderData.phone ? 'phone ' : ''}${!orderData.address ? 'address' : ''}` : ''}
${stage === 'phone_verify' ? '→ Confirm phone call before shipping' : ''}
${stage === 'confirmed' ? '→ Summary given, thank customer' : ''}

Plain text reply only. Sound real.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 400,
        system: systemPrompt,
        messages: history
      })
    })

    const data = await response.json()
    const replyText = data.content?.[0]?.text || `माफ गर्नुस्, फेरि सम्पर्क गर्नुहोला।`

    history[history.length - 1] = { role: 'user', content: customerMessage }
    history.push({ role: 'assistant', content: replyText })

    let newStage = stage
    const lowerMsg = customerMessage.toLowerCase()
    const lowerReply = replyText.toLowerCase()

    if (stage === 'greeting') {
      if (lowerMsg.length > 3 && (
        lowerMsg.includes('price') || lowerMsg.includes('kati') ||
        lowerMsg.includes('xa') || lowerMsg.includes('kinna') ||
        lowerMsg.includes('dari') || lowerMsg.includes('machine') ||
        lowerMsg.includes('kapal') || lowerMsg.includes('छ') ||
        lowerMsg.includes('हुन्छ') || isSameDay ||
        products.some(p => lowerMsg.includes(p.name.toLowerCase().split(' ')[0])))) {
        newStage = 'product_info'
      }
    } else if (stage === 'product_info') {
      if (lowerMsg.includes('sasto') || lowerMsg.includes('discount') ||
          lowerMsg.includes('kam') || lowerMsg.includes('सस्तो') ||
          lowerMsg.includes('घटाउ') || lowerMsg.includes('milau')) {
        newStage = 'bargaining'
      } else if (lowerMsg.includes('ok') || lowerMsg.includes('linu') ||
          lowerMsg.includes('order') || lowerMsg.includes('pathau') ||
          lowerMsg.includes('interested') || lowerMsg.includes('किन्छु') ||
          isSameDay) {
        newStage = 'collecting_order'
      }
    } else if (stage === 'bargaining') {
      if (lowerMsg.includes('ok') || lowerMsg.includes('linu') ||
          lowerMsg.includes('pathau') || lowerMsg.includes('order')) {
        newStage = 'collecting_order'
      }
    } else if (stage === 'collecting_order') {
      const hasName = orderData.name
      const hasPhone = orderData.phone
      const hasAddress = orderData.address
      if (hasName && hasPhone && hasAddress) {
        newStage = 'phone_verify'
      }
    } else if (stage === 'phone_verify') {
      if (lowerReply.includes('order confirm') || lowerReply.includes('phone गर्नेछौं')) {
        newStage = 'confirmed'
      }
    }

    const needsHuman = replyText.includes('[NEEDS_HUMAN]')
    const cleanReply = replyText.replace('[NEEDS_HUMAN]', '').trim()

    const updatedOrderData = { ...orderData }
    const nameMatch = customerMessage.match(/(?:naam|name|नाम)[:\s]+([A-Za-z\u0900-\u097F\s]{2,30})/i)
    const phoneMatch = customerMessage.match(/(98|97|96)\d{8}/)
    const addressKeywords = ['kathmandu', 'ktm', 'lalitpur', 'bhaktapur', 'kirtipur',
      'pokhara', 'chitwan', 'butwal', 'biratnagar', 'birgunj', 'dharan',
      'काठमाडौं', 'ललितपुर', 'भक्तपुर', 'पोखरा', 'humla', 'jumla']
    if (nameMatch) updatedOrderData.name = nameMatch[1].trim()
    if (phoneMatch) updatedOrderData.phone = phoneMatch[0]
    if (addressKeywords.some(k => lowerMsg.includes(k))) updatedOrderData.address = customerMessage
    if (isSameDay) updatedOrderData.isSameDay = true

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

    if (needsHuman || newStage === 'phone_verify' || newStage === 'confirmed') {
      try {
        const existingOrder = await prisma.order.findFirst({
          where: { phone: updatedOrderData.phone || '', status: 'Pending' }
        })
        if (!existingOrder) {
          await prisma.order.create({
            data: {
              orderId: `${isSameDay ? 'SAMEDAY' : 'NORMAL'}-${Date.now()}`,
              customerName: updatedOrderData.name || senderName,
              phone: updatedOrderData.phone || 'Unknown',
              address: updatedOrderData.address || 'Unknown',
              product: updatedOrderData.product || 'From Facebook Chat',
              price: 0,
              status: 'Pending',
              platform: platform,
              notes: isSameDay ? '🔴 SAME DAY DELIVERY - Call immediately!' : undefined,
            } as any
          })
        }
      } catch (e) {
        console.error('Order create error:', e)
      }

      if (needsHuman) {
        await fetch(`${process.env.NEXTAUTH_URL}/api/activity`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'human_handoff_needed',
            description: `⚠️ ${isSameDay ? '🔴 SAME DAY' : 'NORMAL'} — CALL गर्नुस्: ${senderName} — ${updatedOrderData.phone || 'unknown'}`,
            entityType: 'message',
            performedBy: 'AI',
            staffName: 'AI Sales Agent',
            isAI: true,
          })
        }).catch(() => {})
      }
    }

    await fetch(`${process.env.NEXTAUTH_URL}/api/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ai_reply_sent',
        description: `AI → ${senderName} [${newStage}]${isSameDay ? ' 🔴 SAME DAY' : ''}`,
        entityType: 'message',
        performedBy: 'AI',
        staffName: 'AI Sales Agent',
        isAI: true,
      })
    }).catch(() => {})

    return cleanReply
  } catch (error) {
    console.error('AI reply error:', error)
    return `माफ गर्नुस्, एक छिन पछि फेरि सम्पर्क गर्नुहोला।`
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