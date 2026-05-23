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

async function sendFacebookMessage(pageToken: string, recipientId: string, text: string) {
  await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${pageToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text }
    })
  })
}

async function generateAIReply(
  senderId: string,
  pageId: string,
  customerMessage: string,
  platform: string
): Promise<string> {
  // Get or create conversation
  let conversation = await prisma.aIConversation.findFirst({
    where: { senderId, pageId, resolved: false }
  })

  const history = conversation ? JSON.parse(conversation.messages) : []

  // Get products for context
  const products = await prisma.product.findMany({
    where: { status: 'Active' },
    take: 20
  })

  const productContext = products.length > 0
    ? products.map(p => `- ${p.name}: Rs ${p.price}${p.salePrice ? ` (Sale: Rs ${p.salePrice})` : ''} | ${p.description || ''} | ${p.features || ''}`).join('\n')
    : 'Products: General items available, ask for details.'

  const orderData = conversation?.orderData ? JSON.parse(conversation.orderData) : {}
  const stage = conversation?.stage || 'greeting'

  // Add customer message to history
  history.push({ role: 'user', content: customerMessage })

  const systemPrompt = `You are a friendly Nepali social commerce sales agent for Facebook page.

PRODUCTS AVAILABLE:
${productContext}

CURRENT CONVERSATION STAGE: ${stage}
ORDER DATA COLLECTED SO FAR: ${JSON.stringify(orderData)}

YOUR PERSONALITY:
- Warm, friendly, natural Nepali/English mixed tone
- Sound like a real human, never robotic
- Use "hajur", "bhai/didi", casual Nepali expressions naturally
- Be helpful but also motivate to buy

SALES FLOW:
1. greeting → understand what customer wants
2. product_info → explain product, price, features, benefits
3. collecting_order → collect: full name, phone number, delivery address
4. confirmed → confirm order with total price including delivery

DELIVERY CHARGES:
- Kathmandu Valley: Rs 100
- Outside Valley: Rs 150-200
- Ask their location to confirm exact charge

BARGAINING:
- Small discount (5-10%) is okay if they insist
- Never go below cost price
- Use phrases like "special price dirakou xa hajurko lagi"

ORDER CONFIRMATION FORMAT:
"Order confirm bhayo! 🎉
Naam: [naam]
Phone: [phone]  
Address: [address]
Product: [product] x [qty]
Product Price: Rs [price]
Delivery: Rs [delivery]
TOTAL: Rs [total]
Dhanyabad! Hamro team le 2-3 din ma deliver garxa 🚚"

IMPORTANT:
- Detect language (Nepali/English/Mixed) and reply in SAME style
- If voice message: acknowledge and ask to type
- Keep replies SHORT (2-4 sentences max)
- Always guide toward order completion
- If order confirmed: set stage to "confirmed"

Current stage instructions:
${stage === 'greeting' ? 'Greet warmly and ask what they need' : ''}
${stage === 'product_info' ? 'Explain product benefits, motivate to buy, ask if they want to order' : ''}
${stage === 'collecting_order' ? `Collecting order info. Already have: ${JSON.stringify(orderData)}. Ask for missing: name/phone/address` : ''}
${stage === 'confirmed' ? 'Order confirmed! Thank customer and give delivery timeline' : ''}

Reply ONLY with the message text, nothing else.`

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
        max_tokens: 500,
        system: systemPrompt,
        messages: history
      })
    })

    const data = await response.json()
    const replyText = data.content?.[0]?.text || 'Hajur, k help garna sakxu?'

    // Add AI reply to history
    history.push({ role: 'assistant', content: replyText })

    // Determine new stage
    let newStage = stage
    const lowerReply = replyText.toLowerCase()
    const lowerMsg = customerMessage.toLowerCase()

    if (stage === 'greeting' && (lowerMsg.includes('price') || lowerMsg.includes('kati') || lowerMsg.includes('product') || lowerMsg.includes('kinna'))) {
      newStage = 'product_info'
    } else if (stage === 'product_info' && (lowerMsg.includes('order') || lowerMsg.includes('kinna') || lowerMsg.includes('linu') || lowerMsg.includes('yes') || lowerMsg.includes('ok'))) {
      newStage = 'collecting_order'
    } else if (lowerReply.includes('order confirm bhayo') || lowerReply.includes('total:')) {
      newStage = 'confirmed'
    }

    // Extract order data from messages
    const nameMatch = customerMessage.match(/(?:naam|name|म|मेरो नाम)[:\s]+([A-Za-z\u0900-\u097F\s]+)/i)
    const phoneMatch = customerMessage.match(/(?:98|97|96)\d{8}/)
    const updatedOrderData = { ...orderData }
    if (nameMatch) updatedOrderData.name = nameMatch[1].trim()
    if (phoneMatch) updatedOrderData.phone = phoneMatch[0]

    // Update or create conversation
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

    // Log activity
    await fetch(`${process.env.NEXTAUTH_URL}/api/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ai_reply_sent',
        description: `AI ले ${senderId} लाई auto-reply गर्यो: "${replyText.slice(0, 50)}..."`,
        entityType: 'message',
        performedBy: 'AI',
        staffName: 'AI Sales Agent',
        isAI: true,
      })
    }).catch(() => {})

    return replyText
  } catch (error) {
    console.error('AI reply error:', error)
    return 'Hajur, k help garna sakxu?'
  }
}

export const POST = async (req: Request) => {
  try {
    const body = await req.json()
    console.log('Facebook webhook received:', JSON.stringify(body))

    if (body.object === 'page') {
      for (const entry of body.entry) {
        const pageId = entry.id

        if (entry.messaging) {
          for (const event of entry.messaging) {
            if (event.message && !event.message.is_echo) {
              const senderId = event.sender.id
              const messageText = event.message.text || '[media/voice]'
              const isVoice = event.message.attachments?.some((a: any) => a.type === 'audio')

              // Save message to DB
              try {
                await prisma.message.create({
                  data: {
                    platform: 'facebook',
                    senderId,
                    senderName: senderId,
                    pageId,
                    message: messageText,
                    timestamp: new Date(event.timestamp),
                    status: 'new',
                  }
                })
              } catch (dbErr) {
                console.error('DB save error:', dbErr)
              }

              // Auto AI reply
              const pageToken = await getPageToken(pageId)
              if (pageToken) {
                let replyText: string

                if (isVoice) {
                  replyText = 'Hajur! Voice message receive bhayo, tara hami abhi voice process garna sakdainau. K help chahiyo type garera lekhnu na? 🙏'
                } else {
                  replyText = await generateAIReply(senderId, pageId, messageText, 'facebook')
                }

                await sendFacebookMessage(pageToken, senderId, replyText)

                // Update message as replied
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