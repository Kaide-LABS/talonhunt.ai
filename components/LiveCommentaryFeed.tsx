'use client';

import { useEffect, useRef } from 'react';
import type { AIVerdictMessage, AIVerdictType } from '@/types';

interface LiveCommentaryFeedProps {
  verdicts: AIVerdictMessage[];
  maxItems?: number;
}

function getVerdictColor(verdict: AIVerdictType): string {
  switch (verdict) {
    case 'suspicious':
      return 'border-red-500 bg-red-900/30 text-red-200';
    case 'concerning':
      return 'border-yellow-500 bg-yellow-900/30 text-yellow-200';
    case 'positive':
      return 'border-green-500 bg-green-900/30 text-green-200';
    case 'normal':
    default:
      return 'border-gray-500 bg-gray-800/50 text-gray-300';
  }
}

function getVerdictIcon(verdict: AIVerdictType): string {
  switch (verdict) {
    case 'suspicious':
      return '🚨';
    case 'concerning':
      return '⚠️';
    case 'positive':
      return '✅';
    case 'normal':
    default:
      return '📊';
  }
}

function getVerdictLabel(verdict: AIVerdictType): string {
  switch (verdict) {
    case 'suspicious':
      return 'SUSPICIOUS';
    case 'concerning':
      return 'CONCERNING';
    case 'positive':
      return 'POSITIVE';
    case 'normal':
    default:
      return 'NORMAL';
  }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function LiveCommentaryFeed({ verdicts, maxItems = 20 }: LiveCommentaryFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest verdict
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0; // Scroll to top since we show newest first
    }
  }, [verdicts.length]);

  // Sort by timestamp descending (newest first) and limit
  const displayVerdicts = [...verdicts]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, maxItems);

  if (verdicts.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🤖</span>
          <h3 className="font-semibold text-sm">Live AI Commentary</h3>
          <span className="animate-pulse w-2 h-2 bg-green-500 rounded-full"></span>
        </div>
        <p className="text-sm text-gray-500 text-center py-4">
          Waiting for activity...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h3 className="font-semibold text-sm">Live AI Commentary</h3>
          <span className="animate-pulse w-2 h-2 bg-green-500 rounded-full"></span>
        </div>
        <span className="text-xs text-gray-500">{verdicts.length} events</span>
      </div>

      <div
        ref={scrollRef}
        className="max-h-64 overflow-y-auto p-2 space-y-2"
      >
        {displayVerdicts.map((verdict, index) => (
          <div
            key={`${verdict.timestamp}-${index}`}
            className={`border-l-4 p-2 rounded-r ${getVerdictColor(verdict.verdict)}`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <span>{getVerdictIcon(verdict.verdict)}</span>
                <span className="text-xs font-bold uppercase">
                  {getVerdictLabel(verdict.verdict)}
                </span>
              </div>
              <span className="text-xs text-gray-400">{formatTime(verdict.timestamp)}</span>
            </div>
            <p className="text-sm">{verdict.summary}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <span>Confidence: {verdict.confidence}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
