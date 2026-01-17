'use client';

import { useMemo } from 'react';
import type { ReplaySnapshot, ActivityAnnotation } from '@/types';

interface ReplayControlsProps {
  snapshots: ReplaySnapshot[];
  currentIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  sessionStart: number;
  onSeek: (index: number) => void;
  onPlayPause: () => void;
  onSpeedChange: (speed: number) => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getTriggerIcon(trigger: string): string {
  switch (trigger) {
    case 'bulk_insert':
      return '💉';
    case 'session_end':
      return '🏁';
    case 'challenge_change':
      return '📝';
    case 'interval':
    default:
      return '⏱️';
  }
}

function getTriggerColor(trigger: string): string {
  switch (trigger) {
    case 'bulk_insert':
      return 'bg-red-500';
    case 'session_end':
      return 'bg-purple-500';
    case 'challenge_change':
      return 'bg-blue-500';
    case 'interval':
    default:
      return 'bg-green-500';
  }
}

// Day 5: AI-Annotated Replay helpers
function getAnnotationIcon(activity: ActivityAnnotation): string {
  switch (activity) {
    case 'suspicious_paste':
      return '🚨';
    case 'thinking':
      return '💭';
    case 'debugging':
      return '🔧';
    case 'coding':
      return '⌨️';
    case 'idle':
    default:
      return '';
  }
}

function getAnnotationColor(activity: ActivityAnnotation): string {
  switch (activity) {
    case 'suspicious_paste':
      return 'bg-red-500 text-white';
    case 'thinking':
      return 'bg-blue-500 text-white';
    case 'debugging':
      return 'bg-yellow-500 text-black';
    case 'coding':
      return 'bg-green-500 text-white';
    case 'idle':
    default:
      return 'bg-gray-600 text-white';
  }
}

export function ReplayControls({
  snapshots,
  currentIndex,
  isPlaying,
  playbackSpeed,
  sessionStart,
  onSeek,
  onPlayPause,
  onSpeedChange,
}: ReplayControlsProps) {
  // Calculate timeline position and duration
  const { currentTime, totalDuration, progress } = useMemo(() => {
    if (snapshots.length === 0) {
      return { currentTime: 0, totalDuration: 0, progress: 0 };
    }

    const currentSnapshot = snapshots[currentIndex];
    const firstTimestamp = snapshots[0]?.timestamp || sessionStart;
    const lastTimestamp = snapshots[snapshots.length - 1]?.timestamp || firstTimestamp;

    const current = currentSnapshot
      ? currentSnapshot.timestamp - firstTimestamp
      : 0;
    const total = lastTimestamp - firstTimestamp;
    const prog = total > 0 ? (current / total) * 100 : 0;

    return { currentTime: current, totalDuration: total, progress: prog };
  }, [snapshots, currentIndex, sessionStart]);

  // Identify "interesting" snapshots (bulk_insert, challenge_change, session_end)
  const interestingMarkers = useMemo(() => {
    if (snapshots.length === 0) return [];

    const firstTimestamp = snapshots[0]?.timestamp || sessionStart;
    const lastTimestamp = snapshots[snapshots.length - 1]?.timestamp || firstTimestamp;
    const total = lastTimestamp - firstTimestamp;

    return snapshots
      .map((s, i) => ({
        index: i,
        trigger: s.metadata.trigger,
        position: total > 0 ? ((s.timestamp - firstTimestamp) / total) * 100 : 0,
      }))
      .filter((m) => m.trigger !== 'interval');
  }, [snapshots, sessionStart]);

  // Day 5: Annotation markers for AI-classified activities
  const annotationMarkers = useMemo(() => {
    if (snapshots.length === 0) return [];

    const firstTimestamp = snapshots[0]?.timestamp || sessionStart;
    const lastTimestamp = snapshots[snapshots.length - 1]?.timestamp || firstTimestamp;
    const total = lastTimestamp - firstTimestamp;

    return snapshots
      .map((s, i) => ({
        index: i,
        annotation: s.annotation,
        position: total > 0 ? ((s.timestamp - firstTimestamp) / total) * 100 : 0,
      }))
      .filter((m) => m.annotation && m.annotation.activity !== 'idle' && m.annotation.activity !== 'coding');
  }, [snapshots, sessionStart]);

  if (snapshots.length === 0) {
    return (
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-center text-gray-500 text-sm">
          No replay data available
        </div>
      </div>
    );
  }

  const currentSnapshot = snapshots[currentIndex];

  return (
    <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
      {/* Control Row */}
      <div className="flex items-center gap-4 mb-3">
        {/* Play/Pause Button */}
        <button
          onClick={onPlayPause}
          className="w-10 h-10 flex items-center justify-center bg-purple-600 hover:bg-purple-700 rounded-full transition-colors"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Speed Selector */}
        <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
          {[1, 2, 4].map((speed) => (
            <button
              key={speed}
              onClick={() => onSpeedChange(speed)}
              className={`px-3 py-1 text-sm rounded ${
                playbackSpeed === speed
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:bg-gray-600'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Time Display */}
        <div className="text-sm text-gray-300 font-mono">
          {formatDuration(currentTime)} / {formatDuration(totalDuration)}
        </div>

        {/* Snapshot Info */}
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-gray-400">
            Snapshot {currentIndex + 1} of {snapshots.length}
          </span>
          {currentSnapshot && (
            <span
              className={`px-2 py-0.5 rounded text-xs text-white ${getTriggerColor(
                currentSnapshot.metadata.trigger
              )}`}
            >
              {getTriggerIcon(currentSnapshot.metadata.trigger)}{' '}
              {currentSnapshot.metadata.trigger}
            </span>
          )}
        </div>
      </div>

      {/* Timeline Scrubber */}
      <div className="relative">
        {/* Day 5: Annotation markers above timeline */}
        <div className="h-6 relative mb-1">
          {annotationMarkers.map((marker) => marker.annotation && (
            <button
              key={`annot-${marker.index}`}
              onClick={() => onSeek(marker.index)}
              className={`absolute -translate-x-1/2 text-xs px-1.5 py-0.5 rounded-full ${getAnnotationColor(
                marker.annotation.activity
              )} hover:scale-110 transition-transform cursor-pointer`}
              style={{ left: `${marker.position}%` }}
              title={marker.annotation.reason}
            >
              {getAnnotationIcon(marker.annotation.activity)}
            </button>
          ))}
        </div>

        {/* Track Background */}
        <div className="h-3 bg-gray-700 rounded-full relative overflow-hidden">
          {/* Progress Fill */}
          <div
            className="absolute top-0 left-0 h-full bg-purple-600 rounded-full transition-all duration-150"
            style={{ width: `${progress}%` }}
          />

          {/* Interesting Markers */}
          {interestingMarkers.map((marker) => (
            <button
              key={marker.index}
              onClick={() => onSeek(marker.index)}
              className={`absolute top-0 w-1.5 h-full ${getTriggerColor(
                marker.trigger
              )} hover:opacity-80 transition-opacity`}
              style={{ left: `${marker.position}%`, transform: 'translateX(-50%)' }}
              title={`${getTriggerIcon(marker.trigger)} ${marker.trigger}`}
            />
          ))}
        </div>

        {/* Slider Input (invisible, on top for interaction) */}
        <input
          type="range"
          min={0}
          max={snapshots.length - 1}
          value={currentIndex}
          onChange={(e) => onSeek(parseInt(e.target.value, 10))}
          className="absolute top-6 left-0 w-full h-3 opacity-0 cursor-pointer"
        />

        {/* Playhead Indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2 border-purple-600 transition-all duration-150 pointer-events-none"
          style={{ left: `${progress}%`, top: 'calc(1.5rem + 0.375rem)', transform: 'translate(-50%, -50%)' }}
        />
      </div>

      {/* Snapshot Details */}
      {currentSnapshot && (
        <div className="flex gap-4 mt-2 text-xs text-gray-400">
          <span>Lines: {currentSnapshot.metadata.lineCount}</span>
          <span>Characters: {currentSnapshot.metadata.charCount}</span>
          <span>
            Time: {new Date(currentSnapshot.timestamp).toLocaleTimeString()}
          </span>
          {/* Day 5: Show annotation if present */}
          {currentSnapshot.annotation && (
            <span className={`px-2 py-0.5 rounded ${getAnnotationColor(currentSnapshot.annotation.activity)}`}>
              {getAnnotationIcon(currentSnapshot.annotation.activity)} {currentSnapshot.annotation.activity}
              <span className="ml-1 opacity-70">({currentSnapshot.annotation.confidence}%)</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
