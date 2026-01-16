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

**Last updated**: 2026-01-16
**Status**: Pulse Graph visualization complete and tested

**Completed (this session)**:
- Implemented Pulse Graph visualization for recruiter dashboard
- Added `telemetry_heartbeat` event type (emits every 5s with keystroke count)
- Created `components/PulseGraph.tsx` - custom SVG bar chart:
  - 5-second buckets for EKG-style resolution
  - Bar height = activity volume (keystrokes + paste chars)
  - Bar color = max severity in bucket (green/yellow/red)
  - 1px gray baseline for idle periods (thinking)
  - Hover tooltips, legend, quick stats
- Integrated into dashboard between Risk Signals Bar and AI Analysis
- Updated SCORE_IMPACT to include telemetry_heartbeat (neutral, 0 points)
- Tested in browser - working as expected
- Committed and pushed (commit `91eccf6`)

**New Files**:
- `components/PulseGraph.tsx` - Custom SVG pulse visualization

**Modified Files**:
- `types/index.ts` - Added telemetry_heartbeat event type
- `lib/IntegrityTracker.ts` - Added emitHeartbeat() method
- `hooks/useKeystrokeDynamics.ts` - Calls heartbeat before each 5s flush
- `app/review/[sessionId]/page.tsx` - Integrated PulseGraph component
- `app/api/events/route.ts` + `netlify/functions/events.ts` - Added score impact

**Technical Notes**:
- Heartbeat captures: keystrokeCount, avgLatency, variance
- Graph scales bar heights relative to max volume in session
- Empty buckets show 1px gray baseline (candidate thinking)

**Next**:
- Session Replay feature
- Consider: Post-Return Burst Analysis (first 5 keystrokes pattern)
- Consider: Video proctoring integration
