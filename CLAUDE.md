# TalonHunt.ai

Live coding interview platform with real-time integrity tracking to detect AI-assisted cheating (Cluely, Interview Coder, etc.)

## Current Status: DEMO READY ✅

All core features complete:
- ✅ Candidate coding UI with Monaco Editor
- ✅ Real-time keystroke tracking (WPM, corrections, focus)
- ✅ Webcam telemetry + Gemini vision analysis
- ✅ Adaptive AI commentary (per-candidate baseline)
- ✅ Live commentary feed (1Hz metrics + AI verdicts)
- ✅ Pulse Graph visualization
- ✅ Session Replay with controls
- ✅ Recruiter review page (`/review/[sessionId]`)
- ✅ Final AI forensic analysis

## Future Considerations

- Confidence score aggregation from multiple signals
- Historical pattern analysis across sessions
- Video proctoring integration for stronger detection

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
**Status**: DEMO READY ✅

### System Architecture
```
Candidate UI (Monaco Editor)
         ↓
IntegrityTracker (Rolling Window + WPM + Baseline)
         ↓
useKeystrokeDynamics (3 Adaptive Triggers)
         ↓
/api/live-commentary (Gemini 2.0 Flash)
         ↓
Ably (real-time) + MongoDB (persistent)
         ↓
Recruiter Review (/review/[sessionId])
├── Pulse Graph (activity timeline)
├── Session Replay (code playback)
└── Final AI Analysis (forensic verdict)
```

### Key Components
| Component | Purpose |
|-----------|---------|
| `components/PulseGraph.tsx` | Activity visualization (5-sec buckets) |
| `components/replay/ReplayControls.tsx` | Session playback controls |
| `components/LiveCommentaryFeed.tsx` | 1Hz metrics + AI verdicts |
| `components/InterrogationModal.tsx` | Suspicious moment deep-dive |
| `app/review/[sessionId]/page.tsx` | Recruiter dashboard |
| `app/api/live-commentary/route.ts` | Adaptive AI commentary |
| `app/api/visual-snapshots/route.ts` | Webcam + Gemini vision |
| `app/api/analyze/route.ts` | Final forensic analysis |

### Adaptive AI Features
- **Per-Candidate Baseline**: First 60s + 100 chars establishes "normal"
- **3 Triggers**: Consistency (30s stable), Anomaly (immediate), Heartbeat (45s fallback)
- **15-second Rate Limit**: Prevents API spam
- **Vision Analysis**: Gaze tracking, object detection, presence verification

### Data Flow
- Live Commentary → Ably (real-time) + MongoDB (permanent)
- Visual Snapshots → MongoDB with aiAnalysis field
- All data available to Final AI Analyst
