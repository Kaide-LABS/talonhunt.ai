import type { Handler } from '@netlify/functions';
import { getDb } from '../../lib/mongodb';
import type { VisualSnapshot, VisualSnapshotTrigger } from '../../types';

const MAX_SNAPSHOTS_PER_SESSION = 30;

const handler: Handler = async (event) => {
  const db = await getDb();

  // POST - Save a visual snapshot (from candidate webcam)
  if (event.httpMethod === 'POST') {
    try {
      const { sessionId, imageData, trigger } = JSON.parse(
        event.body || '{}'
      ) as {
        sessionId: string;
        imageData: string;
        trigger: VisualSnapshotTrigger;
      };

      if (!sessionId || !imageData || !trigger) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'sessionId, imageData, and trigger are required',
          }),
        };
      }

      // Validate imageData is base64
      if (!imageData.startsWith('data:image/jpeg;base64,') && !imageData.startsWith('/9j/')) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'imageData must be a valid JPEG base64 string',
          }),
        };
      }

      const snapshots = db.collection<VisualSnapshot>('visual_snapshots');

      // Check current snapshot count for this session
      const currentCount = await snapshots.countDocuments({ sessionId });

      if (currentCount >= MAX_SNAPSHOTS_PER_SESSION) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            reason: 'max_snapshots_reached',
            count: currentCount,
          }),
        };
      }

      // Get next sequence number
      const lastSnapshot = await snapshots
        .find({ sessionId })
        .sort({ sequenceNumber: -1 })
        .limit(1)
        .toArray();

      const sequenceNumber = lastSnapshot.length > 0
        ? lastSnapshot[0].sequenceNumber + 1
        : 0;

      const newSnapshot: VisualSnapshot = {
        sessionId,
        sequenceNumber,
        timestamp: Date.now(),
        imageData,
        trigger,
      };

      await snapshots.insertOne(newSnapshot);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          sequenceNumber,
          count: currentCount + 1,
          remaining: MAX_SNAPSHOTS_PER_SESSION - currentCount - 1,
        }),
      };
    } catch (error) {
      console.error('Save visual snapshot error:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to save visual snapshot' }),
      };
    }
  }

  // GET - Retrieve all visual snapshots for a session (for review page)
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
      const snapshots = db.collection<VisualSnapshot>('visual_snapshots');

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
      console.error('Get visual snapshots error:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to retrieve visual snapshots' }),
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
