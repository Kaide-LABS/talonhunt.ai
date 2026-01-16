import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { customAlphabet } from 'nanoid';
import type { Session } from '@/types';

// Use alphanumeric only to avoid URL issues
const nanoid = customAlphabet('0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz', 10);

export async function POST(request: NextRequest) {
  try {
    const db = await getDb();
    const sessions = db.collection<Session>('sessions');
    const body = await request.json();
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

    return NextResponse.json({
      ...session,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Create session error:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('id');

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }

  try {
    const db = await getDb();
    const sessions = db.collection<Session>('sessions');
    const session = await sessions.findOne({ sessionId });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...session,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Get session error:', error);
    return NextResponse.json({ error: 'Failed to get session' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const db = await getDb();
    const sessions = db.collection<Session>('sessions');
    const body = await request.json();
    const { sessionId, ...updates } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    const result = await sessions.updateOne(
      { sessionId },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update session error:', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}
