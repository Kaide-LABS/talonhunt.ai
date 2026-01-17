import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import type { ReplaySnapshot, ReplaySnapshotTrigger, ActivityAnnotation } from '@/types';

/**
 * Day 5: Classify activity for AI-Annotated Replay
 * Analyzes code changes and events to determine what the candidate was doing
 */
function classifyActivity(
  prevCode: string | undefined,
  currCode: string,
  trigger: ReplaySnapshotTrigger,
  timeDeltaMs: number
): { activity: ActivityAnnotation; confidence: number; reason: string } {
  const codeDelta = currCode.length - (prevCode?.length || 0);

  // Suspicious paste (bulk_insert trigger)
  if (trigger === 'bulk_insert') {
    return {
      activity: 'suspicious_paste',
      confidence: 90,
      reason: 'Large code injection detected',
    };
  }

  // Idle (no change)
  if (codeDelta === 0) {
    return {
      activity: timeDeltaMs > 10000 ? 'thinking' : 'idle',
      confidence: 70,
      reason: timeDeltaMs > 10000 ? 'Extended pause, likely reading/planning' : 'No activity',
    };
  }

  // Debugging (deletions)
  if (codeDelta < -10) {
    return {
      activity: 'debugging',
      confidence: 75,
      reason: `Removed ${Math.abs(codeDelta)} characters`,
    };
  }

  // Large additions without corresponding time = suspicious
  if (codeDelta > 100 && timeDeltaMs < 5000) {
    return {
      activity: 'suspicious_paste',
      confidence: 70,
      reason: `Added ${codeDelta} chars in ${Math.round(timeDeltaMs / 1000)}s (fast)`,
    };
  }

  // Coding (additions)
  return {
    activity: 'coding',
    confidence: 80,
    reason: `Added ${codeDelta} characters`,
  };
}

// POST - Save a replay snapshot (from candidate)
export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const { sessionId, code, cursorPosition, trigger } = await request.json() as {
      sessionId: string;
      code: string;
      cursorPosition?: { line: number; column: number };
      trigger: ReplaySnapshotTrigger;
    };

    if (!sessionId || code === undefined || !trigger) {
      return NextResponse.json(
        { error: 'sessionId, code, and trigger are required' },
        { status: 400 }
      );
    }

    const snapshots = db.collection<ReplaySnapshot>('replay_snapshots');

    // Get the previous snapshot for comparison
    const lastSnapshot = await snapshots
      .find({ sessionId })
      .sort({ sequenceNumber: -1 })
      .limit(1)
      .toArray();

    const sequenceNumber = lastSnapshot.length > 0
      ? lastSnapshot[0].sequenceNumber + 1
      : 0;

    // Calculate metadata
    const lines = code.split('\n');
    const charCount = code.length;
    const lineCount = lines.length;

    // Day 5: Classify activity for annotation
    const prevCode = lastSnapshot.length > 0 ? lastSnapshot[0].code : undefined;
    const prevTimestamp = lastSnapshot.length > 0 ? lastSnapshot[0].timestamp : Date.now();
    const timeDeltaMs = Date.now() - prevTimestamp;
    const annotation = classifyActivity(prevCode, code, trigger, timeDeltaMs);

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
      annotation, // Day 5: AI activity annotation
    };

    await snapshots.insertOne(newSnapshot);

    return NextResponse.json({
      success: true,
      sequenceNumber,
      annotation, // Return annotation for debugging
    });
  } catch (error) {
    console.error('Save replay snapshot error:', error);
    return NextResponse.json(
      { error: 'Failed to save replay snapshot' },
      { status: 500 }
    );
  }
}

// GET - Retrieve all snapshots for a session (for replay)
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'sessionId is required' },
      { status: 400 }
    );
  }

  try {
    const db = await getDb();
    const snapshots = db.collection<ReplaySnapshot>('replay_snapshots');

    const allSnapshots = await snapshots
      .find({ sessionId })
      .sort({ sequenceNumber: 1 })
      .toArray();

    return NextResponse.json({
      snapshots: allSnapshots,
      count: allSnapshots.length,
    });
  } catch (error) {
    console.error('Get replay snapshots error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve replay snapshots' },
      { status: 500 }
    );
  }
}
