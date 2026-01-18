import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { VisualSnapshot } from '@/types';

// Initialize Gemini with gemini-1.5-flash (fast for demos)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Analysis response interface
interface AIAnalysis {
  verdict: 'High Risk' | 'Medium Risk' | 'Low Risk';
  confidence: 'High' | 'Medium' | 'Low';
  confidenceScore: number;  // Day 5: 0-100 percentage
  summary: string;
  key_evidence: string[];
}

// Demo mode mock response
const DEMO_RESPONSE: AIAnalysis = {
  verdict: 'Medium Risk',
  confidence: 'Medium',
  confidenceScore: 78,  // Day 5: Percentage confidence
  summary: 'The session shows several behavioral anomalies consistent with external assistance. Multiple bulk insertions and rhythm irregularities suggest possible use of code completion tools or reference materials.',
  key_evidence: [
    'Multiple bulk_insert events detected (>20 characters appearing without keystrokes)',
    'Low variance in typing rhythm suggests robotic/transcription pattern',
    'Tab switches followed by immediate typing bursts indicate copy-paste workflow',
  ],
};

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    // Demo mode fallback (guaranteed to work during pitch)
    if (process.env.DEMO_MODE === 'true') {
      // Add slight delay to simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      return NextResponse.json(DEMO_RESPONSE);
    }

    // Fetch session data
    const db = await getDb();
    const sessionDoc = await db.collection('sessions').findOne({ sessionId });

    if (!sessionDoc) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const session = {
      integrityScore: (sessionDoc.integrityScore as number) ?? 100,
      language: (sessionDoc.language as string) ?? 'javascript',
    };

    // Fetch events
    const eventDocs = await db.collection('integrity_events')
      .find({ sessionId })
      .sort({ timestamp: 1 })
      .limit(200)
      .toArray();

    const events = eventDocs.map(e => ({
      type: e.type as string,
      timestamp: e.timestamp as number,
      data: e.data as Record<string, unknown> | undefined,
    }));

    // Fetch latest code snapshot
    const snapshot = await db.collection('code_snapshots')
      .findOne({ sessionId }, { sort: { timestamp: -1 } });

    // Build the forensic prompt
    const forensicPrompt = buildForensicPrompt(session, events, snapshot?.code as string | undefined);

    // Call Gemini 2.0 Flash
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent(forensicPrompt);
    const response = result.response;
    const text = response.text();

    // Parse JSON response with fallback
    const analysis = parseAnalysisResponse(text);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);

    // Return fallback response on error
    return NextResponse.json({
      verdict: 'Medium Risk',
      confidence: 'Low',
      summary: 'Analysis could not be completed. Please review the event timeline manually.',
      key_evidence: ['AI analysis unavailable - manual review recommended'],
    });
  }
}

function buildForensicPrompt(
  session: { integrityScore: number; language: string },
  events: Array<{ type: string; timestamp: number; data?: Record<string, unknown> }>,
  code?: string
): string {
  // Count events by type
  const eventCounts: Record<string, number> = {};
  for (const event of events) {
    eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
  }

  // Format event timeline (last 50 events)
  const recentEvents = events.slice(-50).map(e => {
    const time = new Date(e.timestamp).toISOString().slice(11, 19);
    const dataStr = e.data ? ` | ${JSON.stringify(e.data)}` : '';
    return `[${time}] ${e.type}${dataStr}`;
  }).join('\n');

  return `You are a forensic analyst reviewing a live coding interview session for signs of cheating (AI assistance tools like Cluely, Interview Coder, ChatGPT transcription).

## EVENT DICTIONARY (Critical Context - Read Carefully!)

These events were captured by our integrity tracking system. Understanding their meanings is CRITICAL:

- **velocity_spike**: Keystroke interval <30ms (faster than humanly possible) - SUSPICIOUS (indicates bot/macro)
- **linearity_alert**: 95%+ linear cursor movement without backspaces - SUSPICIOUS (AI transcription pattern - humans make mistakes)
- **rhythm_anomaly**: Low variance in typing rhythm - SUSPICIOUS (robotic/transcription pattern - humans have natural rhythm variation)
- **bulk_insert**: >20 characters appeared without individual keystrokes - SUSPICIOUS (code injection from external source)
- **read_pattern_warning**: Regular oscillation pattern (type 15 chars, pause 1.5s, repeat) - SUSPICIOUS (reading from phone/overlay)
- **suspicious_return**: <1000ms latency after tab switch before typing resumes (memory dump pattern) - BAD (indicates pre-copied ChatGPT response)
- **focus_loss**: Tab switch detected - NEUTRAL (checking documentation is normal developer behavior!)
- **research_break**: >2000ms cognitive pause after returning from tab switch - GOOD (legitimate research/understanding)
- **paste**: Clipboard paste detected - MINOR (pasting small snippets is normal)

## SESSION DATA

**Integrity Score**: ${session.integrityScore}/100
**Language**: ${session.language}
**Total Events**: ${events.length}

**Event Counts**:
${Object.entries(eventCounts).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

**Recent Event Timeline**:
${recentEvents}

${code ? `**Code Length**: ${code.length} characters` : ''}

## YOUR TASK

Analyze this session and provide a risk assessment. Consider:
1. Are the suspicious events clustered or isolated?
2. Do the patterns suggest systematic cheating or normal developer behavior?
3. What is the overall integrity picture?

IMPORTANT: Use cautious language. You're providing risk assessment, not accusations. Terms like "suggests", "indicates", "consistent with" are appropriate.

## RESPONSE FORMAT

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation outside JSON):

{
  "verdict": "High Risk" | "Medium Risk" | "Low Risk",
  "confidence": "High" | "Medium" | "Low",
  "confidenceScore": 0-100,
  "summary": "2-3 sentence executive summary for a recruiter",
  "key_evidence": ["Evidence point 1", "Evidence point 2", "Evidence point 3"]
}

The confidenceScore should be a precise percentage (0-100) representing your confidence in the verdict. Use:
- 85-100: Very high confidence (clear evidence)
- 60-84: Moderate confidence (suggestive patterns)
- 30-59: Low confidence (ambiguous signals)
- 0-29: Very low confidence (insufficient data)`;
}

function parseAnalysisResponse(text: string): AIAnalysis {
  // Try to extract JSON from the response
  try {
    // First try direct parse
    const parsed = JSON.parse(text);
    return validateAnalysis(parsed);
  } catch {
    // Try to find JSON in the text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return validateAnalysis(parsed);
      } catch {
        // Fall through to fallback
      }
    }
  }

  // Fallback: create response from raw text
  return {
    verdict: 'Medium Risk',
    confidence: 'Low',
    confidenceScore: 50,
    summary: text.slice(0, 300) || 'Analysis completed but response format was unexpected.',
    key_evidence: ['Raw analysis available - structured parsing failed'],
  };
}

// Map confidence level to score if not provided
function mapConfidenceToScore(confidence: string): number {
  switch (confidence) {
    case 'High': return 85;
    case 'Medium': return 60;
    case 'Low': return 35;
    default: return 50;
  }
}

function validateAnalysis(parsed: unknown): AIAnalysis {
  // Type guard and validation
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'verdict' in parsed &&
    'confidence' in parsed &&
    'summary' in parsed &&
    'key_evidence' in parsed
  ) {
    const p = parsed as Record<string, unknown>;
    const confidence = (['High', 'Medium', 'Low'].includes(p.confidence as string)
      ? p.confidence
      : 'Medium') as AIAnalysis['confidence'];

    return {
      verdict: (['High Risk', 'Medium Risk', 'Low Risk'].includes(p.verdict as string)
        ? p.verdict
        : 'Medium Risk') as AIAnalysis['verdict'],
      confidence,
      confidenceScore: typeof p.confidenceScore === 'number'
        ? Math.max(0, Math.min(100, Math.round(p.confidenceScore)))
        : mapConfidenceToScore(confidence),
      summary: typeof p.summary === 'string' ? p.summary : 'Analysis completed.',
      key_evidence: Array.isArray(p.key_evidence)
        ? p.key_evidence.map(e => String(e))
        : ['See event timeline for details'],
    };
  }

  throw new Error('Invalid analysis structure');
}
