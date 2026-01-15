'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState('javascript');

  const createSession = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });

      if (!response.ok) throw new Error('Failed to create session');

      const data = await response.json();
      router.push(`/candidate/${data.sessionId}`);
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Failed to create session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">TalonHunt</h1>
          <p className="text-gray-400">
            Live coding interviews with real-time integrity tracking
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 space-y-6">
          <div>
            <label
              htmlFor="language"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Programming Language
            </label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
              <option value="go">Go</option>
              <option value="rust">Rust</option>
            </select>
          </div>

          <button
            onClick={createSession}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-md transition-colors"
          >
            {loading ? 'Creating Session...' : 'Start New Session'}
          </button>
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>Sessions expire after 1 hour</p>
        </div>
      </div>
    </div>
  );
}
