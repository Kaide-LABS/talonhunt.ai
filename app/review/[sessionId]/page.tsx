'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CodeEditor } from '@/components/editor/CodeEditor';

interface Session {
  sessionId: string;
  language: string;
  status: string;
  integrityScore: number;
}

export default function ReviewPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Reviewer Dashboard</h1>
          <p className="text-sm text-gray-400">
            Session: {sessionId} | Language: {session.language}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-gray-400">Integrity Score</p>
            <p className={`text-2xl font-bold ${getScoreColor(session.integrityScore)}`}>
              {session.integrityScore}
            </p>
          </div>
          <div
            className={`px-3 py-1 rounded-full text-sm ${
              session.status === 'active'
                ? 'bg-green-900 text-green-300'
                : 'bg-gray-700 text-gray-300'
            }`}
          >
            {session.status}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <CodeEditor
          sessionId={sessionId}
          language={session.language}
          isReadOnly={true}
        />
      </main>
    </div>
  );
}
