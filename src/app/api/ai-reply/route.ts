import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    // Session gate: this route touches no tenant data, but every call spends
    // Anthropic API credit - so it must only be callable by a logged-in
    // dashboard user. (The FB webhook has its own inline AI logic and does
    // NOT call this route.)
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
