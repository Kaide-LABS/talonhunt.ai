import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini with gemini-2.0-flash (fast for real-time interaction)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Response interface
interface InterrogationQuestion {
  question: string;
  questionType: 'explain_code' | 'explain_choice' | 'complexity' | 'debug';
  targetLine: number | null;
}

// Fallback questions when Gemini fails
const FALLBACK_QUESTIONS: InterrogationQuestion[] = [
  { question: 'Can you explain your approach here?', questionType: 'explain_code', targetLine: null },
  { question: 'Why did you choose this implementation?', questionType: 'explain_choice', targetLine: null },
  { question: 'What is the time complexity of this code?', questionType: 'complexity', targetLine: null },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      triggerType,
      code,
      insertedCode,
      language,
      challengeTitle
    } = body;

    if (!sessionId || !code || !language) {
      return NextResponse.json(
        { error: 'sessionId, code, and language are required' },
        { status: 400 }
      );
    }

    // Build the prompt based on trigger type
    const prompt = buildInterrogationPrompt(
      triggerType,
      code,
      insertedCode,
      language,
      challengeTitle
    );

    // Call Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse the response
    const question = parseInterrogationResponse(text);

    return NextResponse.json(question);
  } catch (error) {
    console.error('Interrogation API error:', error);

    // Return a fallback question on error
    const fallback = FALLBACK_QUESTIONS[Math.floor(Math.random() * FALLBACK_QUESTIONS.length)];
    return NextResponse.json(fallback);
  }
}

function buildInterrogationPrompt(
  triggerType: 'bulk_insert' | 'suspicious_return',
  code: string,
  insertedCode: string | null,
  language: string,
  challengeTitle?: string
): string {
  const challengeContext = challengeTitle
    ? `\n**Challenge**: ${challengeTitle}`
    : '';

  const insertedContext = insertedCode
    ? `\n**Injected Code (just pasted):**\n\`\`\`${language}\n${insertedCode}\n\`\`\``
    : '';

  return `You are a technical interviewer conducting a live coding interview. The candidate just triggered a suspicious event (${triggerType}).

You need to generate ONE quick verification question to check if they understand the code they just wrote/pasted.
${challengeContext}
${insertedContext}

**Full Solution:**
\`\`\`${language}
${code}
\`\`\`

## REQUIREMENTS

Generate ONE short, probing question (maximum 15 words) to verify the candidate understands the code.

Question types to choose from:
- **explain_code**: Ask them to explain what a specific part does
- **explain_choice**: Ask why they chose a specific approach/data structure
- **complexity**: Ask about time/space complexity
- **debug**: Ask what would happen if given specific input

## GUIDELINES

- Be specific - reference actual variables, functions, or lines from their code
- Keep it conversational, not accusatory
- The question should be answerable in 1-2 sentences if they wrote the code
- Focus on the most "interesting" or non-trivial part of the code
${insertedCode ? '- Prioritize questions about the INJECTED code section' : ''}

## RESPONSE FORMAT

Return ONLY a valid JSON object (no markdown, no explanation):

{
  "question": "Your question here (max 15 words)?",
  "questionType": "explain_code" | "explain_choice" | "complexity" | "debug",
  "targetLine": null
}

RESPOND WITH JSON ONLY.`;
}

function parseInterrogationResponse(text: string): InterrogationQuestion {
  try {
    // Try direct parse
    const parsed = JSON.parse(text);
    return validateQuestion(parsed);
  } catch {
    // Try to find JSON in the text
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return validateQuestion(parsed);
      } catch {
        // Fall through
      }
    }
  }

  // Fallback
  return FALLBACK_QUESTIONS[0];
}

function validateQuestion(parsed: unknown): InterrogationQuestion {
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'question' in parsed &&
    'questionType' in parsed
  ) {
    const p = parsed as Record<string, unknown>;
    const validTypes = ['explain_code', 'explain_choice', 'complexity', 'debug'];

    return {
      question: typeof p.question === 'string'
        ? p.question
        : 'Can you explain your approach?',
      questionType: validTypes.includes(p.questionType as string)
        ? (p.questionType as InterrogationQuestion['questionType'])
        : 'explain_code',
      targetLine: typeof p.targetLine === 'number' ? p.targetLine : null,
    };
  }

  throw new Error('Invalid question structure');
}
