'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { useAbly } from '@/hooks/useAbly';
import { useKeystrokeDynamics } from '@/hooks/useKeystrokeDynamics';
import type { CodeUpdateMessage } from '@/types';

interface Props {
  sessionId: string;
  isReadOnly?: boolean;
  language?: string;
  initialCode?: string;
}

export function CodeEditor({
  sessionId,
  isReadOnly = false,
  language = 'javascript',
  initialCode = '// Start coding here...\n',
}: Props) {
  const [code, setCode] = useState(initialCode);
  const [clientId] = useState(() => `user-${Math.random().toString(36).slice(2, 11)}`);
  const [editor, setEditor] = useState<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const isRemoteUpdate = useRef(false);
  const lastSavedCode = useRef(initialCode);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update code when initialCode prop changes (for reviewer loading from DB)
  useEffect(() => {
    if (initialCode !== lastSavedCode.current) {
      setCode(initialCode);
      lastSavedCode.current = initialCode;
    }
  }, [initialCode]);

  // Handle incoming code updates (for reviewer view)
  const handleCodeUpdate = useCallback((message: CodeUpdateMessage) => {
    console.log('[CodeEditor] Received code update:', { isReadOnly, codeLength: message.code?.length });
    if (isReadOnly) {
      isRemoteUpdate.current = true;
      setCode(message.code);
      // Reset flag after state update
      setTimeout(() => {
        isRemoteUpdate.current = false;
      }, 0);
    }
  }, [isReadOnly]);

  const { connected, publishCode, publishIntegrityEvent } = useAbly({
    sessionId,
    clientId,
    onCodeUpdate: handleCodeUpdate,
  });

  // Keystroke dynamics tracking (only for candidate, not reviewer)
  const { isTracking } = useKeystrokeDynamics({
    sessionId,
    editor,
    enabled: !isReadOnly,
    publishIntegrityEvent,
  });

  // Save code to DB (for candidate only) - persists code for late-joining reviewers
  const saveToDb = useCallback(async (codeToSave: string) => {
    if (isReadOnly) return; // Only candidate saves

    try {
      const position = editor?.getPosition();
      await fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          code: codeToSave,
          cursorPosition: position ? { line: position.lineNumber, column: position.column } : undefined,
        }),
      });
      lastSavedCode.current = codeToSave;
      console.log('[CodeEditor] Saved snapshot to DB');
    } catch (error) {
      console.error('[CodeEditor] Failed to save snapshot:', error);
    }
  }, [sessionId, editor, isReadOnly]);

  // Debounced publish for typing
  const publishTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleChange: OnChange = useCallback(
    (value) => {
      console.log('[CodeEditor] handleChange called:', { valueLength: value?.length, isRemote: isRemoteUpdate.current, isReadOnly });
      if (value === undefined || isRemoteUpdate.current) return;

      setCode(value);

      // Only publish and save if NOT read-only (candidate only)
      if (!isReadOnly) {
        // Debounce publishing to Ably (100ms)
        if (publishTimeoutRef.current) {
          clearTimeout(publishTimeoutRef.current);
        }
        publishTimeoutRef.current = setTimeout(() => {
          console.log('[CodeEditor] Publishing after debounce, connected:', connected);
          const position = editor?.getPosition();
          publishCode(value, position ? { line: position.lineNumber, column: position.column } : undefined);
        }, 100);

        // Debounce saving to DB (2 seconds) - less frequent than Ably
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          saveToDb(value);
        }, 2000);
      }
    },
    [publishCode, editor, isReadOnly, connected, saveToDb]
  );

  const handleEditorMount: OnMount = useCallback((editorInstance) => {
    setEditor(editorInstance);
  }, []);

  // Cleanup timeouts on unmount + final save
  useEffect(() => {
    return () => {
      if (publishTimeoutRef.current) {
        clearTimeout(publishTimeoutRef.current);
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Save on unmount (for candidate)
  useEffect(() => {
    if (isReadOnly) return;

    return () => {
      // Final save when leaving
      if (code !== lastSavedCode.current) {
        // Fire and forget - can't await in cleanup
        fetch('/api/snapshots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, code }),
        }).catch(() => {});
      }
    };
  }, [sessionId, code, isReadOnly]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-sm">
        <span className="text-gray-300">
          {isReadOnly ? 'Reviewer View (Read Only)' : 'Candidate Editor'}
        </span>
        <div className="flex items-center gap-4">
          {/* Integrity tracking indicator (candidate only) */}
          {!isReadOnly && (
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isTracking ? 'bg-blue-500 animate-pulse' : 'bg-gray-500'
                }`}
              />
              <span className="text-gray-400 text-xs">
                {isTracking ? 'Recording' : 'Not recording'}
              </span>
            </div>
          )}
          {/* Connection status */}
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-gray-400">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          defaultLanguage={language}
          language={language}
          value={code}
          theme="vs-dark"
          onChange={handleChange}
          onMount={handleEditorMount}
          options={{
            readOnly: isReadOnly,
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
          }}
        />
      </div>
    </div>
  );
}
