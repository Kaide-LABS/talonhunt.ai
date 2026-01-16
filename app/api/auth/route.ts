import { NextRequest, NextResponse } from 'next/server';
import Ably from 'ably';

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('clientId') || 'anonymous';

  try {
    const ably = new Ably.Rest(process.env.ABLY_API_KEY!);

    const tokenRequest = await ably.auth.createTokenRequest({
      clientId,
      capability: {
        'session:*': ['publish', 'subscribe', 'presence'],
      },
    });

    return NextResponse.json(tokenRequest, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Ably auth error:', error);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}
