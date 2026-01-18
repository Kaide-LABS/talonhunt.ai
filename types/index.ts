// Session types
export interface Session {
  sessionId: string;
  status: 'active' | 'completed' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  language: string;
  candidateName?: string;
  integrityScore: number; // 0-100
}

// Integrity event types
export type IntegrityEventType =
  | 'paste'
  | 'focus_loss'
  | 'velocity_spike'
  | 'linearity_alert'
  | 'rhythm_anomaly'
  | 'bulk_insert'
  | 'read_pattern_warning'          // Day 4: Phone/overlay cheating (oscillation detection)
  | 'suspicious_return'             // Day 4: ChatGPT memory dump pattern
  | 'research_break'                // Day 4: Legitimate doc reading (BONUS)
  | 'telemetry_heartbeat'           // Day 5: Activity heartbeat for Pulse Graph (every 5s)
  | 'challenge_selected'            // Day 5: Challenge selection metadata
  | 'interrogation_triggered'       // Day 5: When interrogation starts (suspicious event)
  | 'interrogation_completed'       // Day 5: When candidate answers interrogation
  | 'post_return_burst_suspicious'  // Day 5: Memory dump typing pattern (fast+consistent after return)
  | 'low_undo_ratio'                // Day 5: Suspiciously clean typing (no mistakes)
  | 'adaptive_consistency'          // Phase 3: 30s stable within baseline (positive)
  | 'adaptive_anomaly'              // Phase 3: Significant deviation from baseline
  | 'adaptive_heartbeat';           // Phase 3: 45s check-in (neutral)

export type IntegritySeverity = 'info' | 'warning' | 'critical';

export interface IntegrityEvent {
  sessionId: string;
  timestamp: Date;
  eventType: IntegrityEventType;
  severity: IntegritySeverity;
  data: Record<string, unknown>;
}

// Code snapshot types
export interface CodeSnapshot {
  sessionId: string;
  timestamp: Date;
  code: string;
  cursorPosition: {
    line: number;
    column: number;
  };
}

// Ably message types
export interface CodeUpdateMessage {
  code: string;
  timestamp: number;
  cursorPosition?: {
    line: number;
    column: number;
  };
}

export interface IntegrityEventMessage {
  eventType: IntegrityEventType;
  severity: IntegritySeverity;
  data: Record<string, unknown>;
  timestamp: number;
}

// API response types
export interface CreateSessionResponse {
  sessionId: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  language: string;
  integrityScore: number;
}

export interface ApiError {
  error: string;
  message: string;
}

// Telemetry types for Day 2
export interface TelemetryEvent {
  type: IntegrityEventType;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface IntegrityEventBatch {
  sessionId: string;
  events: TelemetryEvent[];
}

export interface EventsApiResponse {
  stored: number;
}

// Replay snapshot types (Day 5: Session Replay)
export type ReplaySnapshotTrigger = 'interval' | 'session_end' | 'challenge_change' | 'bulk_insert';

// Phase 2: Visual snapshot types (Webcam Telemetry)
export type VisualSnapshotTrigger =
  | 'interval'                       // 45-second heartbeat
  | 'suspicious_return'              // Tab return after ChatGPT usage
  | 'bulk_insert'                    // Large code injection
  | 'focus_loss'                     // Tab switch away
  | 'post_return_burst_suspicious';  // Memory dump typing pattern

export interface VisualSnapshot {
  _id?: string;
  sessionId: string;
  sequenceNumber: number;
  timestamp: number;
  imageData: string;  // Base64 JPEG
  trigger: VisualSnapshotTrigger;
  aiAnalysis?: string;  // Phase 3: Gemini Vision analysis result
}

// Phase 2: AI Live Commentary types
export type AIVerdictType = 'suspicious' | 'concerning' | 'normal' | 'positive';

export interface AIVerdictMessage {
  timestamp: number;
  verdict: AIVerdictType;
  eventType: IntegrityEventType | 'adaptive_consistency' | 'adaptive_anomaly' | 'adaptive_heartbeat' | 'visual_anomaly';
  summary: string;
  confidence: number;  // 0-100
  metrics?: BaselineMetrics;  // Phase 3: Include metrics for live display
}

// Phase 3: Adaptive AI Commentary types
export interface BaselineMetrics {
  baselineWPM: number | null;           // Established baseline words per minute
  baselineBackspaceRatio: number | null; // Established baseline correction ratio
  currentWPM: number;                    // Real-time WPM
  currentBackspaceRatio: number;         // Real-time correction ratio
  baselineEstablished: boolean;          // True after 60s + 100 chars
  sessionDurationMs: number;             // Time since first keystroke
  charactersTyped: number;               // Total characters typed
}

export type AdaptiveTriggerType = 'consistency' | 'anomaly' | 'heartbeat';

export interface LiveCommentaryRequest {
  sessionId: string;
  baselineWPM: number | null;
  currentWPM: number;
  baselineBackspaceRatio: number | null;
  currentBackspaceRatio: number;
  eventType: AdaptiveTriggerType;
  recentEvents: Array<{ type: IntegrityEventType; timestamp: number }>;
}

// Day 5: AI-Annotated Replay - Activity classification
export type ActivityAnnotation =
  | 'thinking'           // Extended pause, likely reading/planning
  | 'coding'             // Active typing, adding code
  | 'debugging'          // Code removal detected
  | 'suspicious_paste'   // Large code injection detected
  | 'idle';              // No activity

export interface ReplaySnapshot {
  _id?: string;
  sessionId: string;
  sequenceNumber: number;     // 0, 1, 2... for ordering
  timestamp: number;          // Unix ms
  code: string;               // Full code at this moment
  cursorPosition?: { line: number; column: number };
  metadata: {
    charCount: number;
    lineCount: number;
    trigger: ReplaySnapshotTrigger;
  };
  // Day 5: AI-Annotated Replay
  annotation?: {
    activity: ActivityAnnotation;
    confidence: number;       // 0-100
    reason: string;
  };
}
