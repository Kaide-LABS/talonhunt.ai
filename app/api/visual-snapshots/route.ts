import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Ably from 'ably';
import { getDb } from '@/lib/mongodb';
import type { VisualSnapshot, VisualSnapshotTrigger, AIVerdictMessage, AIVerdictType } from '@/types';

const MAX_SNAPSHOTS_PER_SESSION = 100;

// Initialize Gemini for Vision analysis
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Initialize Ably for publishing visual anomaly verdicts
const ablyApiKey = process.env.ABLY_API_KEY || '';

// Phase 3: Risk keywords that trigger immediate verdict
const RISK_KEYWORDS = ['phone', 'second person', 'away', 'diverted', 'not present', 'looking', 'distracted', 'empty'];

// Phase 3: Analyze webcam snapshot with Gemini Vision (async, non-blocking)
async function analyzeWebcamSnapshot(
  sessionId: string,
  snapshotId: string,
  imageData: string
): Promise<void> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Prepare the image for Gemini
    const base64Data = imageData.startsWith('data:image/jpeg;base64,')
      ? imageData.replace('data:image/jpeg;base64,', '')
      : imageData;

    const prompt = `Analyze this webcam frame for proctoring during a coding interview. Check for:
1. Gaze direction - is the person looking at their screen or away?
2. Suspicious objects - is there a phone, second monitor, or another person visible?
3. Presence - is the chair empty or is someone there?

Return a 1-sentence risk assessment in this exact format:
RISK: [none/low/medium/high] - [brief explanation]

Examples:
- "RISK: none - Candidate focused on screen, normal interview posture"
- "RISK: high - Phone visible in hand, eyes looking down at device"
- "RISK: medium - Eyes diverted to the left for extended period"`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data,
        },
      },
    ]);

    const response = result.response;
    const analysis = response.text().trim();

    console.log('[Vision Analysis] Snapshot result:', analysis);

    // Update the snapshot with AI analysis
    const db = await getDb();
    const snapshots = db.collection<VisualSnapshot>('visual_snapshots');
    await snapshots.updateOne(
      { sessionId, sequenceNumber: parseInt(snapshotId) },
      { $set: { aiAnalysis: analysis } }
    );

    // Check if risk detected and publish verdict to Ably
    const lowerAnalysis = analysis.toLowerCase();
    const hasRisk = RISK_KEYWORDS.some(keyword => lowerAnalysis.includes(keyword)) ||
                    lowerAnalysis.includes('risk: high') ||
                    lowerAnalysis.includes('risk: medium');

    if (hasRisk && ablyApiKey) {
      const ably = new Ably.Rest(ablyApiKey);
      // Use the main session channel, not a separate ai_verdict channel
      const channel = ably.channels.get(`session:${sessionId}`);

      // Determine verdict type based on risk level
      let verdictType: AIVerdictType = 'concerning';
      if (lowerAnalysis.includes('risk: high')) {
        verdictType = 'suspicious';
      } else if (lowerAnalysis.includes('risk: none')) {
        verdictType = 'normal';
      }

      const verdict: AIVerdictMessage = {
        timestamp: Date.now(),
        verdict: verdictType,
        eventType: 'visual_anomaly',
        summary: `Visual: ${analysis.replace(/^RISK:\s*\w+\s*-\s*/i, '')}`,
        confidence: verdictType === 'suspicious' ? 80 : 60,
      };

      await channel.publish('ai_verdict', verdict);
      console.log('[Vision Analysis] Published visual anomaly verdict:', verdictType);
    }
  } catch (error) {
    console.error('[Vision Analysis] Error:', error);
    // Don't throw - this is async and shouldn't block the snapshot upload
  }
}

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

    // Phase 3: Trigger async Vision analysis (non-blocking)
    // Don't await - let it run in the background
    analyzeWebcamSnapshot(sessionId, String(sequenceNumber), imageData).catch((err) => {
      console.error('[Vision Analysis] Background analysis failed:', err);
    });

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
