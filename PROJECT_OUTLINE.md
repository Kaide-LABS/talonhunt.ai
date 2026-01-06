# TalonHunt Anti-Cheat Code Editor - Project Outline

## 1. Project Overview

**Product Name:** TalonHunt Integrity Sandbox (or "CodeGuard")

**Purpose:** A lightweight, embeddable code editor that detects AI-assisted cheating during technical interviews by tracking behavioral signals — without being invasive or "Big Brother."

**Target Users:**
- Technical recruiters conducting live coding interviews
- Hiring managers reviewing async coding assessments
- Companies using TalonHunt.ai for talent acquisition

**Core Value Proposition:** "Know if the code is theirs before you hire them."

---

## 2. Technical Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | React + Vite | Fast dev, easy embedding |
| Code Editor | Monaco Editor | Same engine as VS Code, rich API |
| Styling | Tailwind CSS | Rapid UI development |
| Backend | Node.js + Express | Simple, fast API |
| Database | MongoDB | Flexible document storage for event logs |
| Real-time | Socket.IO | WebSocket for live alert streaming |
| Deployment | Vercel (FE) + Railway/Render (BE) | Quick, free-tier friendly |

---

## 3. Core Features (MVP Scope)

### 3.1 Code Editor Component
- Embeddable Monaco Editor with syntax highlighting
- Support for multiple languages (JavaScript, Python, Go, etc.)
- Read-only mode for reviewers
- Configurable themes (dark/light)

### 3.2 Integrity Signals (Detection Layer)

| Signal | What It Detects | How It Works |
|--------|-----------------|--------------|
| **Paste Detection** | Large code blocks copied from external sources | Listen to `onPaste` events, flag if >50 chars |
| **Focus Loss** | Tab switching (likely querying ChatGPT) | `visibilitychange` and `blur` events |
| **Keystroke Velocity** | Inhuman typing speed | Calculate chars/second, flag if >15 chars/sec sustained |
| **Typing Patterns** | Unnatural pauses followed by bursts | Time delta analysis between keystrokes |
| **Delete Ratio** | Real coding has backspaces; pasted code doesn't | Track delete/backspace frequency |

### 3.3 Real-Time Alert System
- WebSocket connection between candidate editor and reviewer dashboard
- Toast notifications for each suspicious event
- Severity levels: `info`, `warning`, `critical`
- Timestamped event log

### 3.4 Reviewer Dashboard
- Live view of candidate's editor (read-only mirror)
- Integrity score (0-100) calculated from signals
- Event timeline with expandable details
- Session recording playback (stretch goal)

### 3.5 Session Management
- Create interview session (generates unique session ID)
- Candidate joins via link
- Session auto-expires after configurable time
- Export session report (PDF/JSON)

---

## 4. Data Models (MongoDB)

### 4.1 Session
```javascript
{
  _id: ObjectId,
  sessionId: String (unique, URL-safe),
  createdAt: Date,
  expiresAt: Date,
  status: "active" | "completed" | "expired",
  candidateName: String (optional),
  candidateEmail: String (optional),
  language: String (default: "javascript"),
  reviewerIds: [ObjectId],
  integrityScore: Number (0-100),
  metadata: Object
}
```

### 4.2 IntegrityEvent
```javascript
{
  _id: ObjectId,
  sessionId: String (ref: Session),
  timestamp: Date,
  eventType: "paste" | "focus_loss" | "focus_gain" | "velocity_spike" | "typing_burst",
  severity: "info" | "warning" | "critical",
  data: {
    // For paste events
    pastedLength: Number,
    pastedContent: String (truncated),

    // For focus events
    durationMs: Number,

    // For velocity events
    charsPerSecond: Number,
    windowSize: Number
  }
}
```

### 4.3 CodeSnapshot
```javascript
{
  _id: ObjectId,
  sessionId: String (ref: Session),
  timestamp: Date,
  code: String,
  cursorPosition: { line: Number, column: Number },
  // For playback reconstruction
}
```

### 4.4 Keystroke (optional, for deep analysis)
```javascript
{
  _id: ObjectId,
  sessionId: String,
  timestamp: Date,
  key: String,
  timeSinceLast: Number (ms)
}
```

---

## 5. API Endpoints

### Sessions
```
POST   /api/sessions              - Create new interview session
GET    /api/sessions/:id          - Get session details
PATCH  /api/sessions/:id          - Update session (e.g., mark complete)
DELETE /api/sessions/:id          - Delete session
```

### Events
```
GET    /api/sessions/:id/events   - Get all integrity events for session
POST   /api/sessions/:id/events   - Log new integrity event (internal)
```

### Snapshots
```
GET    /api/sessions/:id/snapshots - Get code snapshots for playback
POST   /api/sessions/:id/snapshots - Save code snapshot (internal)
```

### Reports
```
GET    /api/sessions/:id/report    - Generate integrity report (JSON/PDF)
```

---

## 6. WebSocket Events

### Client → Server
```javascript
// Candidate joins session
{ event: "join_session", sessionId: "xxx", role: "candidate" | "reviewer" }

// Integrity event detected
{ event: "integrity_event", sessionId: "xxx", type: "paste", data: {...} }

// Code update (for live mirror)
{ event: "code_update", sessionId: "xxx", code: "...", cursor: {...} }
```

### Server → Client (Reviewer)
```javascript
// Alert notification
{ event: "integrity_alert", type: "paste", severity: "warning", data: {...} }

// Live code mirror update
{ event: "code_mirror", code: "...", cursor: {...} }

// Score update
{ event: "score_update", score: 73 }
```

---

## 7. Frontend Components

```
src/
├── components/
│   ├── Editor/
│   │   ├── CodeEditor.jsx          # Monaco wrapper with integrity hooks
│   │   ├── IntegrityTracker.js     # Detection logic (paste, focus, velocity)
│   │   └── EditorToolbar.jsx       # Language selector, settings
│   │
│   ├── Dashboard/
│   │   ├── ReviewerDashboard.jsx   # Main reviewer view
│   │   ├── LiveMirror.jsx          # Read-only code mirror
│   │   ├── IntegrityScore.jsx      # Visual score gauge
│   │   ├── EventTimeline.jsx       # List of flagged events
│   │   └── AlertToast.jsx          # Real-time notifications
│   │
│   ├── Session/
│   │   ├── CreateSession.jsx       # Form to start new session
│   │   ├── JoinSession.jsx         # Candidate entry point
│   │   └── SessionExpired.jsx      # Expiry message
│   │
│   └── Report/
│       ├── ReportView.jsx          # Full session report
│       └── ReportExport.jsx        # PDF/JSON export
│
├── hooks/
│   ├── useIntegrityTracking.js     # Custom hook for detection logic
│   ├── useWebSocket.js             # Socket.IO connection hook
│   └── useSession.js               # Session state management
│
├── utils/
│   ├── integrityScoring.js         # Calculate score from events
│   ├── eventClassifier.js          # Determine severity of events
│   └── constants.js                # Thresholds, config values
│
└── pages/
    ├── index.jsx                   # Landing / create session
    ├── candidate/[sessionId].jsx   # Candidate editor view
    ├── review/[sessionId].jsx      # Reviewer dashboard
    └── report/[sessionId].jsx      # Post-session report
```

---

## 8. Integrity Scoring Algorithm

```javascript
// Base score starts at 100, deductions per event type

const DEDUCTIONS = {
  paste: {
    small: -5,      // < 100 chars
    medium: -15,    // 100-500 chars
    large: -30      // > 500 chars
  },
  focus_loss: {
    brief: -2,      // < 5 seconds
    moderate: -10,  // 5-30 seconds
    extended: -25   // > 30 seconds
  },
  velocity_spike: {
    mild: -5,       // 15-25 chars/sec
    severe: -20     // > 25 chars/sec
  },
  typing_burst: -10  // Long pause then rapid typing
};

// Score = max(0, 100 - sum(deductions))
// Events within 5 seconds of each other may be grouped
```

---

## 9. Configuration / Thresholds

```javascript
const CONFIG = {
  // Paste detection
  PASTE_CHAR_THRESHOLD: 50,           // Min chars to flag a paste

  // Focus tracking
  FOCUS_LOSS_MIN_DURATION: 2000,      // 2 sec minimum to log

  // Velocity detection
  VELOCITY_WINDOW_SIZE: 10,           // Chars to measure
  VELOCITY_THRESHOLD: 15,             // Chars/second to flag

  // Snapshot frequency
  SNAPSHOT_INTERVAL: 30000,           // Save code every 30 sec

  // Session settings
  DEFAULT_SESSION_DURATION: 3600000,  // 1 hour
  MAX_SESSION_DURATION: 14400000      // 4 hours
};
```

---

## 10. User Flows

### Flow 1: Recruiter Creates Session
1. Recruiter logs in / lands on homepage
2. Clicks "Create Interview Session"
3. Configures: language, duration, candidate email (optional)
4. System generates unique session link
5. Recruiter shares link with candidate
6. Recruiter opens reviewer dashboard

### Flow 2: Candidate Takes Assessment
1. Candidate clicks session link
2. Enters name (if required)
3. Sees code editor with problem statement
4. Writes code (integrity tracking runs silently)
5. Submits when done or time expires
6. Sees "Thank you" confirmation

### Flow 3: Recruiter Reviews Live
1. Recruiter dashboard shows live code mirror
2. Receives real-time alerts for suspicious events
3. Integrity score updates dynamically
4. Can flag moments for later review
5. Session ends → full report generated

### Flow 4: Post-Session Report
1. Recruiter accesses session report
2. Views: final code, integrity score, event timeline
3. Expands individual events for details
4. Exports as PDF for hiring committee
5. Decides: proceed to next round or reject

---

## 11. MVP vs Future Features

### MVP (Week 1)
- [x] Monaco Editor with basic integrity tracking
- [x] Paste detection + focus loss detection
- [x] Simple reviewer dashboard with alerts
- [x] MongoDB event logging
- [x] Basic integrity score
- [x] Session creation and joining

### Phase 2 (Week 2-3)
- [ ] Keystroke velocity analysis
- [ ] Session playback/recording
- [ ] PDF report export
- [ ] Email notifications
- [ ] Multiple reviewers per session

### Phase 3 (Future)
- [ ] AI-powered pattern analysis (ML model for cheating detection)
- [ ] Browser extension detection (detect if Copilot is active)
- [ ] Comparison with candidate's historical patterns
- [ ] Integration with ATS (Greenhouse, Lever, etc.)
- [ ] White-label / embeddable widget

---

## 12. Non-Functional Requirements

### Performance
- Editor latency: < 50ms keystroke response
- WebSocket latency: < 200ms for alerts
- Dashboard load time: < 2 seconds

### Security
- Session links are unguessable (UUID v4 or nanoid)
- No PII stored beyond email (optional)
- Events auto-delete after 90 days
- HTTPS only

### Scalability
- Support 100 concurrent sessions (MVP)
- MongoDB indexes on sessionId, timestamp

### Privacy
- Candidate notified that session is monitored
- No webcam/screen recording (differentiator from HireVue)
- Code snapshots stored, not full keystroke logs (MVP)

---

## 13. Open Questions for PRD

1. **Branding:** Is this a standalone product or embedded in TalonHunt.ai?
2. **Authentication:** Do reviewers need accounts, or is link-based access enough?
3. **Problem Statements:** Should we include a problem/prompt feature, or just the editor?
4. **Notifications:** Email alerts when candidate joins/finishes?
5. **Pricing Tier:** Is this a premium feature or included in base TalonHunt?
6. **Legal:** What disclaimer do we show candidates about monitoring?

---

## 14. Success Metrics

| Metric | Target |
|--------|--------|
| Detection accuracy (true positives) | > 85% |
| False positive rate | < 10% |
| Session completion rate | > 90% |
| Recruiter satisfaction (NPS) | > 50 |
| Time to deploy MVP | 7 days |

---

## 15. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| False positives annoy recruiters | High | Tunable thresholds, "dismiss" option |
| Candidates feel surveilled | Medium | Clear, friendly disclosure; no webcam |
| Monaco Editor bundle size | Low | Code-split, lazy load |
| MongoDB scaling | Low (MVP) | Index optimization, TTL on old data |
| Browser compatibility | Medium | Test Chrome, Firefox, Safari; polyfills |

---

## 16. Timeline (Aggressive MVP)

| Day | Deliverable |
|-----|-------------|
| Day 1 | Project setup, MongoDB schema, basic Express API |
| Day 2 | Monaco Editor component with paste/focus detection |
| Day 3 | WebSocket integration, real-time events |
| Day 4 | Reviewer dashboard with live mirror |
| Day 5 | Integrity scoring, alert UI |
| Day 6 | Session management, basic styling |
| Day 7 | Testing, bug fixes, deployment |

---

*Hand this to Gemini to flesh out into a full PRD with acceptance criteria, wireframes, and detailed user stories.*
