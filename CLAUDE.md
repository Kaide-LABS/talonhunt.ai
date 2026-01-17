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
**Status**: Phase 2 complete (Webcam + Live Commentary)

**Completed (this session - Phase 2)** (commit `f96e93e`):
- Webcam Smart Snapshots (`hooks/useWebcamTelemetry.ts`)
  - 45-second interval + event-triggered captures
  - Smart budgeting: 30 max, stops heartbeats at 20, reserves 10 for events
  - Triggers: suspicious_return, bulk_insert, focus_loss, post_return_burst
- Visual Snapshots API (`app/api/visual-snapshots/route.ts`)
  - Base64 JPEG storage in MongoDB `visual_snapshots` collection
  - Netlify function mirror included
- PulseGraph Enhancement (`components/PulseGraph.tsx`)
  - Camera icon overlay on bars with snapshots
  - Hover image preview tooltip
- Live AI Commentary
  - `components/LiveCommentaryFeed.tsx` - real-time verdict display
  - `hooks/useAbly.ts` - added onAIVerdict + publishAIVerdict
  - Gemini's fix: verdict publishing in `useKeystrokeDynamics.ts`

**New Files (Phase 2)**:
- `app/api/visual-snapshots/route.ts` - Webcam snapshot storage
- `netlify/functions/visual-snapshots.ts` - Netlify mirror
- `hooks/useWebcamTelemetry.ts` - Smart webcam capture hook
- `components/LiveCommentaryFeed.tsx` - Real-time AI verdict feed

**Modified Files (Phase 2)**:
- `types/index.ts` - VisualSnapshot, AIVerdictMessage types
- `hooks/useAbly.ts` - onAIVerdict callback, publishAIVerdict function
- `hooks/useKeystrokeDynamics.ts` - AI verdict publishing (Gemini's fix)
- `components/PulseGraph.tsx` - Camera icon + hover preview
- `components/editor/CodeEditor.tsx` - Wired publishAIVerdict
- `app/candidate/[sessionId]/page.tsx` - Webcam integration + status
- `app/review/[sessionId]/page.tsx` - Visual snapshots + Live Commentary

**Gemini's Critical Fix**:
The plan had consumers (LiveCommentaryFeed) but no producers. Added publishing logic in useKeystrokeDynamics.ts that sends ai_verdict messages to Ably when warning/critical events occur.

**Next Steps**:
- Deploy to Netlify and test end-to-end
- Consider Phase 3: Video proctoring integration
