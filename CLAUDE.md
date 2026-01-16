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
**Status**: Threshold tuning complete, detection working correctly

**Completed (this session)**:
- Debugged return signature detection with Gemini's help
- Tuned all detection thresholds based on real-world testing
- Added `visibilitychange` API for reliable tab switch detection
- Verified system correctly identifies Miner vs Printer behavior
- User test: Score went 80 → 85 → 90 (research_break bonus working)
- Committed and pushed (commit `13ecd88`)

**Current Thresholds (lib/IntegrityTracker.ts)**:
```typescript
OSCILLATION_CONFIG = {
  MIN_BURSTS: 8,
  BURST_GAP_MS: 1000,
  MAX_BURST_CV: 0.4,
  MAX_PAUSE_CV: 0.3,        // Tightened from 0.4
  MIN_BURST_LENGTH: 3,      // Lowered from 5
  MAX_BURST_LENGTH: 30,
  MIN_MEAN_PAUSE_MS: 500,   // Lowered from 1000
};

RETURN_SIGNATURE_CONFIG = {
  MIN_BREAK_DURATION_MS: 5000,  // Lowered from 10000
  PRINTER_LATENCY_MS: 1000,     // Raised from 800
  MINER_LATENCY_MS: 2000,
};

bulk_insert threshold: >20 chars (raised from >10)
```

**Detection Status**:
- ✅ `focus_loss` - Working (neutral, no penalty)
- ✅ `research_break` - Working (+5 bonus for Miner pattern)
- ✅ `bulk_insert` - Working (>20 chars threshold)
- ⏳ `suspicious_return` - Not yet triggered in testing (user behaves like Miner, not Printer)
- ⏳ `read_pattern_warning` - Not yet triggered (needs 8+ consistent bursts)

**Next (Day 5)**:
- Pulse graph visualization
- Session Replay feature
- Consider: Post-Return Burst Analysis (first 5 keystrokes pattern)
