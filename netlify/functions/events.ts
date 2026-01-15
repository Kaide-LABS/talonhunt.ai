import type { Handler } from '@netlify/functions';
import { getDb } from '../../lib/mongodb';
import type { IntegrityEventBatch, TelemetryEvent } from '../../types';

const handler: Handler = async (event) => {
  const db = await getDb();

  // POST - Store batch of integrity events
  if (event.httpMethod === 'POST') {
    try {
      const { sessionId, events } = JSON.parse(event.body || '{}') as IntegrityEventBatch;

      if (!sessionId || !events || !Array.isArray(events)) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid payload' }),
        };
      }

      // Skip empty batches
      if (events.length === 0) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stored: 0 }),
        };
      }

      // Store events with server timestamp
      const integrityEvents = db.collection('integrity_events');
      const eventsToStore = events.map((e: TelemetryEvent) => ({
        sessionId,
        ...e,
        serverReceivedAt: new Date(),
      }));

      await integrityEvents.insertMany(eventsToStore);

      // Update session integrity score for critical events
      const criticalEvents = events.filter(
        (e: TelemetryEvent) => e.type === 'velocity_spike' || e.type === 'rhythm_anomaly'
      );

      if (criticalEvents.length > 0) {
        const sessions = db.collection('sessions');
        // Reduce score by 5 per critical event (minimum 0)
        await sessions.updateOne(
          { sessionId },
          { $inc: { integrityScore: -5 * criticalEvents.length } }
        );
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stored: events.length }),
      };
    } catch (error) {
      console.error('Event storage error:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Internal error' }),
      };
    }
  }

  // GET - Retrieve events for a session (for recruiter dashboard)
  if (event.httpMethod === 'GET') {
    const sessionId = event.queryStringParameters?.sessionId;

    if (!sessionId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'sessionId required' }),
      };
    }

    try {
      const integrityEvents = db.collection('integrity_events');
      const events = await integrityEvents
        .find({ sessionId })
        .sort({ timestamp: -1 })
        .limit(100)
        .toArray();

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events, count: events.length }),
      };
    } catch (error) {
      console.error('Get events error:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to retrieve events' }),
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
