import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { customerMessage, customerName, orderDetails } = await req.json();

    if (!customerMessage) {
      return NextResponse.json(
        { error: 'customerMessage is required' },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a helpful customer service representative for OlkoCMS, a Nepali e-commerce management system. Write professional, friendly replies in the same language the customer used (Nepali or English). Keep replies concise (2-4 sentences), empathetic, and solution-oriented.`;

    const userPrompt = `Customer Name: ${customerName || 'Customer'}
${orderDetails ? `Order Details: ${orderDetails}` : ''}
Customer Message: ${customerMessage}

Write a professional reply to this customer message.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const reply = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    return NextResponse.json({ reply });

  } catch (error: any) {
    console.error('AI Reply error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate reply' },
      { status: 500 }
    );
  }
}

