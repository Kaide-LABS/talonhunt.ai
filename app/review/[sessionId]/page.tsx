'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { CodeEditor } from '@/components/editor/CodeEditor';
import { PulseGraph } from '@/components/PulseGraph';
import type { IntegrityEventType, IntegritySeverity } from '@/types';

interface Session {
  sessionId: string;
  language: string;
  status: string;
  integrityScore: number;
  createdAt?: string;
}

interface Snapshot {
  code: string;
  cursorPosition?: { line: number; column: number };
  exists: boolean;
}

interface AIAnalysis {
  verdict: 'High Risk' | 'Medium Risk' | 'Low Risk';
  confidence: 'High' | 'Medium' | 'Low';
  summary: string;
  key_evidence: string[];
}

interface StoredEvent {
  _id: string;
  sessionId: string;
  type: IntegrityEventType;
  timestamp: number;
  data: Record<string, unknown>;
  serverReceivedAt: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getEventSeverity(type: IntegrityEventType): IntegritySeverity {
  switch (type) {
    case 'velocity_spike':
    case 'linearity_alert':
    case 'suspicious_return':
      return 'critical';
    case 'rhythm_anomaly':
    case 'bulk_insert':
    case 'paste':
    case 'read_pattern_warning':
      return 'warning';
    case 'focus_loss':
    case 'research_break':
    case 'telemetry_heartbeat':  // Day 5: Activity heartbeat for Pulse Graph
    default:
      return 'info';
  }
}

function getSeverityColor(severity: IntegritySeverity): string {
  switch (severity) {
    case 'critical':
      return 'border-red-500 bg-red-900/30';
    case 'warning':
      return 'border-yellow-500 bg-yellow-900/30';
    case 'info':
    default:
      return 'border-gray-600 bg-gray-800/50';
  }
}

function getSeverityBadgeColor(severity: IntegritySeverity): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500 text-white';
    case 'warning':
      return 'bg-yellow-500 text-black';
    case 'info':
    default:
      return 'bg-gray-500 text-white';
  }
}

function getEventLabel(type: IntegrityEventType): string {
  switch (type) {
    case 'paste':
      return 'Large Paste';
    case 'focus_loss':
      return 'Tab Switch';
    case 'velocity_spike':
      return 'Velocity Spike';
    case 'linearity_alert':
      return 'Linear Typing (AI Pattern)';
    case 'rhythm_anomaly':
      return 'Robotic Rhythm';
    case 'bulk_insert':
      return 'Code Injection';
    case 'read_pattern_warning':
      return 'Read Pattern (Phone/Overlay)';
    case 'suspicious_return':
      return 'Memory Dump (ChatGPT)';
    case 'research_break':
      return 'Research Break ✓';
    case 'telemetry_heartbeat':
      return 'Activity';
    default:
      return type;
  }
}

function getEventIcon(type: IntegrityEventType): string {
  switch (type) {
    case 'paste':
      return '📋';
    case 'focus_loss':
      return '👁️';
    case 'velocity_spike':
      return '⚡';
    case 'linearity_alert':
      return '🤖';
    case 'rhythm_anomaly':
      return '🎵';
    case 'bulk_insert':
      return '💉';
    case 'read_pattern_warning':
      return '📱';
    case 'suspicious_return':
      return '🚨';
    case 'research_break':
      return '✅';
    case 'telemetry_heartbeat':
      return '💓';
    default:
      return '📊';
  }
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-500';
  if (score >= 50) return 'text-yellow-500';
  return 'text-red-500';
}

function getRiskLevel(score: number, criticalCount: number): { label: string; color: string } {
  if (criticalCount >= 3 || score < 30) {
    return { label: 'High Risk', color: 'bg-red-500 text-white' };
  }
  if (criticalCount >= 1 || score < 60) {
    return { label: 'Medium Risk', color: 'bg-yellow-500 text-black' };
  }
  return { label: 'Low Risk', color: 'bg-green-500 text-white' };
}

// ============================================================================
// EventCard Component
// ============================================================================

function EventCard({ event }: { event: StoredEvent }) {
  const severity = getEventSeverity(event.type);
  const severityColor = getSeverityColor(severity);
  const badgeColor = getSeverityBadgeColor(severity);
  const label = getEventLabel(event.type);
  const icon = getEventIcon(event.type);
  const isPositive = event.type === 'research_break';

  return (
    <div className={`border-l-4 p-3 rounded-r-lg ${severityColor} mb-2`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <div>
            <span className={`text-xs px-2 py-0.5 rounded ${badgeColor}`}>
              {severity.toUpperCase()}
            </span>
            {isPositive && (
              <span className="text-xs px-2 py-0.5 rounded bg-green-600 text-white ml-1">
                +5
              </span>
            )}
          </div>
        </div>
        <span className="text-xs text-gray-400">{formatTimestamp(event.timestamp)}</span>
      </div>
      <h4 className={`font-medium mt-1 ${isPositive ? 'text-green-400' : ''}`}>{label}</h4>
      {typeof event.data?.message === 'string' && (
        <p className="text-sm text-gray-400 mt-1">{event.data.message}</p>
      )}
      {/* Event-specific details */}
      <div className="text-xs text-gray-500 mt-2 space-y-0.5">
        {event.data?.latency !== undefined && (
          <div>Latency: {String(event.data.latency)}ms</div>
        )}
        {event.data?.variance !== undefined && (
          <div>Variance: {Number(event.data.variance).toFixed(2)}</div>
        )}
        {event.data?.linearityIndex !== undefined && (
          <div>Linearity: {(Number(event.data.linearityIndex) * 100).toFixed(0)}%</div>
        )}
        {event.data?.burstCV !== undefined && (
          <div>Burst CV: {String(event.data.burstCV)} | Pause CV: {String(event.data.pauseCV)}</div>
        )}
        {event.data?.returnLatency !== undefined && (
          <div>Return Latency: {String(event.data.returnLatency)}ms | Break: {Math.round(Number(event.data.breakDuration) / 1000)}s</div>
        )}
        {event.data?.length !== undefined && (
          <div>Characters: {String(event.data.length)}</div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Risk Signals Bar Component
// ============================================================================

function RiskSignalsBar({ events }: { events: StoredEvent[] }) {
  // Count events by category
  const counts = {
    linearity: 0,
    rhythm: 0,
    readPattern: 0,
    suspiciousReturn: 0,
    researchBreak: 0,
  };

  for (const event of events) {
    switch (event.type) {
      case 'linearity_alert':
        counts.linearity++;
        break;
      case 'rhythm_anomaly':
        counts.rhythm++;
        break;
      case 'read_pattern_warning':
        counts.readPattern++;
        break;
      case 'suspicious_return':
        counts.suspiciousReturn++;
        break;
      case 'research_break':
        counts.researchBreak++;
        break;
    }
  }

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2 bg-gray-800/50 border-b border-gray-700">
      <span className="text-sm text-gray-400 mr-2">Risk Signals:</span>
      {counts.linearity > 0 && (
        <span className="px-2 py-0.5 text-xs rounded bg-red-900 text-red-300 border border-red-500">
          🤖 AI Typing: {counts.linearity}
        </span>
      )}
      {counts.rhythm > 0 && (
        <span className="px-2 py-0.5 text-xs rounded bg-yellow-900 text-yellow-300 border border-yellow-500">
          🎵 Robotic: {counts.rhythm}
        </span>
      )}
      {counts.readPattern > 0 && (
        <span className="px-2 py-0.5 text-xs rounded bg-yellow-900 text-yellow-300 border border-yellow-500">
          📱 Read Pattern: {counts.readPattern}
        </span>
      )}
      {counts.suspiciousReturn > 0 && (
        <span className="px-2 py-0.5 text-xs rounded bg-red-900 text-red-300 border border-red-500">
          🚨 Memory Dump: {counts.suspiciousReturn}
        </span>
      )}
      {counts.researchBreak > 0 && (
        <span className="px-2 py-0.5 text-xs rounded bg-green-900 text-green-300 border border-green-500">
          ✅ Research: {counts.researchBreak}
        </span>
      )}
      {Object.values(counts).every(c => c === 0) && (
        <span className="text-sm text-gray-500">No significant signals yet</span>
      )}
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function ReviewPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<Session | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Run AI analysis
  const runAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
      }
    } catch (err) {
      console.error('Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [sessionId]);

  // Fetch events from API
  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/events?sessionId=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch {
      // Ignore event fetch errors
    }
  }, [sessionId]);

  // Fetch session info, snapshot, and events
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch session, snapshot, and events in parallel
        const [sessionRes, snapshotRes] = await Promise.all([
          fetch(`/api/sessions?id=${sessionId}`),
          fetch(`/api/snapshots?sessionId=${sessionId}`),
        ]);

        if (!sessionRes.ok) {
          throw new Error('Session not found');
        }

        const sessionData = await sessionRes.json();
        const snapshotData = await snapshotRes.json();

        setSession(sessionData);
        setSnapshot(snapshotData);

        // Fetch events after session loads
        await fetchEvents();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session');
      }
    };

    fetchData();

    // Poll for session and event updates
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/sessions?id=${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          setSession(data);
        }
        await fetchEvents();
      } catch {
        // Ignore polling errors
      }
    }, 3000); // Poll every 3s for more responsive updates

    return () => clearInterval(pollInterval);
  }, [sessionId, fetchEvents]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-2">Error</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!session || !snapshot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4" />
          <p className="text-gray-400">Loading session...</p>
        </div>
      </div>
    );
  }

  // Calculate critical event count for risk assessment
  const criticalCount = events.filter(e => getEventSeverity(e.type) === 'critical').length;
  const riskLevel = getRiskLevel(session.integrityScore, criticalCount);

  // Sort events by timestamp (newest first for timeline)
  const sortedEvents = [...events].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg font-semibold">Recruiter Dashboard</h1>
              <p className="text-sm text-gray-400">
                Session: <span className="font-mono">{sessionId.slice(0, 8)}...</span> |
                Language: {session.language}
              </p>
            </div>
            {/* Risk Assessment Badge */}
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${riskLevel.color}`}>
              {riskLevel.label}
            </div>
          </div>
          <div className="flex items-center gap-6">
            {/* Integrity Score */}
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Integrity Score</p>
              <p className={`text-3xl font-bold ${getScoreColor(session.integrityScore)}`}>
                {session.integrityScore}
              </p>
            </div>
            {/* Session Status */}
            <div
              className={`px-3 py-1 rounded-full text-sm ${
                session.status === 'active'
                  ? 'bg-green-900 text-green-300 border border-green-500'
                  : 'bg-gray-700 text-gray-300 border border-gray-600'
              }`}
            >
              {session.status === 'active' ? '● Live' : session.status}
            </div>
          </div>
        </div>
      </header>

      {/* Risk Signals Bar */}
      <RiskSignalsBar events={events} />

      {/* Pulse Graph - Activity visualization over time */}
      <PulseGraph
        events={events}
        sessionStart={session.createdAt ? new Date(session.createdAt).getTime() : Date.now() - 300000}
      />

      {/* AI Forensic Analysis Section */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">✨</span>
            <h3 className="font-semibold">AI Forensic Analysis</h3>
            <span className="text-xs text-gray-500">(Gemini 2.0 Flash)</span>
          </div>
          {!analysis && !isAnalyzing && (
            <button
              onClick={runAnalysis}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors animate-pulse"
            >
              Run Analysis
            </button>
          )}
          {isAnalyzing && (
            <div className="flex items-center gap-2 text-gray-400">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500" />
              <span className="text-sm">Analyzing session...</span>
            </div>
          )}
        </div>

        {/* Analysis Results */}
        {analysis && (
          <div className="mt-4 space-y-3">
            {/* Verdict and Confidence */}
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  analysis.verdict === 'High Risk'
                    ? 'bg-red-900 text-red-200 border border-red-700'
                    : analysis.verdict === 'Medium Risk'
                    ? 'bg-yellow-900 text-yellow-200 border border-yellow-700'
                    : 'bg-green-900 text-green-200 border border-green-700'
                }`}
              >
                {analysis.verdict}
              </span>
              <span className="text-sm text-gray-400">
                Confidence: <span className="text-white">{analysis.confidence}</span>
              </span>
              <button
                onClick={runAnalysis}
                className="ml-auto text-xs text-gray-500 hover:text-gray-300"
              >
                Re-analyze
              </button>
            </div>

            {/* Summary */}
            <p className="text-sm text-gray-300">{analysis.summary}</p>

            {/* Key Evidence */}
            <div>
              <h4 className="text-xs text-gray-500 uppercase tracking-wide mb-1">Key Evidence</h4>
              <ul className="space-y-1">
                {analysis.key_evidence.map((evidence, i) => (
                  <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
                    <span className="text-purple-400">•</span>
                    {evidence}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Empty state hint */}
        {!analysis && !isAnalyzing && (
          <p className="mt-2 text-xs text-gray-500">
            Click &quot;Run Analysis&quot; to get AI-powered forensic insights on this session.
          </p>
        )}
      </div>

      {/* Main Content: 70% Editor, 30% Timeline */}
      <main className="flex-1 flex overflow-hidden">
        {/* Code Editor - 70% */}
        <div className="w-[70%] h-full border-r border-gray-700">
          <CodeEditor
            sessionId={sessionId}
            language={session.language}
            isReadOnly={true}
            initialCode={snapshot.code}
          />
        </div>

        {/* Event Timeline - 30% */}
        <div className="w-[30%] h-full flex flex-col bg-gray-900">
          <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/50">
            <h2 className="font-semibold">Event Timeline</h2>
            <p className="text-xs text-gray-400">{events.length} events captured</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {sortedEvents.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No events yet</p>
            ) : (
              sortedEvents.map((event) => (
                <EventCard key={event._id || event.timestamp} event={event} />
              ))
            )}
          </div>
        </div>
      </main>

      {/* Footer with Defense in Depth explanation */}
      <footer className="bg-gray-800/50 border-t border-gray-700 px-4 py-2 text-xs text-gray-500">
        <strong>Defense in Depth:</strong> Velocity → Linearity → Oscillation → Return Signature |
        Human judgment makes the final call.
      </footer>
    </div>
  );
}
