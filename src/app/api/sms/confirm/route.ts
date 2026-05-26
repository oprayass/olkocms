import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { phone, customerName, product, price, pageName, orderId } = await req.json()

    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
    }

    const nepaliPhone = phone.startsWith('977')
      ? phone
      : `977${phone.replace(/^0/, '')}`

    const message = `नमस्ते ${customerName} जी! 😊\nतपाईंको order "${product}" (Rs ${Number(price).toLocaleString()}) confirm भयो। Order ID: ${orderId}\nधन्यवाद! - ${pageName || 'OlkoCMS'}`

    const token = process.env.SPARROW_SMS_TOKEN

    if (!token) {
      console.warn('SPARROW_SMS_TOKEN not set — SMS not sent')
      return NextResponse.json({ success: false, message: 'SMS token not configured' }, { status: 200 })
    }

    const response = await fetch('https://api.sparrowsms.com/v2/sms/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        from: 'Demo',
        to: nepaliPhone,
        text: message,
      }),
    })

    const data = await response.json()

    if (response.ok && data.response_code === 200) {
      return NextResponse.json({ success: true, message: 'SMS sent successfully' })
    } else {
      console.error('Sparrow SMS error:', data)
      return NextResponse.json({ success: false, error: data }, { status: 200 })
    }

  } catch (err) {
    console.error('SMS API error:', err)
    return NextResponse.json({ error: 'SMS failed' }, { status: 500 })
  }
}
