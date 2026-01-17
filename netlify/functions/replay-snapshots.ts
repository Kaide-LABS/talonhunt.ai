import type { Handler } from '@netlify/functions';
import { getDb } from '../../lib/mongodb';
import type { ReplaySnapshot, ReplaySnapshotTrigger } from '../../types';

const handler: Handler = async (event) => {
  const db = await getDb();

  // POST - Save a replay snapshot (from candidate)
  if (event.httpMethod === 'POST') {
    try {
      const { sessionId, code, cursorPosition, trigger } = JSON.parse(
        event.body || '{}'
      ) as {
        sessionId: string;
        code: string;
        cursorPosition?: { line: number; column: number };
        trigger: ReplaySnapshotTrigger;
      };

      if (!sessionId || code === undefined || !trigger) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'sessionId, code, and trigger are required',
          }),
        };
      }

      const snapshots = db.collection<ReplaySnapshot>('replay_snapshots');

      // Get the next sequence number for this session
      const lastSnapshot = await snapshots
        .find({ sessionId })
        .sort({ sequenceNumber: -1 })
        .limit(1)
        .toArray();

      const sequenceNumber =
        lastSnapshot.length > 0 ? lastSnapshot[0].sequenceNumber + 1 : 0;

      // Calculate metadata
      const lines = code.split('\n');
      const charCount = code.length;
      const lineCount = lines.length;

      const newSnapshot: ReplaySnapshot = {
        sessionId,
        sequenceNumber,
        timestamp: Date.now(),
        code,
        cursorPosition,
        metadata: {
          charCount,
          lineCount,
          trigger,
        },
      };

      await snapshots.insertOne(newSnapshot);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          sequenceNumber,
        }),
      };
    } catch (error) {
      console.error('Save replay snapshot error:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to save replay snapshot' }),
      };
    }
  }

  // GET - Retrieve all snapshots for a session (for replay)
  if (event.httpMethod === 'GET') {
    const sessionId = event.queryStringParameters?.sessionId;

    if (!sessionId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'sessionId is required' }),
      };
    }

    try {
      const snapshots = db.collection<ReplaySnapshot>('replay_snapshots');

      const allSnapshots = await snapshots
        .find({ sessionId })
        .sort({ sequenceNumber: 1 })
        .toArray();

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshots: allSnapshots,
          count: allSnapshots.length,
        }),
      };
    } catch (error) {
      console.error('Get replay snapshots error:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to retrieve replay snapshots' }),
      };
    }
  }

  return {
    statusCode: 405,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};

export { handler };
