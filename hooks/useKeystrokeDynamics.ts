'use client';

import { useEffect, useRef, useCallback } from 'react';
import type * as Monaco from 'monaco-editor';
import { IntegrityTracker } from '@/lib/IntegrityTracker';
import type { TelemetryEvent, IntegrityEventMessage } from '@/types';

interface UseKeystrokeDynamicsOptions {
  sessionId: string;
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  enabled?: boolean;
  publishIntegrityEvent?: (event: Omit<IntegrityEventMessage, 'timestamp'>) => void;
}

interface UseKeystrokeDynamicsReturn {
  isTracking: boolean;
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

  // Handle anomaly detection - publish to Ably for real-time alerts
  const handleAnomaly = useCallback(
    (event: TelemetryEvent) => {
      if (publishIntegrityEvent) {
        publishIntegrityEvent({
          eventType: event.type,
          severity: event.type === 'velocity_spike' ? 'critical' : 'warning',
          data: event.data,
        });
      }
    },
    [publishIntegrityEvent]
  );

  // Flush events to API
  const flushEvents = useCallback(async () => {
    if (!trackerRef.current || !isMountedRef.current) return;

    const events = trackerRef.current.flush();
    if (events.length === 0) return;

    try {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, events }),
      });
    } catch (error) {
      console.error('Failed to flush integrity events:', error);
    }
  }, [sessionId]);

  // Initialize tracker and set up flush interval
  useEffect(() => {
    if (!enabled || !sessionId) return;

    isMountedRef.current = true;
    trackerRef.current = new IntegrityTracker(sessionId, handleAnomaly);

    // Flush events every 5 seconds
    flushIntervalRef.current = setInterval(flushEvents, 5000);

    return () => {
      isMountedRef.current = false;

      // Final flush on unmount
      flushEvents();

      if (flushIntervalRef.current) {
        clearInterval(flushIntervalRef.current);
        flushIntervalRef.current = null;
      }

      trackerRef.current = null;
    };
  }, [sessionId, enabled, handleAnomaly, flushEvents]);

  // Attach Monaco editor event listeners
  useEffect(() => {
    if (!editor || !trackerRef.current || !enabled) return;

    const tracker = trackerRef.current;
    const disposables: Monaco.IDisposable[] = [];

    // 1. Keyboard events via Monaco's onKeyDown
    const keyDisposable = editor.onKeyDown((e: Monaco.IKeyboardEvent) => {
      tracker.trackKeystroke(e.code);
    });
    disposables.push(keyDisposable);

    // 2. Content change events for paste detection
    const contentDisposable = editor.onDidChangeModelContent((e) => {
      for (const change of e.changes) {
        const insertedLength = change.text.length;
        // Detect large insertions (likely paste)
        if (insertedLength > 50 || (insertedLength > 10 && change.text.includes('\n'))) {
          tracker.trackPaste(insertedLength);
        }
      }
    });
    disposables.push(contentDisposable);

    // 3. Window focus events (detect switching to AI tools like Cluely)
    const handleBlur = () => tracker.trackFocus(false);
    const handleFocus = () => tracker.trackFocus(true);

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      disposables.forEach((d) => d.dispose());
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [editor, enabled]);

  return {
    isTracking: enabled && !!trackerRef.current,
  };
}
