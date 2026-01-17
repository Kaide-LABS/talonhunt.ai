import type { Handler } from '@netlify/functions';
import { getDb } from '../../lib/mongodb';
import type { IntegrityEventBatch, TelemetryEvent, IntegrityEventType } from '../../types';

// Per-event score impacts (negative values reduce, positive values increase)
// NOTE: focus_loss is set to 0 because:
// 1. Tab switching is NORMAL developer behavior (checking docs, Stack Overflow)
// 2. Cluely/Interview Coder use OVERLAYS - they DON'T trigger focus_loss
// 3. Penalizing focus_loss punishes legitimate behavior while missing cheaters
//
// Day 4: Added oscillation detection and return signature analysis
// Day 5: Added post-return burst analysis and undo ratio
// research_break is a POSITIVE signal - rewards legitimate doc reading
const SCORE_IMPACT: Record<IntegrityEventType, number> = {
  paste: -2,
  focus_loss: 0,                      // No penalty - actually indicates legitimate behavior
  velocity_spike: -5,                 // Physical impossibility (bot/macro)
  rhythm_anomaly: -10,                // Statistical improbability (bot/transcription)
  linearity_alert: -15,               // Behavioral improbability (AI transcription)
  bulk_insert: -10,                   // Code injection attack
  read_pattern_warning: -8,           // Day 4: Phone/overlay cheating (oscillation)
  suspicious_return: -10,             // Day 4: ChatGPT memory dump pattern
  research_break: +5,                 // Day 4: Legitimate doc reading (BONUS!)
  telemetry_heartbeat: 0,             // Day 5: Activity heartbeat for Pulse Graph (neutral)
  challenge_selected: 0,              // Day 5: Challenge selection (neutral - just metadata)
  interrogation_triggered: 0,         // Day 5: Auto-interrogation started (neutral - metadata)
  interrogation_completed: 0,         // Day 5: Auto-interrogation answered (neutral - recruiter judges)
  post_return_burst_suspicious: -8,   // Day 5: Memory dump typing pattern (not definitive)
  low_undo_ratio: -5,                 // Day 5: Suspiciously clean typing (warning signal)
};

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

      // Calculate total score impact from all events
      let totalScoreImpact = 0;
      for (const e of events) {
        totalScoreImpact += SCORE_IMPACT[e.type] ?? 0;
      }

      // Update session integrity score
      if (totalScoreImpact !== 0) {
        const sessions = db.collection('sessions');
        await sessions.updateOne(
          { sessionId },
          { $inc: { integrityScore: totalScoreImpact } }
        );
        // Clamp score to 0-100 range
        await sessions.updateOne(
          { sessionId, integrityScore: { $lt: 0 } },
          { $set: { integrityScore: 0 } }
        );
        await sessions.updateOne(
          { sessionId, integrityScore: { $gt: 100 } },
          { $set: { integrityScore: 100 } }
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
