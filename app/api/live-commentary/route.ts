import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LiveCommentaryRequest, AIVerdictType, IntegrityEventType } from '@/types';

// Initialize Gemini with gemini-2.0-flash (fast for real-time commentary)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Response interface
interface LiveCommentaryResponse {
  verdict: AIVerdictType;
  summary: string;
  confidence: number;
}

// Event type display names for prompt context
const EVENT_DISPLAY_NAMES: Partial<Record<IntegrityEventType, string>> = {
  velocity_spike: 'superhuman typing speed',
  rhythm_anomaly: 'robotic typing rhythm',
  linearity_alert: 'AI transcription pattern',
  bulk_insert: 'large code injection',
  paste: 'paste detected',
  focus_loss: 'tab switch',
  read_pattern_warning: 'phone/overlay reading pattern',
  suspicious_return: 'memory dump after tab return',
  post_return_burst_suspicious: 'burst typing after return',
  low_undo_ratio: 'unusually low correction rate',
  research_break: 'legitimate doc reading',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as LiveCommentaryRequest;
    const {
      sessionId,
      baselineWPM,
      currentWPM,
      baselineBackspaceRatio,
      currentBackspaceRatio,
      eventType,
      recentEvents,
    } = body;

    if (!sessionId || eventType === undefined) {
      return NextResponse.json(
        { error: 'sessionId and eventType are required' },
        { status: 400 }
      );
    }

    // Build the prompt
    const prompt = buildCommentaryPrompt(
      eventType,
      baselineWPM,
      currentWPM,
      baselineBackspaceRatio,
      currentBackspaceRatio,
      recentEvents
    );

    // Call Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse the response
    const commentary = parseCommentaryResponse(text, eventType);

    return NextResponse.json(commentary);
  } catch (error) {
    console.error('Live commentary API error:', error);

    // Return a fallback response based on trigger type
    return NextResponse.json(getFallbackResponse('heartbeat'));
  }
}

function buildCommentaryPrompt(
  eventType: LiveCommentaryRequest['eventType'],
  baselineWPM: number | null,
  currentWPM: number,
  baselineBackspaceRatio: number | null,
  currentBackspaceRatio: number,
  recentEvents: Array<{ type: IntegrityEventType; timestamp: number }>
): string {
  const baselineContext = baselineWPM !== null
    ? `Baseline: ${Math.round(baselineWPM)} WPM, ${Math.round((baselineBackspaceRatio || 0) * 100)}% corrections`
    : 'Baseline: Not yet established';

  const currentContext = `Current: ${Math.round(currentWPM)} WPM, ${Math.round(currentBackspaceRatio * 100)}% corrections`;

  const eventContext = recentEvents.length > 0
    ? `Recent events: ${recentEvents.map(e => EVENT_DISPLAY_NAMES[e.type] || e.type).join(', ')}`
    : 'No recent suspicious events';

  const triggerDescription = {
    consistency: 'Candidate has been typing consistently within their baseline for 30+ seconds',
    anomaly: 'Candidate typing pattern just deviated significantly from their baseline',
    heartbeat: 'Regular check-in (45 seconds since last analysis)',
  }[eventType];

  return `You are an AI proctoring assistant analyzing a coding interview candidate's typing behavior in real-time.

## CONTEXT
- ${baselineContext}
- ${currentContext}
- ${eventContext}
- Trigger: ${triggerDescription}

## TASK
Provide a brief assessment of the candidate's behavior. Is this natural or suspicious?

## GUIDELINES
- Keep your response under 15 words
- Be objective and factual
- For "consistency" triggers: acknowledge positive behavior
- For "anomaly" triggers: note the deviation without accusation
- For "heartbeat" triggers: brief neutral status update

## RESPONSE FORMAT
Return ONLY a valid JSON object (no markdown, no explanation):

{
  "verdict": "suspicious" | "concerning" | "normal" | "positive",
  "summary": "Your 15-word-or-less assessment",
  "confidence": 50-95
}

Where:
- "suspicious": Strong evidence of AI assistance or cheating
- "concerning": Some unusual patterns worth noting
- "normal": Behavior within expected parameters
- "positive": Actively demonstrates human-like patterns

RESPOND WITH JSON ONLY.`;
}

function parseCommentaryResponse(text: string, eventType: LiveCommentaryRequest['eventType']): LiveCommentaryResponse {
  try {
    // Try direct parse
    const parsed = JSON.parse(text);
    return validateResponse(parsed);
  } catch {
    // Try to find JSON in the text
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return validateResponse(parsed);
      } catch {
        // Fall through
      }
    }
  }

  // Fallback
  return getFallbackResponse(eventType);
}

function validateResponse(parsed: unknown): LiveCommentaryResponse {
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'verdict' in parsed &&
    'summary' in parsed
  ) {
    const p = parsed as Record<string, unknown>;
    const validVerdicts: AIVerdictType[] = ['suspicious', 'concerning', 'normal', 'positive'];

    return {
      verdict: validVerdicts.includes(p.verdict as AIVerdictType)
        ? (p.verdict as AIVerdictType)
        : 'normal',
      summary: typeof p.summary === 'string'
        ? p.summary.slice(0, 100) // Limit length
        : 'Analysis complete.',
      confidence: typeof p.confidence === 'number'
        ? Math.min(95, Math.max(50, p.confidence))
        : 70,
    };
  }

  throw new Error('Invalid response structure');
}

function getFallbackResponse(eventType: LiveCommentaryRequest['eventType']): LiveCommentaryResponse {
  switch (eventType) {
    case 'consistency':
      return {
        verdict: 'positive',
        summary: 'Consistent typing pattern maintained.',
        confidence: 65,
      };
    case 'anomaly':
      return {
        verdict: 'concerning',
        summary: 'Typing pattern change detected.',
        confidence: 60,
      };
    case 'heartbeat':
    default:
      return {
        verdict: 'normal',
        summary: 'Session monitoring active.',
        confidence: 50,
      };
  }
}
