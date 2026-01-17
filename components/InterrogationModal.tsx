'use client';

import { useState, useEffect, useRef } from 'react';

interface InterrogationModalProps {
  isOpen: boolean;
  isAnalyzing: boolean;
  question: string | null;
  onSubmit: (answer: string) => void;
}

export function InterrogationModal({
  isOpen,
  isAnalyzing,
  question,
  onSubmit,
}: InterrogationModalProps) {
  const [answer, setAnswer] = useState('');
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Animate progress bar during analysis
  useEffect(() => {
    if (isAnalyzing) {
      setAnalyzeProgress(0);
      const interval = setInterval(() => {
        setAnalyzeProgress((prev) => {
          // Slow down as we approach 100, never quite reaching it
          const remaining = 95 - prev;
          const increment = remaining * 0.08;
          return Math.min(95, prev + increment);
        });
      }, 100);

      return () => clearInterval(interval);
    } else {
      // Jump to 100% when done analyzing
      setAnalyzeProgress(100);
    }
  }, [isAnalyzing]);

  // Reset answer when modal opens
  useEffect(() => {
    if (isOpen) {
      setAnswer('');
    }
  }, [isOpen]);

  // Focus textarea when question appears
  useEffect(() => {
    if (!isAnalyzing && question && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isAnalyzing, question]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answer.trim()) {
      onSubmit(answer.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {isAnalyzing ? (
          // Analyzing state
          <div className="p-8 text-center">
            <div className="flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-amber-500 animate-pulse"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              AI is analyzing your code...
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Generating verification question
            </p>

            {/* Progress bar */}
            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-100 ease-out"
                style={{ width: `${analyzeProgress}%` }}
              />
            </div>
            <p className="text-gray-500 text-xs mt-2">
              {Math.round(analyzeProgress)}%
            </p>
          </div>
        ) : (
          // Question state
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-700 bg-amber-900/20">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-amber-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <h2 className="text-lg font-semibold text-amber-500">
                  Quick Check
                </h2>
              </div>
            </div>

            {/* Question */}
            <div className="px-6 py-6">
              <p className="text-white text-lg mb-4 leading-relaxed">
                &quot;{question}&quot;
              </p>

              {/* Answer textarea */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer..."
                  className="w-full h-28 px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
                />
              </div>

              <p className="text-gray-500 text-xs mt-2">
                Explain briefly (1-2 sentences). This helps verify your understanding.
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-700 bg-gray-900/50">
              <button
                type="submit"
                disabled={!answer.trim()}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                  answer.trim()
                    ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                Submit Answer
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
