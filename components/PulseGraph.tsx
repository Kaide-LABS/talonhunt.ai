'use client';

import { useMemo, useState } from 'react';
import type { IntegrityEventType, IntegritySeverity, VisualSnapshot } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface StoredEvent {
  _id: string;
  sessionId: string;
  type: IntegrityEventType;
  timestamp: number;
  data: Record<string, unknown>;
  serverReceivedAt: string;
}

interface PulseGraphProps {
  events: StoredEvent[];
  sessionStart: number;
  sessionEnd?: number;
  onSeek?: (timestamp: number) => void;          // Click to seek (replay mode)
  currentTimestamp?: number | null;              // Current playback position (replay mode)
  visualSnapshots?: VisualSnapshot[];            // Phase 2: Webcam snapshots for camera icon hover
}

interface Bucket {
  startTime: number;
  endTime: number;
  volume: number;  // Total activity (keystrokes + paste chars)
  maxSeverity: IntegritySeverity;
  events: StoredEvent[];
  snapshots: VisualSnapshot[];  // Phase 2: Visual snapshots in this bucket
}

// ============================================================================
// Constants
// ============================================================================

const BUCKET_DURATION_MS = 5000; // 5-second buckets for EKG-style resolution
const SVG_HEIGHT = 60;
const BAR_GAP = 1;
const MIN_BAR_HEIGHT = 1; // 1px baseline for idle periods

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
    case 'telemetry_heartbeat':
    default:
      return 'info';
  }
}

function severityToColor(severity: IntegritySeverity): string {
  switch (severity) {
    case 'critical':
      return '#ef4444'; // red-500
    case 'warning':
      return '#eab308'; // yellow-500
    case 'info':
    default:
      return '#22c55e'; // green-500
  }
}

function severityPriority(severity: IntegritySeverity): number {
  switch (severity) {
    case 'critical':
      return 3;
    case 'warning':
      return 2;
    case 'info':
    default:
      return 1;
  }
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ============================================================================
// Bucket Calculation
// ============================================================================

function calculateBuckets(
  events: StoredEvent[],
  sessionStart: number,
  sessionEnd: number,
  visualSnapshots: VisualSnapshot[] = []
): Bucket[] {
  const duration = sessionEnd - sessionStart;
  const bucketCount = Math.ceil(duration / BUCKET_DURATION_MS);

  // Initialize empty buckets
  const buckets: Bucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    buckets.push({
      startTime: sessionStart + i * BUCKET_DURATION_MS,
      endTime: sessionStart + (i + 1) * BUCKET_DURATION_MS,
      volume: 0,
      maxSeverity: 'info',
      events: [],
      snapshots: [],
    });
  }

  // Assign events to buckets
  for (const event of events) {
    const bucketIndex = Math.floor((event.timestamp - sessionStart) / BUCKET_DURATION_MS);
    if (bucketIndex >= 0 && bucketIndex < buckets.length) {
      const bucket = buckets[bucketIndex];
      bucket.events.push(event);

      // Calculate volume based on event type
      if (event.type === 'telemetry_heartbeat') {
        // Heartbeat contains keystroke count
        const keystrokeCount = Number(event.data?.keystrokeCount) || 0;
        bucket.volume += keystrokeCount;
      } else if (event.type === 'paste') {
        // Paste events have character length
        const pasteLength = Number(event.data?.length) || 0;
        bucket.volume += pasteLength;
      } else if (event.type === 'bulk_insert') {
        // Bulk insert has character delta
        const charDelta = Number(event.data?.charDelta) || 0;
        bucket.volume += charDelta;
      }

      // Update max severity
      const eventSeverity = getEventSeverity(event.type);
      if (severityPriority(eventSeverity) > severityPriority(bucket.maxSeverity)) {
        bucket.maxSeverity = eventSeverity;
      }
    }
  }

  // Phase 2: Assign visual snapshots to buckets
  for (const snapshot of visualSnapshots) {
    const bucketIndex = Math.floor((snapshot.timestamp - sessionStart) / BUCKET_DURATION_MS);
    if (bucketIndex >= 0 && bucketIndex < buckets.length) {
      buckets[bucketIndex].snapshots.push(snapshot);
    }
  }

  return buckets;
}

// ============================================================================
// Component
// ============================================================================

export function PulseGraph({ events, sessionStart, sessionEnd, onSeek, currentTimestamp, visualSnapshots = [] }: PulseGraphProps) {
  // Phase 2: Hover state for snapshot preview
  const [hoveredSnapshot, setHoveredSnapshot] = useState<{ snapshot: VisualSnapshot; x: number; y: number } | null>(null);

  // Calculate effective session bounds
  const effectiveStart = useMemo(() => {
    if (events.length === 0) return sessionStart;
    const firstEvent = Math.min(...events.map(e => e.timestamp));
    return Math.min(sessionStart, firstEvent);
  }, [events, sessionStart]);

  const effectiveEnd = useMemo(() => {
    if (events.length === 0) return sessionEnd || Date.now();
    const lastEvent = Math.max(...events.map(e => e.timestamp));
    return Math.max(sessionEnd || Date.now(), lastEvent);
  }, [events, sessionEnd]);

  // Calculate buckets
  const buckets = useMemo(() => {
    return calculateBuckets(events, effectiveStart, effectiveEnd, visualSnapshots);
  }, [events, effectiveStart, effectiveEnd, visualSnapshots]);

  // Find max volume for scaling
  const maxVolume = useMemo(() => {
    const max = Math.max(...buckets.map(b => b.volume), 1);
    return max;
  }, [buckets]);

  // Calculate session duration
  const duration = effectiveEnd - effectiveStart;

  // Calculate current position for replay indicator
  const currentPositionPercent = useMemo(() => {
    if (currentTimestamp === null || currentTimestamp === undefined || duration === 0) {
      return null;
    }
    const elapsed = currentTimestamp - effectiveStart;
    const percent = Math.max(0, Math.min(100, (elapsed / duration) * 100));
    return percent;
  }, [currentTimestamp, effectiveStart, duration]);

  // Calculate which bucket index corresponds to current timestamp
  const currentBucketIndex = useMemo(() => {
    if (currentTimestamp === null || currentTimestamp === undefined) return null;
    const elapsed = currentTimestamp - effectiveStart;
    const index = Math.floor(elapsed / BUCKET_DURATION_MS);
    return Math.max(0, Math.min(index, buckets.length - 1));
  }, [currentTimestamp, effectiveStart, buckets.length]);

  // Handle bar click for seeking
  const handleBarClick = (bucket: Bucket) => {
    if (onSeek) {
      // Seek to the middle of the bucket
      const midTime = bucket.startTime + (bucket.endTime - bucket.startTime) / 2;
      onSeek(midTime);
    }
  };

  if (events.length === 0) {
    return (
      <div className="bg-gray-800/50 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">📈</span>
            <h3 className="font-semibold text-sm">Activity Pulse</h3>
          </div>
          <span className="text-xs text-gray-500">No activity data</span>
        </div>
        <div className="h-[60px] flex items-center justify-center text-gray-500 text-sm">
          Waiting for activity...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border-b border-gray-700 px-6 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">📈</span>
          <h3 className="font-semibold text-sm">Activity Pulse</h3>
          <span className="text-xs text-gray-500">
            ({buckets.length} intervals, {formatDuration(duration)} total)
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Normal
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            Warning
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            Critical
          </span>
        </div>
      </div>

      {/* SVG Graph */}
      <div className="relative">
        <svg
          width="100%"
          height={SVG_HEIGHT}
          viewBox={`0 0 ${buckets.length * (4 + BAR_GAP)} ${SVG_HEIGHT}`}
          preserveAspectRatio="none"
          className="rounded"
        >
          {/* Background */}
          <rect
            x="0"
            y="0"
            width={buckets.length * (4 + BAR_GAP)}
            height={SVG_HEIGHT}
            fill="#1f2937"
            rx="4"
          />

          {/* Bars */}
          {buckets.map((bucket, index) => {
            // Calculate bar height based on volume
            const normalizedHeight = bucket.volume > 0
              ? Math.max(
                  MIN_BAR_HEIGHT + ((bucket.volume / maxVolume) * (SVG_HEIGHT - MIN_BAR_HEIGHT - 4)),
                  MIN_BAR_HEIGHT
                )
              : MIN_BAR_HEIGHT;

            // Get color based on max severity in bucket
            const color = bucket.volume > 0
              ? severityToColor(bucket.maxSeverity)
              : '#374151'; // gray-700 for idle

            // Check if this is the current bucket in replay mode
            const isCurrentBucket = currentBucketIndex === index;

            return (
              <g
                key={index}
                onClick={() => handleBarClick(bucket)}
                style={{ cursor: onSeek ? 'pointer' : 'default' }}
              >
                <rect
                  x={index * (4 + BAR_GAP)}
                  y={SVG_HEIGHT - normalizedHeight - 2}
                  width={4}
                  height={normalizedHeight}
                  fill={color}
                  rx="1"
                  className={`transition-all duration-200 ${onSeek ? 'hover:opacity-80' : ''}`}
                  opacity={isCurrentBucket ? 1 : (currentBucketIndex !== null && index > currentBucketIndex ? 0.3 : 1)}
                >
                  <title>
                    {`Time: ${formatDuration(bucket.startTime - effectiveStart)} - ${formatDuration(bucket.endTime - effectiveStart)}\n` +
                     `Volume: ${bucket.volume} chars\n` +
                     `Events: ${bucket.events.length}\n` +
                     `Severity: ${bucket.maxSeverity}`}
                  </title>
                </rect>
                {/* Highlight current bucket in replay mode */}
                {isCurrentBucket && (
                  <rect
                    x={index * (4 + BAR_GAP) - 1}
                    y={0}
                    width={6}
                    height={SVG_HEIGHT}
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="1"
                    rx="2"
                    className="animate-pulse"
                  />
                )}
                {/* Phase 2: Camera icon for buckets with visual snapshots */}
                {bucket.snapshots.length > 0 && (
                  <g
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredSnapshot({
                        snapshot: bucket.snapshots[0],
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }}
                    onMouseLeave={() => setHoveredSnapshot(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      cx={index * (4 + BAR_GAP) + 2}
                      cy={4}
                      r={3}
                      fill="#3b82f6"
                      stroke="#1e3a8a"
                      strokeWidth="0.5"
                    />
                    <text
                      x={index * (4 + BAR_GAP) + 2}
                      y={5.5}
                      textAnchor="middle"
                      fontSize="4"
                      fill="white"
                    >
                      📷
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Current position indicator line (replay mode) */}
          {currentPositionPercent !== null && (
            <line
              x1={`${currentPositionPercent}%`}
              y1="0"
              x2={`${currentPositionPercent}%`}
              y2={SVG_HEIGHT}
              stroke="#a855f7"
              strokeWidth="2"
              className="transition-all duration-150"
            />
          )}
        </svg>

        {/* Time labels */}
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          <span>0:00</span>
          {duration >= 60000 && (
            <span>{formatDuration(Math.floor(duration / 2))}</span>
          )}
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      {/* Quick stats */}
      <div className="flex gap-4 mt-2 text-xs text-gray-400">
        <span>
          Peak: {maxVolume} chars
        </span>
        <span>
          Critical events: {events.filter(e => getEventSeverity(e.type) === 'critical').length}
        </span>
        <span>
          Warnings: {events.filter(e => getEventSeverity(e.type) === 'warning').length}
        </span>
        {visualSnapshots.length > 0 && (
          <span className="text-blue-400">
            📷 {visualSnapshots.length} snapshots
          </span>
        )}
      </div>

      {/* Phase 2: Snapshot hover preview tooltip */}
      {hoveredSnapshot && (
        <div
          className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-2"
          style={{
            left: Math.max(10, Math.min(hoveredSnapshot.x - 100, window.innerWidth - 220)),
            top: hoveredSnapshot.y + 20,
          }}
        >
          <img
            src={hoveredSnapshot.snapshot.imageData}
            alt="Webcam snapshot"
            className="w-48 h-36 object-cover rounded"
          />
          <div className="mt-1 text-xs text-gray-400 text-center">
            {new Date(hoveredSnapshot.snapshot.timestamp).toLocaleTimeString()} |{' '}
            <span className="text-blue-400">{hoveredSnapshot.snapshot.trigger}</span>
          </div>
        </div>
      )}
    </div>
  );
}
