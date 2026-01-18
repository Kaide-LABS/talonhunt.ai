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

**Last updated**: 2026-01-18
**Status**: Phase 3 mostly complete (Event-Driven Adaptive AI Commentary)

**Pending (incomplete from interrupted session)**:
- Update MAX_SNAPSHOTS_PER_SESSION from 30 to 100 in `app/api/visual-snapshots/route.ts`
- Integrate vision analysis results into `/api/analyze` forensic prompt (so AI has access to vision findings)

**Completed (this session - Phase 3)**:

### Event-Driven Adaptive AI Commentary
Replaced hardcoded threshold-based detection with intelligent, per-candidate adaptive AI commentary that learns baseline behavior and triggers Gemini analysis only when behavior shifts.

**Architecture**:
```
IntegrityTracker (Rolling Window + WPM + Baseline)
         ↓
useKeystrokeDynamics (3 Event-Driven Triggers)
         ↓
/api/live-commentary (Gemini 2.0 Flash)
         ↓
Ably ai_verdict channel
         ↓
LiveCommentaryFeed (1Hz local metrics + AI verdicts)
```

**Key Features**:
1. **Per-Candidate Baseline**: First 60s + 100 chars establishes "normal" WPM and correction ratio
2. **3 Adaptive Triggers**:
   - Consistency (30s stable): Stats within ±20% of baseline → positive observation
   - Anomaly (immediate): WPM spikes >50% or drops to near 0 → warning
   - Heartbeat (45s fallback): No AI update for 45s → check-in
3. **15-second Rate Limit**: Prevents API spam
4. **1Hz Metrics Display**: Real-time WPM, corrections %, baseline status in LiveCommentaryFeed
5. **AI Vision Analysis**: Gemini analyzes webcam snapshots for gaze/objects/presence

**New Files (Phase 3)**:
- `app/api/live-commentary/route.ts` - Gemini endpoint for adaptive commentary

**Modified Files (Phase 3)**:
- `types/index.ts` - BaselineMetrics, LiveCommentaryRequest, adaptive event types, aiAnalysis field
- `lib/IntegrityTracker.ts` - Rolling 60s window, WPM calculation, getBaselineMetrics()
- `hooks/useKeystrokeDynamics.ts` - 3 triggers, API calls, rate limiting, onMetricsUpdate
- `components/LiveCommentaryFeed.tsx` - MetricsBar UI (baseline status, WPM, corrections)
- `components/editor/CodeEditor.tsx` - onMetricsUpdate prop
- `app/api/events/route.ts` - adaptive_consistency (+2), adaptive_anomaly (-3), adaptive_heartbeat (0)
- `app/api/visual-snapshots/route.ts` - Gemini Vision analysis, visual_anomaly verdicts
- `netlify/functions/events.ts` - Added adaptive event score impacts

**Verification Steps**:
1. Start candidate session, type normally for 60s → baseline established
2. Check LiveCommentaryFeed shows WPM and corrections updating at 1Hz
3. Type steadily for 30s → should see "consistency" positive verdict
4. Suddenly paste large code → should see "anomaly" verdict immediately
5. Stop typing for 45s → should see "heartbeat" check-in
6. Verify rate limiting: rapid events shouldn't spam API
7. Look away from camera → should see "Visual: Eyes diverted" verdict
8. Hold up phone → should see "Visual: Phone detected" verdict

**Next Steps**:
- Deploy to Netlify and test end-to-end
- Consider: Confidence score aggregation from multiple signals
- Consider: Historical pattern analysis across sessions
