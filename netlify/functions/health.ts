import type { Handler } from '@netlify/functions';
import { isConnected } from '../../lib/mongodb';

const handler: Handler = async () => {
  try {
    const mongoConnected = await isConnected();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'ok',
        mongo: mongoConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Health check error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'error',
        mongo: 'error',
        timestamp: new Date().toISOString(),
      }),
    };
  }
};

export { handler };
