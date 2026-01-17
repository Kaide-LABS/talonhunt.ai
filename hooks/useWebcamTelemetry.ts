'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { VisualSnapshotTrigger } from '@/types';

interface UseWebcamTelemetryOptions {
  sessionId: string;
  enabled?: boolean;
  maxSnapshots?: number;      // Default 30
  reservedSlots?: number;     // Default 10 (for event-triggered snapshots)
  intervalMs?: number;        // Default 45000 (45 seconds)
}

interface UseWebcamTelemetryReturn {
  hasPermission: boolean;
  permissionDenied: boolean;
  snapshotCount: number;
  captureSnapshot: (trigger: VisualSnapshotTrigger) => Promise<void>;
  isCapturing: boolean;
  isCapped: boolean;
}

const DEFAULT_MAX_SNAPSHOTS = 30;
const DEFAULT_RESERVED_SLOTS = 10;
const DEFAULT_INTERVAL_MS = 45000; // 45 seconds

/**
 * Smart Budgeting Logic:
 * - Hard cap: 30 snapshots max
 * - Heartbeat (interval) snapshots stop at count >= 20
 * - Event-triggered snapshots continue until count >= 30
 */
function shouldCapture(
  trigger: VisualSnapshotTrigger,
  count: number,
  maxSnapshots: number,
  reservedSlots: number
): boolean {
  // Hard cap reached
  if (count >= maxSnapshots) return false;

  // Reservation rule: stop heartbeats when approaching cap
  if (trigger === 'interval' && count >= maxSnapshots - reservedSlots) {
    return false;
  }

  return true;
}

export function useWebcamTelemetry({
  sessionId,
  enabled = true,
  maxSnapshots = DEFAULT_MAX_SNAPSHOTS,
  reservedSlots = DEFAULT_RESERVED_SLOTS,
  intervalMs = DEFAULT_INTERVAL_MS,
}: UseWebcamTelemetryOptions): UseWebcamTelemetryReturn {
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const isCapped = snapshotCount >= maxSnapshots;

  // Capture snapshot and send to API
  const captureSnapshot = useCallback(async (trigger: VisualSnapshotTrigger) => {
    if (!videoRef.current || !canvasRef.current || !hasPermission) {
      console.log('[Webcam] Cannot capture: no video or permission');
      return;
    }

    // Check smart budgeting
    if (!shouldCapture(trigger, snapshotCount, maxSnapshots, reservedSlots)) {
      console.log('[Webcam] Skipping capture due to smart budgeting:', {
        trigger,
        count: snapshotCount,
        maxSnapshots,
        reservedSlots,
      });
      return;
    }

    if (isCapturing) {
      console.log('[Webcam] Already capturing, skipping');
      return;
    }

    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx || video.readyState < 2) {
        console.log('[Webcam] Video not ready');
        return;
      }

      // Draw video frame to canvas
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to JPEG base64 (0.6 quality for smaller size)
      const imageData = canvas.toDataURL('image/jpeg', 0.6);

      console.log('[Webcam] Capturing snapshot:', {
        trigger,
        count: snapshotCount + 1,
        imageSize: Math.round(imageData.length / 1024) + 'KB',
      });

      // Send to API
      const response = await fetch('/api/visual-snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          imageData,
          trigger,
        }),
      });

      const result = await response.json();

      if (isMountedRef.current) {
        if (result.success) {
          setSnapshotCount(result.count);
        } else if (result.reason === 'max_snapshots_reached') {
          setSnapshotCount(result.count);
        }
      }
    } catch (error) {
      console.error('[Webcam] Failed to capture snapshot:', error);
    } finally {
      if (isMountedRef.current) {
        setIsCapturing(false);
      }
    }
  }, [sessionId, hasPermission, snapshotCount, maxSnapshots, reservedSlots, isCapturing]);

  // Request camera permission and set up stream
  useEffect(() => {
    if (!enabled || !sessionId) return;

    isMountedRef.current = true;

    // Create hidden video and canvas elements
    const video = document.createElement('video');
    video.setAttribute('playsinline', 'true');
    video.setAttribute('autoplay', 'true');
    video.muted = true;
    video.style.display = 'none';
    document.body.appendChild(video);
    videoRef.current = video;

    const canvas = document.createElement('canvas');
    canvas.style.display = 'none';
    document.body.appendChild(canvas);
    canvasRef.current = canvas;

    // Request camera access
    const requestCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
        });

        if (!isMountedRef.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();

        setHasPermission(true);
        setPermissionDenied(false);

        console.log('[Webcam] Camera permission granted, stream active');
      } catch (error) {
        console.error('[Webcam] Camera permission denied:', error);
        if (isMountedRef.current) {
          setPermissionDenied(true);
          setHasPermission(false);
        }
      }
    };

    requestCamera();

    return () => {
      isMountedRef.current = false;

      // Stop interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Stop media stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Remove video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.remove();
        videoRef.current = null;
      }

      // Remove canvas element
      if (canvasRef.current) {
        canvasRef.current.remove();
        canvasRef.current = null;
      }
    };
  }, [enabled, sessionId]);

  // Set up interval capture (heartbeat)
  useEffect(() => {
    if (!hasPermission || !enabled) return;

    // Start interval capture
    intervalRef.current = setInterval(() => {
      captureSnapshot('interval');
    }, intervalMs);

    // Capture initial snapshot
    captureSnapshot('interval');

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [hasPermission, enabled, intervalMs, captureSnapshot]);

  return {
    hasPermission,
    permissionDenied,
    snapshotCount,
    captureSnapshot,
    isCapturing,
    isCapped,
  };
}
