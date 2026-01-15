// lib/IntegrityTracker.ts
// Keystroke dynamics tracker using Welford's Algorithm for real-time variance

import type { IntegrityEventType, TelemetryEvent } from '@/types';

export class IntegrityTracker {
  private buffer: TelemetryEvent[] = [];
  private lastKeyTime: number = 0;

  // Welford's Algorithm state for running variance
  private count = 0;
  private mean = 0;
  private M2 = 0; // Sum of squares of differences from mean

  constructor(
    private sessionId: string,
    private onAnomaly: (event: TelemetryEvent) => void
  ) {}

  /**
   * Track a keystroke event
   * Calculates inter-key latency and checks for anomalies
   */
  public trackKeystroke(char: string): void {
    const now = Date.now();

    // Ignore first key of session (no previous time to compare)
    if (this.lastKeyTime === 0) {
      this.lastKeyTime = now;
      return;
    }

    const latency = now - this.lastKeyTime;
    this.lastKeyTime = now;

    // 1. Critical Velocity Check (Machine speed detection)
    // Human typing rarely goes below 30ms between keystrokes
    if (latency < 30) {
      this.addEvent('velocity_spike', { latency, char });
    }

    // 2. Update Running Variance (Human Rhythm Check)
    this.updateStats(latency);

    // Check for robotic consistency after baseline established
    // Variance < 50 indicates unnaturally consistent rhythm (AI transcription)
    // Real human typing has high variance (think, type fast, pause, delete, etc.)
    if (this.count > 50 && this.getVariance() < 50) {
      this.addEvent('rhythm_anomaly', {
        variance: this.getVariance(),
        meanLatency: this.mean,
        keystrokeCount: this.count,
      });
      this.resetStats(); // Reset to avoid spamming alerts
    }
  }

  /**
   * Track a paste event
   * Large pastes (>50 chars) are flagged as potential AI assistance
   */
  public trackPaste(length: number): void {
    if (length > 50) {
      this.addEvent('paste', { length });
    }
  }

  /**
   * Track window focus changes
   * Focus loss may indicate switching to AI tool (Cluely overlay, etc.)
   */
  public trackFocus(focused: boolean): void {
    if (!focused) {
      this.addEvent('focus_loss', { timestamp: Date.now() });
    }
  }

  /**
   * Add event to buffer and trigger anomaly callback for critical events
   */
  private addEvent(type: IntegrityEventType, data: Record<string, unknown>): void {
    const event: TelemetryEvent = { type, timestamp: Date.now(), data };
    this.buffer.push(event);

    // Real-time alert for critical events
    if (type === 'paste' || type === 'velocity_spike') {
      this.onAnomaly(event);
    }
  }

  /**
   * Welford's Algorithm for online variance calculation
   * Allows computing running mean and variance without storing all values
   */
  private updateStats(newValue: number): void {
    this.count++;
    const delta = newValue - this.mean;
    this.mean += delta / this.count;
    const delta2 = newValue - this.mean;
    this.M2 += delta * delta2;
  }

  /**
   * Get current variance from Welford's state
   * Returns sample variance (n-1 denominator)
   */
  private getVariance(): number {
    return this.count < 2 ? 0 : this.M2 / (this.count - 1);
  }

  /**
   * Reset statistics after triggering an anomaly
   * Prevents repeated alerts for the same behavior
   */
  private resetStats(): void {
    this.count = 0;
    this.mean = 0;
    this.M2 = 0;
  }

  /**
   * Get current metrics snapshot
   */
  public getMetrics(): { mean: number; variance: number; count: number } {
    return {
      mean: this.mean,
      variance: this.getVariance(),
      count: this.count,
    };
  }

  /**
   * Flush buffer and return events for batch storage
   * Clears buffer after returning
   */
  public flush(): TelemetryEvent[] {
    const events = [...this.buffer];
    this.buffer = [];
    return events;
  }
}
