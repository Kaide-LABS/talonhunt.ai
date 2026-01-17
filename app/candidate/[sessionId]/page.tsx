'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { getChallengesForLanguage, getDifficultyColor, type Challenge } from '@/data/challenges';

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
          <button
            onClick={copyReviewerLink}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-md transition-colors"
          >
            {copied ? 'Copied!' : 'Copy Reviewer Link'}
          </button>
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

      <main className="flex-1">
        <CodeEditor
          key={editorKey}
          sessionId={sessionId}
          language={session.language}
          isReadOnly={false}
          initialCode={selectedChallenge?.starterCode}
        />
      </main>
    </div>
  );
}
