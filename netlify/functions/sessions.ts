import type { Handler } from '@netlify/functions';
import { getDb } from '../../lib/mongodb';
import { customAlphabet } from 'nanoid';
import type { Session } from '../../types';

// Use alphanumeric only to avoid URL issues with _ and -
const nanoid = customAlphabet('0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz', 10);

const handler: Handler = async (event) => {
  const db = await getDb();
  const sessions = db.collection<Session>('sessions');

  // POST - Create session
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const sessionId = nanoid(10);

      const session: Session = {
        sessionId,
        status: 'active',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
        language: body.language || 'javascript',
        candidateName: body.candidateName,
        integrityScore: 100,
      };

      await sessions.insertOne(session);

      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...session,
          createdAt: session.createdAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
        }),
      };
    } catch (error) {
      console.error('Create session error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to create session' }),
      };
    }
  }

  // GET - Get session by ID
  if (event.httpMethod === 'GET') {
    const sessionId = event.queryStringParameters?.id;

    if (!sessionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Session ID required' }),
      };
    }

    try {
      const session = await sessions.findOne({ sessionId });

      if (!session) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Session not found' }),
        };
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...session,
          createdAt: session.createdAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
        }),
      };
    } catch (error) {
      console.error('Get session error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to get session' }),
      };
    }
  }

  // PATCH - Update session (e.g., end session, update score)
  if (event.httpMethod === 'PATCH') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { sessionId, ...updates } = body;

      if (!sessionId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Session ID required' }),
        };
      }

      const result = await sessions.updateOne(
        { sessionId },
        { $set: updates }
      );

      if (result.matchedCount === 0) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Session not found' }),
        };
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true }),
      };
    } catch (error) {
      console.error('Update session error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to update session' }),
      };
    }
  }

  return {
    statusCode: 405,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};

export { handler };
