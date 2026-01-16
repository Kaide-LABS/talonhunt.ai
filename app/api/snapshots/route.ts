import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

interface CodeSnapshot {
  sessionId: string;
  code: string;
  cursorPosition?: { line: number; column: number };
  updatedAt: Date;
}

// POST - Save code snapshot
export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const { sessionId, code, cursorPosition } = await request.json();

    if (!sessionId || code === undefined) {
      return NextResponse.json({ error: 'sessionId and code required' }, { status: 400 });
    }

    const snapshots = db.collection<CodeSnapshot>('code_snapshots');

    // Upsert - update if exists, insert if not
    await snapshots.updateOne(
      { sessionId },
      {
        $set: {
          sessionId,
          code,
          cursorPosition,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save snapshot error:', error);
    return NextResponse.json({ error: 'Failed to save snapshot' }, { status: 500 });
  }
}

// GET - Load latest code snapshot
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  try {
    const db = await getDb();
    const snapshots = db.collection<CodeSnapshot>('code_snapshots');
    const snapshot = await snapshots.findOne({ sessionId });

    if (!snapshot) {
      // No snapshot yet - return default
      return NextResponse.json({
        code: '// Start coding here...\n',
        cursorPosition: null,
        exists: false
      });
    }

    return NextResponse.json({
      code: snapshot.code,
      cursorPosition: snapshot.cursorPosition,
      updatedAt: snapshot.updatedAt,
      exists: true,
    });
  } catch (error) {
    console.error('Load snapshot error:', error);
    return NextResponse.json({ error: 'Failed to load snapshot' }, { status: 500 });
  }
}
