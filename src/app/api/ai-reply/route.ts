import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { message } = await req.json()

  const isNepali = /[ऀ-ॿ]/.test(message)
  const isMixed = isNepali && /[a-zA-Z]{3,}/.test(message)
  const isEnglish = !isNepali

  let lang = 'Nepali Romanized (common spoken style like: Namaste! Tapaaiko...'
  if (isEnglish) lang = 'English'
  if (isMixed) lang = 'Mixed Nepali-English (Hinglish style)'

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: 'You are a helpful Nepali e-commerce customer service assistant for OlkoCMS. Reply in ' + lang + '. Keep it short, friendly and professional. Customer message: ' + message
      }]
    })
  })

  const data = await response.json()
  const reply = data.content?.[0]?.text || 'Sorry, could not generate reply.'

  return NextResponse.json({ reply })
}