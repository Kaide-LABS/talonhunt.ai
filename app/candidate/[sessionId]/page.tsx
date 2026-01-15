'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CodeEditor } from '@/components/editor/CodeEditor';

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
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
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
      </header>
      <main className="flex-1">
        <CodeEditor
          sessionId={sessionId}
          language={session.language}
          isReadOnly={false}
        />
      </main>
    </div>
  );
}
