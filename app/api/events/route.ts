import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import type { IntegrityEventBatch, TelemetryEvent, IntegrityEventType } from '@/types';

// Per-event score impacts (negative values reduce, positive values increase)
// NOTE: focus_loss is set to 0 because:
// 1. Tab switching is NORMAL developer behavior (checking docs, Stack Overflow)
// 2. Cluely/Interview Coder use OVERLAYS - they DON'T trigger focus_loss
// 3. Penalizing focus_loss punishes legitimate behavior while missing cheaters
//
// Day 4: Added oscillation detection and return signature analysis
// research_break is a POSITIVE signal - rewards legitimate doc reading
const SCORE_IMPACT: Record<IntegrityEventType, number> = {
  paste: -2,
  focus_loss: 0,              // No penalty - actually indicates legitimate behavior
  velocity_spike: -5,         // Physical impossibility (bot/macro)
  rhythm_anomaly: -10,        // Statistical improbability (bot/transcription)
  linearity_alert: -15,       // Behavioral improbability (AI transcription)
  bulk_insert: -10,           // Code injection attack
  read_pattern_warning: -8,   // Day 4: Phone/overlay cheating (oscillation)
  suspicious_return: -10,     // Day 4: ChatGPT memory dump pattern
  research_break: +5,         // Day 4: Legitimate doc reading (BONUS!)
  telemetry_heartbeat: 0,     // Day 5: Activity heartbeat for Pulse Graph (neutral)
  challenge_selected: 0,      // Day 5: Challenge selection (neutral - just metadata)
};

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const { sessionId, events } = (await request.json()) as IntegrityEventBatch;

    if (!sessionId || !events || !Array.isArray(events)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    if (events.length === 0) {
      return NextResponse.json({ stored: 0 });
    }

    // Store events with server timestamp
    const integrityEvents = db.collection('integrity_events');
    const eventsToStore = events.map((e: TelemetryEvent) => ({
      sessionId,
      ...e,
      serverReceivedAt: new Date(),
    }));

    await integrityEvents.insertMany(eventsToStore);

    // Calculate total score impact
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

    return NextResponse.json({ stored: events.length });
  } catch (error) {
    console.error('Event storage error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  try {
    const db = await getDb();
    const integrityEvents = db.collection('integrity_events');
    const events = await integrityEvents
      .find({ sessionId })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json({ events, count: events.length });
  } catch (error) {
    console.error('Get events error:', error);
    return NextResponse.json({ error: 'Failed to retrieve events' }, { status: 500 });
  }
}
