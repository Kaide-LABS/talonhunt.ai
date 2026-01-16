// lib/IntegrityTracker.ts
// Keystroke dynamics tracker using Welford's Algorithm for real-time variance
// Day 3: Added LinearityIndex, enhanced RhythmVariance, bulk_insert detection
// Day 4: Added Oscillation detection, Return Signature analysis

import type { IntegrityEventType, TelemetryEvent } from '@/types';

// ============================================================================
// TUNABLE THRESHOLDS - Adjust these to calibrate detection sensitivity
// ============================================================================

// Oscillation Detection (Phone/Overlay Cheating)
// Catches read-type pattern: type ~15 chars, pause 1.5s, repeat
const OSCILLATION_CONFIG = {
  MIN_BURSTS: 8,                // Minimum bursts needed to analyze pattern
  BURST_GAP_MS: 1000,           // Pause duration (ms) that separates bursts
  MAX_BURST_CV: 0.4,            // Max coefficient of variation for burst lengths
  MAX_PAUSE_CV: 0.3,            // Tightened from 0.4 - stricter consistency check for "Fast Glancers"
  MIN_BURST_LENGTH: 3,          // Lowered from 5 to catch "micro-transcribers" (phone glancers)
  MAX_BURST_LENGTH: 30,         // Maximum chars per burst (tunable per Gemini)
  MIN_MEAN_PAUSE_MS: 500,       // Lowered from 1000 - catches quick "eyes-darting" checks
};

// Return Signature Analysis (Miner vs Printer)
// Distinguishes doc readers (good) from ChatGPT copiers (bad)
const RETURN_SIGNATURE_CONFIG = {
  MIN_BREAK_DURATION_MS: 5000,  // Lowered from 10s - users read ChatGPT snippets in 5-8s
  PRINTER_LATENCY_MS: 1000,     // Raised from 800ms - accounts for UI lag/system jitter
  MINER_LATENCY_MS: 2000,       // >2000ms = cognitive pause (doc reading)
};

// ============================================================================

interface CursorPosition {
  line: number;
  col: number;
  time: number;
}

interface Burst {
  length: number;      // Characters typed in this burst
  startTime: number;   // When burst started
  endTime: number;     // When burst ended
}

export class IntegrityTracker {
  private buffer: TelemetryEvent[] = [];
  private lastKeyTime: number = 0;

  // Welford's Algorithm state for running variance
  private count = 0;
  private mean = 0;
  private M2 = 0; // Sum of squares of differences from mean

  // Linearity tracking - cursor movement history
  private cursorHistory: CursorPosition[] = [];
  private readonly linearityWindow = 50; // Analyze last 50 cursor moves

  // Bulk insert tracking - detect code injection without keystrokes
  private lastCharCount = 0;
  private keystrokesSinceContentCheck = 0;

  // Focus tracking - ABSENCE of focus_loss is suspicious for Cluely detection
  // Cluely uses overlays so users don't switch tabs
  // Legitimate copying from docs requires tab switching
  private focusLossCount = 0;
  private keystrokesSinceLastFocusLoss = 0;

  // Day 4: Oscillation detection (phone/overlay cheating)
  // Tracks typing "bursts" separated by pauses
  private bursts: Burst[] = [];
  private currentBurstLength = 0;
  private currentBurstStartTime = 0;

  // Day 4: Return signature analysis
  // Tracks focus loss timing to analyze return pattern
  private lastFocusLostTime = 0;
  private lastFocusRegainedTime = 0;
  private awaitingReturnKeystroke = false;

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

    // Track keystrokes for bulk_insert detection
    this.keystrokesSinceContentCheck++;

    // Track keystrokes since last focus loss (for Cluely detection)
    this.keystrokesSinceLastFocusLoss++;

    // Day 4: Return Signature Analysis
    // Check if this is the first keystroke after regaining focus
    if (this.awaitingReturnKeystroke) {
      console.log('[IntegrityTracker] First keystroke after return detected!');
      this.analyzeReturnSignature(now);
      this.awaitingReturnKeystroke = false;
    }

    // Ignore first key of session (no previous time to compare)
    if (this.lastKeyTime === 0) {
      this.lastKeyTime = now;
      this.currentBurstStartTime = now; // Start first burst
      this.currentBurstLength = 1;
      return;
    }

    const latency = now - this.lastKeyTime;
    this.lastKeyTime = now;

    // Day 4: Oscillation Detection - Track bursts
    this.trackBurst(latency, now);

    // 1. Critical Velocity Check (Machine speed detection)
    // Human typing rarely goes below 30ms between keystrokes
    if (latency < 30) {
      this.addEvent('velocity_spike', { latency, char });
    }

    // 2. Update Running Variance (Human Rhythm Check)
    this.updateStats(latency);

    // 3. Enhanced Two-Factor Rhythm Analysis
    this.checkRhythmAnomaly();
  }

  /**
   * Day 4: Track typing bursts for oscillation detection
   * A burst ends when pause exceeds BURST_GAP_MS
   */
  private trackBurst(latency: number, now: number): void {
    if (latency >= OSCILLATION_CONFIG.BURST_GAP_MS) {
      // Pause detected - end current burst
      if (this.currentBurstLength > 0) {
        this.bursts.push({
          length: this.currentBurstLength,
          startTime: this.currentBurstStartTime,
          endTime: now - latency, // End time is before the pause
        });
      }
      // Start new burst
      this.currentBurstStartTime = now;
      this.currentBurstLength = 1;

      // Analyze oscillation pattern if enough bursts collected
      if (this.bursts.length >= OSCILLATION_CONFIG.MIN_BURSTS) {
        this.analyzeOscillation();
      }
    } else {
      // Continue current burst
      this.currentBurstLength++;
    }
  }

  /**
   * Day 4: Oscillation Detection Algorithm
   * Detects phone/overlay cheating via read-type pattern analysis
   *
   * Detection criteria (all must be met):
   * - Burst length CV < 0.4 (regular burst sizes)
   * - Pause duration CV < 0.4 (regular pauses)
   * - Mean burst length 5-30 chars (reading/typing chunks)
   * - Mean pause > 1000ms (reading time)
   */
  private analyzeOscillation(): void {
    const burstLengths = this.bursts.map(b => b.length);
    const pauseDurations: number[] = [];

    // Calculate pause durations between bursts
    for (let i = 1; i < this.bursts.length; i++) {
      const pause = this.bursts[i].startTime - this.bursts[i - 1].endTime;
      pauseDurations.push(pause);
    }

    if (pauseDurations.length < OSCILLATION_CONFIG.MIN_BURSTS - 1) return;

    // Calculate statistics
    const burstStats = this.calculateStats(burstLengths);
    const pauseStats = this.calculateStats(pauseDurations);

    const burstCV = burstStats.std / burstStats.mean; // Coefficient of Variation
    const pauseCV = pauseStats.std / pauseStats.mean;

    // Check all oscillation criteria
    const isRegularBursts = burstCV < OSCILLATION_CONFIG.MAX_BURST_CV;
    const isRegularPauses = pauseCV < OSCILLATION_CONFIG.MAX_PAUSE_CV;
    const isBurstInRange = burstStats.mean >= OSCILLATION_CONFIG.MIN_BURST_LENGTH &&
                           burstStats.mean <= OSCILLATION_CONFIG.MAX_BURST_LENGTH;
    const isReadingPause = pauseStats.mean >= OSCILLATION_CONFIG.MIN_MEAN_PAUSE_MS;

    if (isRegularBursts && isRegularPauses && isBurstInRange && isReadingPause) {
      this.addEvent('read_pattern_warning', {
        burstCV: Math.round(burstCV * 100) / 100,
        pauseCV: Math.round(pauseCV * 100) / 100,
        meanBurstLength: Math.round(burstStats.mean * 10) / 10,
        meanPause: Math.round(pauseStats.mean),
        burstCount: this.bursts.length,
        message: 'Read-type pattern detected (phone/overlay cheating)',
      });
      // Reset bursts after detection to avoid spam
      this.bursts = [];
    } else if (this.bursts.length > OSCILLATION_CONFIG.MIN_BURSTS * 2) {
      // If pattern doesn't match and we have too many bursts, trim old ones
      this.bursts = this.bursts.slice(-OSCILLATION_CONFIG.MIN_BURSTS);
    }
  }

  /**
   * Day 4: Return Signature Analysis (Miner vs Printer)
   *
   * The Miner (Doc Reader - GOOD):
   * - Returns with HIGH latency (>2s cognitive pause)
   * - Brain is translating docs to their context
   * - Result: research_break (+5 BONUS)
   *
   * The Printer (ChatGPT Copier - BAD):
   * - Returns with LOW latency (<800ms instant dump)
   * - Memory buffer fading fast, must type immediately
   * - Result: suspicious_return (-10 penalty)
   */
  private analyzeReturnSignature(firstKeystrokeTime: number): void {
    const breakDuration = this.lastFocusRegainedTime - this.lastFocusLostTime;
    const returnLatency = firstKeystrokeTime - this.lastFocusRegainedTime;

    console.log('[IntegrityTracker] Return Signature Analysis:', {
      breakDuration,
      returnLatency,
      minBreakRequired: RETURN_SIGNATURE_CONFIG.MIN_BREAK_DURATION_MS,
      printerThreshold: RETURN_SIGNATURE_CONFIG.PRINTER_LATENCY_MS,
      minerThreshold: RETURN_SIGNATURE_CONFIG.MINER_LATENCY_MS,
    });

    // Only analyze if break was long enough to be meaningful
    if (breakDuration < RETURN_SIGNATURE_CONFIG.MIN_BREAK_DURATION_MS) {
      console.log('[IntegrityTracker] Break too short, skipping analysis');
      return;
    }

    if (returnLatency < RETURN_SIGNATURE_CONFIG.PRINTER_LATENCY_MS) {
      // The Printer: Instant typing = memory dump from ChatGPT
      console.log('[IntegrityTracker] PRINTER pattern detected!');
      this.addEvent('suspicious_return', {
        returnLatency,
        breakDuration,
        message: 'Memory dump pattern (immediate typing after break)',
      });
    } else if (returnLatency > RETURN_SIGNATURE_CONFIG.MINER_LATENCY_MS) {
      // The Miner: Cognitive pause = legitimate doc reading
      console.log('[IntegrityTracker] MINER pattern detected (good)');
      this.addEvent('research_break', {
        returnLatency,
        breakDuration,
        message: 'Cognitive pause detected (legitimate research)',
      });
    } else {
      console.log('[IntegrityTracker] Ambiguous return latency (800-2000ms)');
    }
  }

  /**
   * Helper: Calculate mean and standard deviation for an array
   */
  private calculateStats(values: number[]): { mean: number; std: number } {
    if (values.length === 0) return { mean: 0, std: 0 };

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(variance);

    return { mean, std };
  }

  /**
   * Track cursor position for LinearityIndex calculation
   * AI transcription tools type linearly (cursor always advances by 1)
   * Humans jump around: backspace, click to edit, arrow keys
   */
  public trackCursor(line: number, col: number): void {
    const now = Date.now();
    this.cursorHistory.push({ line, col, time: now });

    // Keep sliding window at max size
    if (this.cursorHistory.length > this.linearityWindow) {
      this.cursorHistory.shift();
      this.analyzeLinearity();
    }
  }

  /**
   * Analyze cursor movement pattern for transcription detection
   * COMPOUND DETECTION: Only flags when BOTH high linearity AND suspicious rhythm
   * This reduces false positives from fast accurate typists
   */
  private analyzeLinearity(): void {
    if (this.cursorHistory.length < this.linearityWindow) return;

    let linearMoves = 0;

    for (let i = 1; i < this.cursorHistory.length; i++) {
      const prev = this.cursorHistory[i - 1];
      const curr = this.cursorHistory[i];

      // Check if cursor moved exactly 1 char forward on same line
      // This is the signature of transcription: perfectly sequential typing
      if (curr.line === prev.line && curr.col === prev.col + 1) {
        linearMoves++;
      }
    }

    const linearityIndex = linearMoves / (this.cursorHistory.length - 1);

    // COMPOUND CHECK: High linearity ALONE is not enough
    // Many skilled typists can type long stretches without backspacing
    // We need BOTH high linearity AND suspicious rhythm (low variance)
    // ALSO: Absence of focus_loss during sustained typing is MORE suspicious
    // because Cluely/Interview Coder use overlays (no tab switching)
    if (linearityIndex > 0.95) {
      const variance = this.getVariance();
      const meanLatency = this.mean;
      const hasEnoughSamples = this.count >= 30;

      // Check if there was focus loss during this typing session
      // NO focus_loss = more suspicious (Cluely pattern)
      // HAS focus_loss = less suspicious (probably copying from docs)
      const noFocusLoss = this.keystrokesSinceLastFocusLoss > 100;

      // Only flag if rhythm is ALSO suspicious:
      // - Very low variance (<100) indicates robotic consistency
      // - OR variance is low AND speed is in transcription range (40-100ms)
      const isSuspiciousRhythm = hasEnoughSamples && (
        variance < 100 ||
        (variance < 200 && meanLatency >= 30 && meanLatency <= 100)
      );

      // TRIPLE compound: linearity + rhythm + no focus loss
      // If user has focus_loss events, they're probably copying from docs (legitimate)
      if (isSuspiciousRhythm && noFocusLoss) {
        this.addEvent('linearity_alert', {
          linearityIndex: Math.round(linearityIndex * 100) / 100,
          windowSize: this.cursorHistory.length,
          linearMoves,
          variance: Math.round(variance * 100) / 100,
          meanLatency: Math.round(meanLatency * 100) / 100,
          keystrokesSinceLastFocusLoss: this.keystrokesSinceLastFocusLoss,
          message: 'High probability of AI transcription (Cluely pattern: no tab switching)',
        });
        // Reset all to avoid spamming alerts
        this.cursorHistory = [];
        this.resetStats();
      } else {
        // High linearity but either:
        // - Normal rhythm variance (skilled fast typist)
        // - Has focus_loss events (probably copying from docs)
        // Don't alert, but reset linearity window to start fresh
        this.cursorHistory = [];
      }
    }
  }

  /**
   * Track content changes for bulk_insert detection
   * Detects code injection that bypasses normal keystroke events
   */
  public trackContentChange(newCharCount: number, changeLength: number): void {
    const charDelta = newCharCount - this.lastCharCount;
    const keystrokes = this.keystrokesSinceContentCheck;

    // Reset counters
    this.lastCharCount = newCharCount;
    this.keystrokesSinceContentCheck = 0;

    // Skip initial setup, deletions, and small changes
    if (this.lastCharCount === 0 || charDelta <= 0 || charDelta <= 5) {
      return;
    }

    // Skip if this looks like a paste (handled by trackPaste)
    if (changeLength > 50) {
      return;
    }

    // Detect bulk insert: significant char growth without matching keystrokes
    // >20 chars appearing with <3 keystrokes = suspicious injection
    // Raised from 10 to 20 to allow normal autocomplete (console.log, System.out.println)
    if (charDelta > 20 && keystrokes < 3) {
      this.addEvent('bulk_insert', {
        charDelta,
        keystrokes,
        ratio: keystrokes > 0 ? Math.round(charDelta / keystrokes) : charDelta,
        message: 'Code injection detected',
      });
    }
  }

  /**
   * Initialize content state with starting character count
   */
  public initializeContentState(initialCharCount: number): void {
    this.lastCharCount = initialCharCount;
    this.keystrokesSinceContentCheck = 0;
  }

  /**
   * Enhanced Two-Factor Rhythm Check
   * Factor 1: Low variance (robotic consistency)
   * Factor 2: Mean latency in transcription range (40-80ms = reading speed)
   */
  private checkRhythmAnomaly(): void {
    // Need baseline data before checking
    if (this.count < 50) return;

    const variance = this.getVariance();
    const meanLatency = this.mean;

    // Critical: Extremely low variance (<30) is always robotic
    if (variance < 30) {
      this.addEvent('rhythm_anomaly', {
        severity: 'critical',
        reason: 'Machine-like consistency',
        variance: Math.round(variance * 100) / 100,
        meanLatency: Math.round(meanLatency * 100) / 100,
        keystrokeCount: this.count,
      });
      this.resetStats();
      return;
    }

    // Warning: Low variance + transcription speed range
    // 40-80ms mean = ~200-300 wpm (reading/transcription speed)
    // Humans thinking while coding have higher variance
    if (variance < 50 && meanLatency >= 40 && meanLatency <= 80) {
      this.addEvent('rhythm_anomaly', {
        severity: 'warning',
        reason: 'Likely transcription pattern',
        variance: Math.round(variance * 100) / 100,
        meanLatency: Math.round(meanLatency * 100) / 100,
        keystrokeCount: this.count,
      });
      this.resetStats();
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
   * Focus loss is actually NORMAL behavior (checking docs, Stack Overflow)
   * The ABSENCE of focus_loss during sustained typing is MORE suspicious
   * because Cluely uses overlays - no tab switching needed
   *
   * Day 4: Also tracks timing for Return Signature Analysis
   */
  public trackFocus(focused: boolean): void {
    const now = Date.now();

    if (!focused) {
      // Lost focus - record time for return signature analysis
      this.focusLossCount++;
      this.keystrokesSinceLastFocusLoss = 0; // Reset counter
      this.lastFocusLostTime = now;
      console.log('[IntegrityTracker] Focus LOST at:', now);
      // Still log the event for analytics, but no score penalty
      this.addEvent('focus_loss', { timestamp: now });
    } else {
      // Regained focus - prepare for return signature analysis
      this.lastFocusRegainedTime = now;
      const breakDuration = now - this.lastFocusLostTime;
      console.log('[IntegrityTracker] Focus REGAINED at:', now, 'Break duration:', breakDuration, 'ms');
      // Flag that we're waiting for the first keystroke to analyze return pattern
      if (this.lastFocusLostTime > 0) {
        this.awaitingReturnKeystroke = true;
        console.log('[IntegrityTracker] Awaiting return keystroke...');
      }
    }
  }

  /**
   * Add event to buffer and trigger anomaly callback for critical events
   */
  private addEvent(type: IntegrityEventType, data: Record<string, unknown>): void {
    const event: TelemetryEvent = { type, timestamp: Date.now(), data };
    this.buffer.push(event);

    // Real-time alert for notable events via Ably
    // Day 4: Added read_pattern_warning, suspicious_return, research_break
    const notifyTypes: IntegrityEventType[] = [
      'velocity_spike',
      'rhythm_anomaly',
      'linearity_alert',
      'bulk_insert',
      'read_pattern_warning',  // Day 4: Phone/overlay cheating
      'suspicious_return',     // Day 4: ChatGPT memory dump
      'research_break',        // Day 4: Legitimate research (positive signal!)
    ];
    if (notifyTypes.includes(type)) {
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
   * Day 5: Emit telemetry heartbeat for Pulse Graph visualization
   * Called every 5 seconds to record activity even when no anomalies occur
   * Returns null if no keystrokes since last heartbeat
   */
  public emitHeartbeat(): TelemetryEvent | null {
    // Only emit if there was activity (count > 0 means keystrokes tracked)
    if (this.count === 0) return null;

    const event: TelemetryEvent = {
      type: 'telemetry_heartbeat',
      timestamp: Date.now(),
      data: {
        keystrokeCount: this.count,
        avgLatency: Math.round(this.mean),
        variance: Math.round(this.getVariance()),
      },
    };

    this.buffer.push(event);
    return event;
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
