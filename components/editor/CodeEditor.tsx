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

  // Handle incoming code updates (for reviewer view)
  const handleCodeUpdate = useCallback((message: CodeUpdateMessage) => {
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

  // Debounced publish for typing
  const publishTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleChange: OnChange = useCallback(
    (value) => {
      if (value === undefined || isRemoteUpdate.current) return;

      setCode(value);

      // Debounce publishing to avoid flooding the channel
      if (publishTimeoutRef.current) {
        clearTimeout(publishTimeoutRef.current);
      }

      publishTimeoutRef.current = setTimeout(() => {
        const position = editor?.getPosition();
        publishCode(value, position ? { line: position.lineNumber, column: position.column } : undefined);
      }, 100); // 100ms debounce
    },
    [publishCode, editor]
  );

  const handleEditorMount: OnMount = useCallback((editorInstance) => {
    setEditor(editorInstance);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (publishTimeoutRef.current) {
        clearTimeout(publishTimeoutRef.current);
      }
    };
  }, []);

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
