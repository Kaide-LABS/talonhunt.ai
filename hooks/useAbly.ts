'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Ably from 'ably';
import type { CodeUpdateMessage, IntegrityEventMessage, AIVerdictMessage } from '@/types';

interface UseAblyOptions {
  sessionId: string;
  clientId: string;
  onCodeUpdate?: (message: CodeUpdateMessage) => void;
  onIntegrityEvent?: (message: IntegrityEventMessage) => void;
  onAIVerdict?: (message: AIVerdictMessage) => void;  // Phase 2: Live AI commentary
}

interface UseAblyReturn {
  channel: Ably.RealtimeChannel | null;
  connected: boolean;
  publishCode: (code: string, cursorPosition?: { line: number; column: number }) => void;
  publishIntegrityEvent: (event: Omit<IntegrityEventMessage, 'timestamp'>) => void;
  publishAIVerdict: (verdict: Omit<AIVerdictMessage, 'timestamp'>) => void;  // Phase 2: Live AI commentary
}

export function useAbly({
  sessionId,
  clientId,
  onCodeUpdate,
  onIntegrityEvent,
  onAIVerdict,
}: UseAblyOptions): UseAblyReturn {
  const [channel, setChannel] = useState<Ably.RealtimeChannel | null>(null);
  const [connected, setConnected] = useState(false);
  const ablyRef = useRef<Ably.Realtime | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const ably = new Ably.Realtime({
      authUrl: `/api/auth?clientId=${clientId}`,
      clientId,
      autoConnect: true,
    });

    ablyRef.current = ably;

    const handleConnected = () => {
      if (isMountedRef.current) setConnected(true);
    };
    const handleDisconnected = () => {
      if (isMountedRef.current) setConnected(false);
    };

    ably.connection.on('connected', handleConnected);
    ably.connection.on('disconnected', handleDisconnected);
    ably.connection.on('failed', handleDisconnected);
    ably.connection.on('closed', handleDisconnected);

    const ch = ably.channels.get(`session:${sessionId}`);

    if (isMountedRef.current) {
      setChannel(ch);
    }

    // Subscribe to code updates
    if (onCodeUpdate) {
      console.log('[useAbly] Subscribing to code_update on channel:', `session:${sessionId}`);
      ch.subscribe('code_update', (message) => {
        console.log('[useAbly] Received code_update message:', { clientId: message.clientId, dataLength: (message.data as CodeUpdateMessage)?.code?.length });
        if (isMountedRef.current) {
          onCodeUpdate(message.data as CodeUpdateMessage);
        }
      });
    }

    // Subscribe to integrity events
    if (onIntegrityEvent) {
      ch.subscribe('integrity_event', (message) => {
        if (isMountedRef.current) {
          onIntegrityEvent(message.data as IntegrityEventMessage);
        }
      });
    }

    // Phase 2: Subscribe to AI verdict messages (Live Commentary)
    if (onAIVerdict) {
      ch.subscribe('ai_verdict', (message) => {
        if (isMountedRef.current) {
          onAIVerdict(message.data as AIVerdictMessage);
        }
      });
    }

    // Enter presence
    ch.presence.enter({ role: 'participant' }).catch(() => {
      // Silently ignore - may fail if unmounted quickly
    });

    return () => {
      isMountedRef.current = false;

      // Defer cleanup to avoid React Strict Mode race conditions
      // The setTimeout ensures we don't close during React's double-mount cycle
      setTimeout(() => {
        try {
          const state = ably.connection.state;
          // Only attempt close if connection is in a state that allows it
          if (state === 'connected' || state === 'connecting' || state === 'suspended') {
            ably.close();
          }
        } catch (e) {
          // Silently ignore all errors - connection may already be closed or in transition
          // This is expected in React Strict Mode due to double-mount
        }
      }, 100);

      setChannel(null);
      setConnected(false);
    };
  }, [sessionId, clientId, onCodeUpdate, onIntegrityEvent, onAIVerdict]);

  const publishCode = useCallback(
    (code: string, cursorPosition?: { line: number; column: number }) => {
      console.log('[useAbly] publishCode called:', { connected, hasChannel: !!channel, codeLength: code?.length });
      if (channel && connected) {
        const message: CodeUpdateMessage = {
          code,
          timestamp: Date.now(),
          cursorPosition,
        };
        channel.publish('code_update', message).then(() => {
          console.log('[useAbly] Published code_update successfully');
        }).catch((err) => {
          console.error('[useAbly] Failed to publish:', err);
        });
      }
    },
    [channel, connected]
  );

  const publishIntegrityEvent = useCallback(
    (event: Omit<IntegrityEventMessage, 'timestamp'>) => {
      if (channel && connected) {
        const message: IntegrityEventMessage = {
          ...event,
          timestamp: Date.now(),
        };
        channel.publish('integrity_event', message).catch(() => {
          // Silently ignore publish errors
        });
      }
    },
    [channel, connected]
  );

  // Phase 2: Publish AI verdict for Live Commentary
  const publishAIVerdict = useCallback(
    (verdict: Omit<AIVerdictMessage, 'timestamp'>) => {
      if (channel && connected) {
        const message: AIVerdictMessage = {
          ...verdict,
          timestamp: Date.now(),
        };
        channel.publish('ai_verdict', message).catch(() => {
          // Silently ignore publish errors
        });
      }
    },
    [channel, connected]
  );

  return { channel, connected, publishCode, publishIntegrityEvent, publishAIVerdict };
}
