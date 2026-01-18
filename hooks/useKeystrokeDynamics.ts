'use client';

import { useEffect, useRef, useCallback } from 'react';
import type * as Monaco from 'monaco-editor';
import { IntegrityTracker } from '@/lib/IntegrityTracker';
import type { TelemetryEvent, IntegrityEventMessage, IntegritySeverity, AIVerdictMessage, AIVerdictType, IntegrityEventType, BaselineMetrics, AdaptiveTriggerType, LiveCommentaryRequest } from '@/types';

interface UseKeystrokeDynamicsOptions {
  sessionId: string;
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  enabled?: boolean;
  publishIntegrityEvent?: (event: Omit<IntegrityEventMessage, 'timestamp'>) => void;
  publishAIVerdict?: (verdict: Omit<AIVerdictMessage, 'timestamp'>) => void;  // Phase 2: Live Commentary
  onBulkInsert?: () => void;  // Day 5: Callback for bulk insert detection (triggers replay snapshot)
  onSuspiciousInsert?: (triggerType: 'bulk_insert' | 'suspicious_return', insertedCode: string | null) => void;  // Day 5: Auto-interrogation trigger
  onMetricsUpdate?: (metrics: BaselineMetrics) => void;  // Phase 3: 1Hz metrics callback
}

interface UseKeystrokeDynamicsReturn {
  isTracking: boolean;
  getTracker: () => IntegrityTracker | null;  // Phase 3: Direct tracker access
}

// Phase 3: Adaptive AI trigger configuration
const ADAPTIVE_CONFIG = {
  CONSISTENCY_WINDOW_MS: 30000,    // 30 seconds of stable stats
  ANOMALY_THRESHOLD: 0.5,          // 50% deviation from baseline
  HEARTBEAT_INTERVAL_MS: 45000,    // 45-second fallback
  RATE_LIMIT_MS: 15000,            // Max 1 API call per 15s
  BASELINE_TOLERANCE: 0.2,         // ±20% within baseline for "consistent"
};

// Phase 2: Map severity to AI verdict type for Live Commentary
function severityToVerdict(severity: IntegritySeverity): AIVerdictType {
  switch (severity) {
    case 'critical':
      return 'suspicious';
    case 'warning':
      return 'concerning';
    case 'info':
    default:
      return 'normal';
  }
}

// Phase 2: Generate human-readable summary for Live Commentary
function generateVerdictSummary(eventType: IntegrityEventType): string {
  switch (eventType) {
    case 'suspicious_return':
      return 'Memory dump detected: fast typing after tab return suggests copied code';
    case 'bulk_insert':
      return 'Large code injection: significant code added in short time';
    case 'linearity_alert':
      return 'AI typing pattern: unusually linear cursor movement detected';
    case 'velocity_spike':
      return 'Superhuman typing speed: exceeds normal human capability';
    case 'rhythm_anomaly':
      return 'Robotic rhythm: unnaturally consistent timing between keystrokes';
    case 'read_pattern_warning':
      return 'Read pattern: oscillating focus suggests reading from another source';
    case 'post_return_burst_suspicious':
      return 'Burst typing: suspiciously fast and consistent after returning';
    case 'low_undo_ratio':
      return 'Too perfect: unusually low correction rate (no mistakes)';
    case 'paste':
      return 'Large paste detected';
    case 'focus_loss':
      return 'Tab switch: candidate left the editor';
    case 'research_break':
      return 'Research break: legitimate documentation lookup pattern';
    default:
      return `Event detected: ${eventType}`;
  }
}

// Map event types to severity levels
// Day 4: Added read_pattern_warning, suspicious_return, research_break
// Day 5: Added telemetry_heartbeat, post_return_burst_suspicious, low_undo_ratio
function getSeverity(event: TelemetryEvent): IntegritySeverity {
  // Check if event has severity in data (from enhanced rhythm detection)
  if (event.data?.severity === 'critical') return 'critical';
  if (event.data?.severity === 'warning') return 'warning';

  // Default severity by event type
  switch (event.type) {
    case 'velocity_spike':
    case 'linearity_alert':
    case 'suspicious_return':      // Day 4: ChatGPT memory dump
      return 'critical';
    case 'rhythm_anomaly':
    case 'bulk_insert':
    case 'paste':
    case 'read_pattern_warning':   // Day 4: Phone/overlay cheating
    case 'post_return_burst_suspicious':  // Day 5: Memory dump typing pattern
    case 'low_undo_ratio':         // Day 5: Too clean typing
      return 'warning';
    case 'focus_loss':
    case 'research_break':         // Day 4: Positive signal (info level)
    case 'telemetry_heartbeat':    // Day 5: Activity heartbeat (info level)
    default:
      return 'info';
  }
}

export function useKeystrokeDynamics({
  sessionId,
  editor,
  enabled = true,
  publishIntegrityEvent,
  publishAIVerdict,
  onBulkInsert,
  onSuspiciousInsert,
  onMetricsUpdate,
}: UseKeystrokeDynamicsOptions): UseKeystrokeDynamicsReturn {
  const trackerRef = useRef<IntegrityTracker | null>(null);
  const isMountedRef = useRef(true);
  const flushIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastInsertedCodeRef = useRef<string | null>(null);  // Day 5: Track last inserted code for interrogation

  // Phase 3: Adaptive AI trigger state
  const lastAICallRef = useRef<number>(0);              // Last API call timestamp
  const lastConsistencyCheckRef = useRef<number>(0);   // When consistency window started
  const recentEventsRef = useRef<Array<{ type: IntegrityEventType; timestamp: number }>>([]);
  const adaptiveHeartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use ref to hold publishIntegrityEvent to avoid recreating callbacks
  const publishRef = useRef(publishIntegrityEvent);
  publishRef.current = publishIntegrityEvent;

  // Phase 2: Use ref for publishAIVerdict (Live Commentary)
  const publishVerdictRef = useRef(publishAIVerdict);
  publishVerdictRef.current = publishAIVerdict;

  // Use ref for onBulkInsert callback
  const onBulkInsertRef = useRef(onBulkInsert);
  onBulkInsertRef.current = onBulkInsert;

  // Use ref for onSuspiciousInsert callback (auto-interrogation)
  const onSuspiciousInsertRef = useRef(onSuspiciousInsert);
  onSuspiciousInsertRef.current = onSuspiciousInsert;

  // Phase 3: Use ref for onMetricsUpdate callback
  const onMetricsUpdateRef = useRef(onMetricsUpdate);
  onMetricsUpdateRef.current = onMetricsUpdate;

  // Phase 3: Call live-commentary API with adaptive trigger
  const callLiveCommentaryAPI = useCallback(async (
    triggerType: AdaptiveTriggerType,
    metrics: BaselineMetrics
  ) => {
    const now = Date.now();

    // Rate limit: max 1 call per 15 seconds
    if (now - lastAICallRef.current < ADAPTIVE_CONFIG.RATE_LIMIT_MS) {
      console.log('[Adaptive] Rate limited, skipping API call');
      return;
    }

    lastAICallRef.current = now;

    const request: LiveCommentaryRequest = {
      sessionId,
      baselineWPM: metrics.baselineWPM,
      currentWPM: metrics.currentWPM,
      baselineBackspaceRatio: metrics.baselineBackspaceRatio,
      currentBackspaceRatio: metrics.currentBackspaceRatio,
      eventType: triggerType,
      recentEvents: recentEventsRef.current.slice(-10), // Last 10 events
    };

    console.log('[Adaptive] Calling live-commentary API:', triggerType);

    try {
      const response = await fetch('/api/live-commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[Adaptive] API response:', data);

        // Publish AI verdict to Ably with metrics
        if (publishVerdictRef.current && data.verdict && data.summary) {
          publishVerdictRef.current({
            verdict: data.verdict,
            eventType: `adaptive_${triggerType}` as AIVerdictMessage['eventType'],
            summary: data.summary,
            confidence: data.confidence || 70,
            metrics,  // Phase 3: Include metrics for reviewer display
          });
        }
      }
    } catch (error) {
      console.error('[Adaptive] API call failed:', error);
    }
  }, [sessionId]);

  // Phase 3: Check for anomaly condition (WPM spike/drop)
  const checkAnomaly = useCallback((metrics: BaselineMetrics): boolean => {
    if (!metrics.baselineEstablished || metrics.baselineWPM === null) return false;
    if (metrics.baselineWPM === 0) return false;

    const wpmDeviation = Math.abs(metrics.currentWPM - metrics.baselineWPM) / metrics.baselineWPM;

    // Anomaly: WPM spikes >50% above baseline OR drops to near 0
    if (wpmDeviation > ADAPTIVE_CONFIG.ANOMALY_THRESHOLD) {
      console.log('[Adaptive] Anomaly detected:', { wpmDeviation, current: metrics.currentWPM, baseline: metrics.baselineWPM });
      return true;
    }

    // Near-zero WPM after baseline established = suspicious pause
    if (metrics.currentWPM < 5 && metrics.baselineWPM > 20) {
      console.log('[Adaptive] Near-zero WPM detected');
      return true;
    }

    return false;
  }, []);

  // Phase 3: Check for consistency condition (30s stable)
  const checkConsistency = useCallback((metrics: BaselineMetrics): boolean => {
    if (!metrics.baselineEstablished || metrics.baselineWPM === null) return false;
    if (metrics.baselineWPM === 0) return false;

    const wpmDeviation = Math.abs(metrics.currentWPM - metrics.baselineWPM) / metrics.baselineWPM;
    const now = Date.now();

    // Within ±20% of baseline
    if (wpmDeviation <= ADAPTIVE_CONFIG.BASELINE_TOLERANCE) {
      // Start consistency window if not started
      if (lastConsistencyCheckRef.current === 0) {
        lastConsistencyCheckRef.current = now;
      }

      // 30 seconds of stable stats
      if (now - lastConsistencyCheckRef.current >= ADAPTIVE_CONFIG.CONSISTENCY_WINDOW_MS) {
        console.log('[Adaptive] Consistency window complete');
        lastConsistencyCheckRef.current = now; // Reset window
        return true;
      }
    } else {
      // Reset consistency window if deviated
      lastConsistencyCheckRef.current = 0;
    }

    return false;
  }, []);

  // Handle anomaly detection - publish to Ably for real-time alerts
  const handleAnomaly = useCallback(
    (event: TelemetryEvent) => {
      const severity = getSeverity(event);
      console.log('[IntegrityTracker] Anomaly detected:', event.type, event.data);

      // Phase 3: Track recent events for adaptive AI
      recentEventsRef.current.push({ type: event.type, timestamp: Date.now() });
      // Keep only last 20 events
      if (recentEventsRef.current.length > 20) {
        recentEventsRef.current.shift();
      }

      if (publishRef.current) {
        publishRef.current({
          eventType: event.type,
          severity,
          data: event.data,
        });
      }

      // Phase 2: Publish AI verdict for Live Commentary (Gemini's fix - the "Missing Link")
      // Only publish verdicts for significant events (warning or critical)
      if (publishVerdictRef.current && (severity === 'warning' || severity === 'critical')) {
        const verdict = severityToVerdict(severity);
        const summary = generateVerdictSummary(event.type);

        // Phase 3: Include metrics if available
        const currentMetrics = trackerRef.current?.getBaselineMetrics();

        console.log('[IntegrityTracker] Publishing AI verdict:', verdict, summary);
        publishVerdictRef.current({
          verdict,
          eventType: event.type,
          summary,
          confidence: severity === 'critical' ? 85 : 65,
          metrics: currentMetrics,  // Phase 3: Include metrics for reviewer display
        });
      }

      // Phase 3: Trigger anomaly API call for significant events
      if ((severity === 'warning' || severity === 'critical') && trackerRef.current) {
        const metrics = trackerRef.current.getBaselineMetrics();
        if (metrics.baselineEstablished) {
          callLiveCommentaryAPI('anomaly', metrics);
        }
      }

      // Day 5: Trigger replay snapshot on bulk insert detection
      if (event.type === 'bulk_insert' && onBulkInsertRef.current) {
        console.log('[IntegrityTracker] Triggering bulk insert snapshot');
        onBulkInsertRef.current();
      }

      // Day 5: Trigger auto-interrogation on suspicious events
      if ((event.type === 'bulk_insert' || event.type === 'suspicious_return') && onSuspiciousInsertRef.current) {
        console.log('[IntegrityTracker] Triggering auto-interrogation:', event.type);
        onSuspiciousInsertRef.current(event.type, lastInsertedCodeRef.current);
      }
    },
    [callLiveCommentaryAPI] // Added dependency
  );

  // Use ref to hold sessionId to avoid recreating callbacks
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  // Flush events to API
  const flushEvents = useCallback(async () => {
    if (!trackerRef.current || !isMountedRef.current) return;

    // Day 5: Emit heartbeat before flush for Pulse Graph data
    trackerRef.current.emitHeartbeat();

    const events = trackerRef.current.flush();
    console.log('[IntegrityTracker] Flushing events:', events.length);
    if (events.length === 0) return;

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionIdRef.current, events }),
      });
      console.log('[IntegrityTracker] Events posted:', res.status);
    } catch (error) {
      console.error('Failed to flush integrity events:', error);
    }
  }, []); // No dependencies - uses ref

  // Initialize tracker and set up flush interval
  useEffect(() => {
    if (!enabled || !sessionId) return;

    console.log('[IntegrityTracker] Initializing for session:', sessionId);
    isMountedRef.current = true;
    trackerRef.current = new IntegrityTracker(sessionId, handleAnomaly);

    // Flush events every 5 seconds
    flushIntervalRef.current = setInterval(flushEvents, 5000);

    // Phase 3: 1Hz metrics updates + trigger checks
    metricsIntervalRef.current = setInterval(() => {
      if (!trackerRef.current || !isMountedRef.current) return;

      const metrics = trackerRef.current.getBaselineMetrics();

      // Report metrics to parent for UI display
      if (onMetricsUpdateRef.current) {
        onMetricsUpdateRef.current(metrics);
      }

      // Only check triggers if baseline is established
      if (metrics.baselineEstablished) {
        // Check for anomaly (immediate trigger)
        if (checkAnomaly(metrics)) {
          callLiveCommentaryAPI('anomaly', metrics);
        }
        // Check for consistency (30s window)
        else if (checkConsistency(metrics)) {
          callLiveCommentaryAPI('consistency', metrics);
        }
      }
    }, 1000); // 1Hz

    // Phase 3: 45-second heartbeat fallback
    adaptiveHeartbeatRef.current = setInterval(() => {
      if (!trackerRef.current || !isMountedRef.current) return;

      const metrics = trackerRef.current.getBaselineMetrics();
      const now = Date.now();

      // Only send heartbeat if baseline established and no recent AI call
      if (metrics.baselineEstablished &&
          now - lastAICallRef.current >= ADAPTIVE_CONFIG.HEARTBEAT_INTERVAL_MS) {
        console.log('[Adaptive] Heartbeat triggered');
        callLiveCommentaryAPI('heartbeat', metrics);
      }
    }, ADAPTIVE_CONFIG.HEARTBEAT_INTERVAL_MS);

    return () => {
      console.log('[IntegrityTracker] Cleaning up');
      isMountedRef.current = false;

      // Final flush on unmount
      flushEvents();

      if (flushIntervalRef.current) {
        clearInterval(flushIntervalRef.current);
        flushIntervalRef.current = null;
      }

      // Phase 3: Cleanup intervals
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
        metricsIntervalRef.current = null;
      }
      if (adaptiveHeartbeatRef.current) {
        clearInterval(adaptiveHeartbeatRef.current);
        adaptiveHeartbeatRef.current = null;
      }

      trackerRef.current = null;
    };
    // handleAnomaly, flushEvents, checkAnomaly, checkConsistency, callLiveCommentaryAPI use refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, enabled]);

  // Attach Monaco editor event listeners
  useEffect(() => {
    if (!editor || !trackerRef.current || !enabled) return;

    const tracker = trackerRef.current;
    const disposables: Monaco.IDisposable[] = [];

    // Initialize content state with current editor content
    const model = editor.getModel();
    if (model) {
      const initialCharCount = model.getValue().length;
      tracker.initializeContentState(initialCharCount);
    }

    // 1. Keyboard events via Monaco's onKeyDown
    const keyDisposable = editor.onKeyDown((e: Monaco.IKeyboardEvent) => {
      tracker.trackKeystroke(e.code);
    });
    disposables.push(keyDisposable);

    // 2. Cursor position tracking for LinearityIndex
    // AI transcription tools type linearly; humans jump around
    const cursorDisposable = editor.onDidChangeCursorPosition((e) => {
      tracker.trackCursor(e.position.lineNumber, e.position.column);
    });
    disposables.push(cursorDisposable);

    // 3. Content change events for paste detection AND bulk_insert
    const contentDisposable = editor.onDidChangeModelContent((e) => {
      const currentModel = editor.getModel();
      const newCharCount = currentModel?.getValue().length ?? 0;

      for (const change of e.changes) {
        const insertedLength = change.text.length;

        // Detect large insertions (likely paste)
        if (insertedLength > 50 || (insertedLength > 10 && change.text.includes('\n'))) {
          tracker.trackPaste(insertedLength);
        }

        // Day 5: Capture inserted text for auto-interrogation (>20 chars)
        if (insertedLength > 20) {
          lastInsertedCodeRef.current = change.text;
        }

        // Track content changes for bulk_insert detection
        // This catches medium-sized injections (10-50 chars) that bypass paste
        tracker.trackContentChange(newCharCount, insertedLength);
      }
    });
    disposables.push(contentDisposable);

    // 4. Window focus events (detect switching to AI tools like Cluely)
    // blur/focus catches overlays (Cluely), visibilitychange catches tab switches
    const handleBlur = () => tracker.trackFocus(false);
    const handleFocus = () => tracker.trackFocus(true);

    // visibilitychange is MORE RELIABLE for tab switches (Alt+Tab, Chrome tab switch)
    // This is critical for Return Signature Analysis (Miner vs Printer)
    const handleVisibilityChange = () => {
      const isHidden = document.hidden;
      console.log('[IntegrityTracker] visibilitychange:', isHidden ? 'hidden' : 'visible');
      tracker.trackFocus(!isHidden);
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposables.forEach((d) => d.dispose());
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [editor, enabled]);

  // Phase 3: Getter for direct tracker access
  const getTracker = useCallback(() => trackerRef.current, []);

  return {
    isTracking: enabled && !!trackerRef.current,
    getTracker,  // Phase 3: Direct tracker access
  };
}
