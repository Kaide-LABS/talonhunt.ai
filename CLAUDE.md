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
**Status**: Day 4 code pushed to GitHub, return signature debugging pending

**Completed (this session)**:
- Resumed session and reviewed handoff notes
- Walked through return signature debugging process (console log analysis)
- Committed and pushed Day 3-4 implementation to GitHub (commit `bbfb908`)
- Updated global CLAUDE.md with compulsory protocols and full Nia tool reference

**Day 3-4 Features (now in GitHub)**:
- Oscillation Detection (burst pattern, CV < 0.4)
- Return Signature Analysis (Miner vs Printer)
- Tunable thresholds in IntegrityTracker.ts
- 3 new event types: `read_pattern_warning`, `suspicious_return`, `research_break`
- Recruiter Dashboard UI (70/30 split, timeline, risk signals)
- Debug logging for focus tracking
- Next.js API routes: auth, events, sessions, snapshots

**Known Issue - Return Signature Not Triggering**:
- `focus_loss` events ARE captured (tab switches show in timeline)
- BUT `suspicious_return` never fires even with correct test pattern
- Debug logs exist - need to run test and check console for:
  - `[IntegrityTracker] Focus REGAINED at: X, Break duration: Y ms`
  - `[IntegrityTracker] Return Signature Analysis: {...}`
- Thresholds: MIN_BREAK=10s, PRINTER_LATENCY<800ms, MINER_LATENCY>2000ms

**Questions to Investigate**:
1. Is `window.focus` reliable? Consider `document.visibilitychange` API
2. Is 10s MIN_BREAK_DURATION realistic for ChatGPT workflow?
3. Is 800ms PRINTER_LATENCY threshold correct?

**Next**:
- Debug return signature (run app, switch tabs for 11s, type immediately, check console)
- Consider visibilitychange API if window.focus unreliable
- Day 5: Pulse graph, Session Replay
