import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import type { VisualSnapshot, VisualSnapshotTrigger } from '@/types';

const MAX_SNAPSHOTS_PER_SESSION = 30;

// POST - Save a visual snapshot (from candidate webcam)
export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const { sessionId, imageData, trigger } = await request.json() as {
      sessionId: string;
      imageData: string;
      trigger: VisualSnapshotTrigger;
    };

    if (!sessionId || !imageData || !trigger) {
      return NextResponse.json(
        { error: 'sessionId, imageData, and trigger are required' },
        { status: 400 }
      );
    }

    // Validate imageData is base64
    if (!imageData.startsWith('data:image/jpeg;base64,') && !imageData.startsWith('/9j/')) {
      return NextResponse.json(
        { error: 'imageData must be a valid JPEG base64 string' },
        { status: 400 }
      );
    }

    const snapshots = db.collection<VisualSnapshot>('visual_snapshots');

    // Check current snapshot count for this session
    const currentCount = await snapshots.countDocuments({ sessionId });

    if (currentCount >= MAX_SNAPSHOTS_PER_SESSION) {
      return NextResponse.json({
        success: false,
        reason: 'max_snapshots_reached',
        count: currentCount,
      });
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

    return NextResponse.json({
      success: true,
      sequenceNumber,
      count: currentCount + 1,
      remaining: MAX_SNAPSHOTS_PER_SESSION - currentCount - 1,
    });
  } catch (error) {
    console.error('Save visual snapshot error:', error);
    return NextResponse.json(
      { error: 'Failed to save visual snapshot' },
      { status: 500 }
    );
  }
}

// GET - Retrieve all visual snapshots for a session (for review page)
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
    const snapshots = db.collection<VisualSnapshot>('visual_snapshots');

    const allSnapshots = await snapshots
      .find({ sessionId })
      .sort({ sequenceNumber: 1 })
      .toArray();

    return NextResponse.json({
      snapshots: allSnapshots,
      count: allSnapshots.length,
    });
  } catch (error) {
    console.error('Get visual snapshots error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve visual snapshots' },
      { status: 500 }
    );
  }
}
