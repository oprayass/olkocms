import { prisma } from '@/lib/prisma';

export const POST = async (req: Request) => {
  try {
    const body = await req.json();
    console.log('Facebook webhook received:', JSON.stringify(body));

    if (body.object === 'page') {
      for (const entry of body.entry) {
        const pageId = entry.id;

        if (entry.messaging) {
          for (const event of entry.messaging) {
            if (event.message && !event.message.is_echo) {
              console.log('Saving message from:', event.sender.id);
              try {
                await prisma.message.create({
                  data: {
                    platform: 'facebook',
                    senderId: event.sender.id,
                    senderName: event.sender.id,
                    pageId: pageId,
                    message: event.message.text ?? '[media]',
                    timestamp: new Date(event.timestamp),
                    status: 'new',
                  },
                });
                console.log('Message saved successfully!');
              } catch (dbErr) {
                console.error('DB save error:', dbErr);
              }
            }
          }
        }
      }
    }

    return new Response('EVENT_RECEIVED', { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('Bad Request', { status: 400 });
  }
};

export const GET = async (req: Request) => {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const challenge = url.searchParams.get('hub.challenge');
    const token = url.searchParams.get('hub.verify_token');
    if (mode === 'subscribe' && (token === process.env.WEBHOOK_VERIFY_TOKEN || token === 'olkocms2024')) {
      return new Response(challenge ?? '', { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  } catch (err) {
    return new Response('Bad Request', { status: 400 });
  }
};