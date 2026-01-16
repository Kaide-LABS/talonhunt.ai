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
```

## Session Handoff Notes

**Last updated**: 2026-01-16
**Status**: Day 4 code complete, but Return Signature detection needs debugging
**Completed**:
- Day 1: Full stack infrastructure
- Day 2: Basic telemetry (Welford's Algorithm)
- Day 3: LinearityIndex, RhythmVariance, bulk_insert, real-time sync
- Day 4 (this session):
  - **Oscillation Detection**: Catches phone/overlay cheating via burst pattern analysis (CV < 0.4)
  - **Return Signature Analysis**: Miner vs Printer logic to distinguish doc readers from ChatGPT copiers
  - **Tunable Thresholds**: Config constants at top of IntegrityTracker.ts for easy calibration
  - **3 New Event Types**: `read_pattern_warning` (-8), `suspicious_return` (-10), `research_break` (+5 BONUS)
  - **Recruiter Dashboard UI**: Split layout (70% code, 30% timeline), risk signals bar, event cards
  - **Fixed React hooks bug**: useKeystrokeDynamics was recreating tracker on every render, losing buffered events
  - **Added debug logging**: Console logs for focus tracking and return signature analysis

**Known Issue - Return Signature Not Triggering**:
- `focus_loss` events ARE being captured (tab switches show in timeline)
- BUT `suspicious_return` never fires even with correct test pattern
- Debug logs added - need to check console output for actual breakDuration and returnLatency values
- Possible causes: window.focus event not firing on tab return, timing thresholds too strict

**Questions for Gemini (to discuss next session)**:
1. Is `window.focus` reliable for tab switches, or should we use `document.visibilitychange`?
2. Is 10s MIN_BREAK_DURATION too long? What's realistic for ChatGPT workflow?
3. Is 800ms PRINTER_LATENCY too short? Human reaction time is 200-300ms
4. Should we analyze typing PATTERN after return instead of raw latency?

**Blocked**: Return signature detection needs debugging

**Next**:
- Debug return signature using console logs (check breakDuration and returnLatency values)
- Consider switching to `visibilitychange` API instead of window blur/focus
- Day 5: Pulse graph, Session Replay
