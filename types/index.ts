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
  | 'bulk_insert';

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
