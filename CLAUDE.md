# TalonHunt.ai

Live coding interview platform with real-time integrity tracking to detect AI-assisted cheating (Cluely, Interview Coder, etc.)

## Current Priorities

1. **Day 3**: Implement detection algorithms (LinearityIndex, RhythmVariance)
2. **Day 4**: Build Recruiter Dashboard UI
3. **Day 5**: Add visualizations (Pulse graph, Session Replay)

## Known Issues / Context

- Ably cleanup in React Strict Mode causes warnings (wrapped in try-catch, functional but noisy in dev)
- Next.js 16.1.1 has a turbopack warning about multiple lockfiles (cosmetic, not blocking)

## Architecture Decisions

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | Next.js 14 (App Router) | SSR, file-based routing |
| Hosting | Netlify | Zero DevOps, instant deploys |
| Backend | Netlify Functions | Serverless, no Docker needed |
| Real-time | Ably | Managed WebSockets, no server state |
| Database | MongoDB Atlas | Flexible document storage |
| Editor | Monaco Editor | VS Code engine, rich API |

## Environment Variables

```
MONGODB_URI=mongodb+srv://...
ABLY_API_KEY=...
```

## Session Handoff Notes

**Last updated**: 2026-01-15
**Status**: Day 2 complete, ready for Day 3 (no code changes this session)
**Completed**:
- Day 1: Full stack infrastructure (Next.js, MongoDB, Ably, Netlify Functions)
- Day 2: Telemetry system for AI-cheating detection:
  - `lib/IntegrityTracker.ts` - Welford's Algorithm for real-time keystroke variance
  - `hooks/useKeystrokeDynamics.ts` - Monaco integration for event capture
  - `netlify/functions/events.ts` - API for storing/retrieving integrity events
  - CodeEditor integration with "Recording" indicator
  - Detects: velocity_spike (<30ms), rhythm_anomaly (variance<50), paste (>50 chars), focus_loss
  - Integrity score auto-reduces on critical events (-5 per event)
  - Fixed: Session IDs now alphanumeric-only (no URL truncation issues)
  - Fixed: Ably cleanup deferred to avoid React Strict Mode errors
- This session: Indexed repo with Nia, updated global CLAUDE.md to make repo indexing COMPULSORY on session end

**Blocked**: None

**Next**:
- Day 3: Implement LinearityIndex (character-by-character consistency) and RhythmVariance (typing pattern analysis)
- Consider adding: bulk_insert detection (large text without paste event)
