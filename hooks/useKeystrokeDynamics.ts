'use client';

import { useEffect, useRef, useCallback } from 'react';
import type * as Monaco from 'monaco-editor';
import { IntegrityTracker } from '@/lib/IntegrityTracker';
import type { TelemetryEvent, IntegrityEventMessage, IntegritySeverity } from '@/types';

interface UseKeystrokeDynamicsOptions {
  sessionId: string;
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  enabled?: boolean;
  publishIntegrityEvent?: (event: Omit<IntegrityEventMessage, 'timestamp'>) => void;
}

interface UseKeystrokeDynamicsReturn {
  isTracking: boolean;
}

// Map event types to severity levels
// Day 4: Added read_pattern_warning, suspicious_return, research_break
// Day 5: Added telemetry_heartbeat
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
}: UseKeystrokeDynamicsOptions): UseKeystrokeDynamicsReturn {
  const trackerRef = useRef<IntegrityTracker | null>(null);
  const isMountedRef = useRef(true);
  const flushIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use ref to hold publishIntegrityEvent to avoid recreating callbacks
  const publishRef = useRef(publishIntegrityEvent);
  publishRef.current = publishIntegrityEvent;

  // Handle anomaly detection - publish to Ably for real-time alerts
  const handleAnomaly = useCallback(
    (event: TelemetryEvent) => {
      console.log('[IntegrityTracker] Anomaly detected:', event.type, event.data);
      if (publishRef.current) {
        publishRef.current({
          eventType: event.type,
          severity: getSeverity(event),
          data: event.data,
        });
      }
    },
    [] // No dependencies - uses ref
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

    return () => {
      console.log('[IntegrityTracker] Cleaning up');
      isMountedRef.current = false;

      // Final flush on unmount
      flushEvents();

      if (flushIntervalRef.current) {
        clearInterval(flushIntervalRef.current);
        flushIntervalRef.current = null;
      }

      trackerRef.current = null;
    };
    // handleAnomaly and flushEvents use refs, so they're stable
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

  return {
    isTracking: enabled && !!trackerRef.current,
  };
}
