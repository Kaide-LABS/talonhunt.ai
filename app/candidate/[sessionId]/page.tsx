'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { InterrogationModal } from '@/components/InterrogationModal';
import { getChallengesForLanguage, getDifficultyColor, type Challenge } from '@/data/challenges';
import { useWebcamTelemetry } from '@/hooks/useWebcamTelemetry';
import type { VisualSnapshotTrigger } from '@/types';

interface Session {
  sessionId: string;
  language: string;
  status: string;
}

export default function CandidatePage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [editorKey, setEditorKey] = useState(0); // Key to force CodeEditor remount

  // Day 5: Auto-interrogation state
  const [isInterrogating, setIsInterrogating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [interrogationQuestion, setInterrogationQuestion] = useState<string | null>(null);
  const [editorLocked, setEditorLocked] = useState(false);
  const interrogationCountRef = useRef(0);
  const lastInsertedCodeRef = useRef<string | null>(null);
  const currentCodeRef = useRef<string>('');

  // Phase 2: Webcam telemetry for visual snapshots
  const {
    hasPermission: hasCameraPermission,
    permissionDenied: cameraPermissionDenied,
    snapshotCount,
    captureSnapshot,
    isCapped: snapshotsCapped,
  } = useWebcamTelemetry({
    sessionId,
    enabled: !!session, // Only enable after session loads
  });

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/sessions?id=${sessionId}`);
        if (!response.ok) {
          throw new Error('Session not found');
        }
        const data = await response.json();
        setSession(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session');
      }
    };

    fetchSession();
  }, [sessionId]);

  const copyReviewerLink = () => {
    const reviewerUrl = `${window.location.origin}/review/${sessionId}`;
    navigator.clipboard.writeText(reviewerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleChallengeSelect = async (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    setIsDropdownOpen(false);
    setEditorKey((prev) => prev + 1); // Force CodeEditor remount with new code

    // Log challenge_selected event
    console.log('[CandidatePage] Logging challenge_selected:', challenge.id);
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          events: [
            {
              type: 'challenge_selected',
              timestamp: Date.now(),
              data: {
                challengeId: challenge.id,
                challengeTitle: challenge.title,
                difficulty: challenge.difficulty,
              },
            },
          ],
        }),
      });
      console.log('[CandidatePage] challenge_selected response:', response.status);
    } catch (err) {
      console.error('Failed to log challenge_selected event:', err);
    }
  };

  // Get available challenges for this session's language
  const availableChallenges = session ? getChallengesForLanguage(session.language) : [];

  // Day 5: Handle suspicious insert detection (bulk_insert or suspicious_return)
  const handleSuspiciousInsert = useCallback(async (
    triggerType: 'bulk_insert' | 'suspicious_return',
    insertedCode: string | null
  ) => {
    // Phase 2: Capture webcam snapshot on suspicious events
    if (hasCameraPermission && !snapshotsCapped) {
      console.log('[Webcam] Capturing snapshot for suspicious event:', triggerType);
      captureSnapshot(triggerType as VisualSnapshotTrigger);
    }

    // Rate limit: max 3 interrogations per session
    if (interrogationCountRef.current >= 3) {
      console.log('[Interrogation] Rate limit reached, skipping');
      return;
    }

    // Don't trigger if already interrogating
    if (isInterrogating) {
      console.log('[Interrogation] Already interrogating, skipping');
      return;
    }

    console.log('[Interrogation] Triggered:', triggerType, 'insertedCode length:', insertedCode?.length);

    // Store the inserted code for the API call
    lastInsertedCodeRef.current = insertedCode;

    // Lock editor and start interrogation
    setEditorLocked(true);
    setIsInterrogating(true);
    setIsAnalyzing(true);
    interrogationCountRef.current += 1;

    // Log interrogation_triggered event
    try {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          events: [{
            type: 'interrogation_triggered',
            timestamp: Date.now(),
            data: {
              triggerType,
              insertedCodeLength: insertedCode?.length || 0,
              interrogationNumber: interrogationCountRef.current,
            },
          }],
        }),
      });
    } catch (err) {
      console.error('Failed to log interrogation_triggered:', err);
    }

    // Minimum 2.5s delay + API call in parallel for tension
    try {
      const [, response] = await Promise.all([
        new Promise(resolve => setTimeout(resolve, 2500)),
        fetch('/api/interrogate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            triggerType,
            code: currentCodeRef.current,
            insertedCode,
            language: session?.language || 'python',
            challengeTitle: selectedChallenge?.title,
          }),
        }),
      ]);

      const data = await response.json();
      setIsAnalyzing(false);
      setInterrogationQuestion(data.question);
    } catch (err) {
      console.error('Failed to get interrogation question:', err);
      setIsAnalyzing(false);
      setInterrogationQuestion('Please explain your approach here.');
    }
  }, [sessionId, session?.language, selectedChallenge?.title, isInterrogating, hasCameraPermission, snapshotsCapped, captureSnapshot]);

  // Day 5: Track current code for interrogation API
  const handleCodeChange = useCallback((code: string) => {
    currentCodeRef.current = code;
  }, []);

  // Day 5: Handle interrogation answer submission
  const handleInterrogationAnswer = useCallback(async (answer: string) => {
    console.log('[Interrogation] Answer submitted:', answer.slice(0, 50));

    // Log interrogation_completed event with Q&A
    try {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          events: [{
            type: 'interrogation_completed',
            timestamp: Date.now(),
            data: {
              question: interrogationQuestion,
              answer,
              interrogationNumber: interrogationCountRef.current,
              insertedCodeLength: lastInsertedCodeRef.current?.length || 0,
            },
          }],
        }),
      });
    } catch (err) {
      console.error('Failed to log interrogation_completed:', err);
    }

    // Reset interrogation state
    setIsInterrogating(false);
    setInterrogationQuestion(null);
    setEditorLocked(false);
    lastInsertedCodeRef.current = null;
  }, [sessionId, interrogationQuestion]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-2">Error</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4" />
          <p className="text-gray-400">Loading session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-semibold">Candidate Session</h1>
            <p className="text-sm text-gray-400">
              Session: {sessionId} | Language: {session.language}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Camera status indicator - minimal, no counts shown */}
            {cameraPermissionDenied ? (
              <span className="text-xs text-yellow-500 flex items-center gap-1">
                <span>📷</span> Camera denied
              </span>
            ) : hasCameraPermission ? (
              <span className="text-xs text-green-500 flex items-center gap-1">
                <span>📷</span> Monitoring
              </span>
            ) : (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <span>📷</span> Requesting...
              </span>
            )}
            <button
              onClick={copyReviewerLink}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-md transition-colors"
            >
              {copied ? 'Copied!' : 'Copy Reviewer Link'}
            </button>
          </div>
        </div>

        {/* Challenge Selector */}
        {availableChallenges.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded-md transition-colors"
            >
              <span>
                {selectedChallenge ? (
                  <>
                    {selectedChallenge.title}{' '}
                    <span className={getDifficultyColor(selectedChallenge.difficulty)}>
                      ({selectedChallenge.difficulty})
                    </span>
                  </>
                ) : (
                  'Select Challenge'
                )}
              </span>
              <svg
                className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 bg-gray-700 border border-gray-600 rounded-md shadow-lg z-50 min-w-[250px]">
                {availableChallenges.map((challenge) => (
                  <button
                    key={challenge.id}
                    onClick={() => handleChallengeSelect(challenge)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-600 transition-colors first:rounded-t-md last:rounded-b-md ${
                      selectedChallenge?.id === challenge.id ? 'bg-gray-600' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{challenge.title}</span>
                      <span className={`text-xs ${getDifficultyColor(challenge.difficulty)}`}>
                        {challenge.difficulty}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                      {challenge.description.split('\n')[0]}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 relative">
        <CodeEditor
          key={editorKey}
          sessionId={sessionId}
          language={session.language}
          isReadOnly={editorLocked}
          initialCode={selectedChallenge?.starterCode}
          onSuspiciousInsert={handleSuspiciousInsert}
          onCodeChange={handleCodeChange}
        />

        {/* Day 5: Auto-Interrogation Modal */}
        <InterrogationModal
          isOpen={isInterrogating}
          isAnalyzing={isAnalyzing}
          question={interrogationQuestion}
          onSubmit={handleInterrogationAnswer}
        />
      </main>
    </div>
  );
}
