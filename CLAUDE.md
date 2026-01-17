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
**Status**: Challenge selector implemented and tested

**Completed (this session)**:
- Added challenge selector to candidate UI (commit `12c2adb`)
- Created `data/challenges.ts` with 3 Python challenges:
  - FizzBuzz (easy) - for honest typing demos
  - Two Sum (medium) - classic interview problem
  - Dijkstra's Algorithm (hard) - cheating trap for AI-assisted detection
- Added `challenge_selected` event type (neutral, 0 score impact)
- Added dropdown UI to candidate page header:
  - LeetCode-style dark theme
  - Difficulty color coding (green/yellow/red)
  - Challenges filtered by session language
- Editor resets to starter code via React key prop remount

**New Files**:
- `data/challenges.ts` - Challenge definitions with starter code

**Modified Files**:
- `types/index.ts` - Added challenge_selected event type
- `app/api/events/route.ts` + `netlify/functions/events.ts` - Added score impact
- `app/candidate/[sessionId]/page.tsx` - Challenge dropdown UI

**Technical Notes**:
- Currently only Python challenges (filter by session language)
- challenge_selected events logged with challengeId, title, difficulty
- No score impact - informational metadata only

**Next**:
- Session Replay feature
- Add JavaScript/TypeScript challenges
- Post-Return Burst Analysis (first 5 keystrokes pattern)
- Video proctoring integration
