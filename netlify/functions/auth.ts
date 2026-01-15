import Ably from 'ably';
import type { Handler } from '@netlify/functions';

const handler: Handler = async (event) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const clientId = event.queryStringParameters?.clientId || 'anonymous';

  try {
    const ably = new Ably.Rest(process.env.ABLY_API_KEY!);

    const tokenRequest = await ably.auth.createTokenRequest({
      clientId,
      capability: {
        'session:*': ['publish', 'subscribe', 'presence'],
      },
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify(tokenRequest),
    };
  } catch (error) {
    console.error('Ably auth error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate token' }),
    };
  }
};

export { handler };
