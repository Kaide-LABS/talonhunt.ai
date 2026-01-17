# TalonHunt.ai

Live coding interview platform with real-time integrity tracking to detect AI-assisted cheating (Cluely, Interview Coder, etc.)

## Current Priorities

1. **Day 4**: Build Recruiter Dashboard UI (visualizations, event timeline)
2. **Day 5**: Add Pulse graph, Session Replay
3. Consider: Video proctoring integration for stronger detection

## Known Issues / Context

- Ably cleanup in React Strict Mode causes warnings (wrapped in try-catch, functional but noisy in dev)
- Next.js 16.1.1 has a turbopack warning about multiple lockfiles (cosmetic, not blocking)
- **Critical Insight**: Focus_loss cannot distinguish Cluely overlay from phone/second monitor/paper notes - detection is probabilistic, not definitive

## Architecture Decisions

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | Next.js 14 (App Router) | SSR, file-based routing |
| Hosting | Netlify | Zero DevOps, instant deploys |
| Backend | Netlify Functions + Next.js API Routes | Serverless, no Docker needed |
| Real-time | Ably | Managed WebSockets, no server state |
| Database | MongoDB Atlas | Flexible document storage |
| Editor | Monaco Editor | VS Code engine, rich API |

## Environment Variables

```
MONGODB_URI=mongodb+srv://...
ABLY_API_KEY=...
GEMINI_API_KEY=...
```

## Session Handoff Notes

**Last updated**: 2026-01-17
**Status**: Phase 1 complete, Phase 2 (Webcam + Live Commentary) pending

**Completed (this session - Phase 1)**:
- Post-Return Burst Analysis (commit `38bdd20`)
  - Detects "memory dump" pattern: fast + consistent typing after tab return
  - Tracks first 5 keystrokes, flags mean < 80ms + stdDev < 25ms
  - `post_return_burst_suspicious` event (-8 score)
- Undo Ratio Tracking
  - Counts backspace/delete vs total keystrokes
  - Flags <5% ratio as suspicious (honest coders ~10-30%)
  - `low_undo_ratio` event (-5 score)
- Confidence Score (0-100%)
  - Visual progress bar in review dashboard
  - Replaces vague High/Medium/Low with precise percentage
- AI-Annotated Replay
  - Activity classification: thinking, coding, debugging, suspicious_paste, idle
  - Annotation markers on replay timeline (emoji icons)
  - Auto-interrogation modal for suspicious events

**New Files**:
- `app/api/replay-snapshots/route.ts` - Snapshot storage with activity classification
- `app/api/interrogate/route.ts` - Auto-interrogation endpoint
- `components/replay/ReplayControls.tsx` - Replay timeline UI
- `components/InterrogationModal.tsx` - Candidate explanation capture
- `netlify/functions/replay-snapshots.ts` - Netlify function mirror

**Modified Files**:
- `lib/IntegrityTracker.ts` - Post-return burst + undo ratio detection
- `types/index.ts` - New event types, ActivityAnnotation type
- `app/api/events/route.ts` + `netlify/functions/events.ts` - Score impacts
- `app/api/analyze/route.ts` - confidenceScore in Gemini prompt
- `app/review/[sessionId]/page.tsx` - Confidence bar, replay integration
- `hooks/useKeystrokeDynamics.ts` - Event severity + triggers

**Technical Decisions**:
- Dropped screen recording (permission friction, code replay already exists)
- Using "Smart Snapshots" approach for Phase 2 (per Gemini recommendation)

**Next (Phase 2 - User Approved)**:
- Webcam Telemetry: `hooks/useWebcamTelemetry.ts`
  - 30-second interval + event-triggered captures
  - `/api/visual-snapshots` endpoint (Base64 MongoDB storage)
  - Cap at 30 snapshots per session
- PulseGraph camera icon hover preview
- Live Commentary Feed: `components/LiveCommentaryFeed.tsx`
  - Ably-powered real-time AI verdicts
