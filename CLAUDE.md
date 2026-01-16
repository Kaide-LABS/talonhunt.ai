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
**Status**: AI forensic analysis layer complete and working

**Completed (this session)**:
- Implemented "Layer 2: The Detective" - Gemini-powered forensic analysis
- Created `/api/analyze` endpoint with Gemini 2.0 Flash
- Added AI analysis UI to recruiter dashboard with:
  - Animated "Run Analysis" button
  - Color-coded verdict badges (High/Medium/Low Risk)
  - Confidence indicator, summary, key evidence display
- Fixed model name issue (gemini-1.5-flash → gemini-2.0-flash for v1beta API)
- Tested successfully with session eMEFQxev1L (59 events)
- Committed and pushed (commit `f6b64e5`)

**New Files**:
- `app/api/analyze/route.ts` - Gemini analysis endpoint

**Technical Notes**:
- Model: `gemini-2.0-flash` (gemini-1.5-flash not available in current API)
- Demo mode: Set `DEMO_MODE=true` in .env.local for mock responses
- Fallback: Returns "Medium Risk" with manual review note on API errors

**Next (Day 5)**:
- Pulse graph visualization
- Session Replay feature
- Consider: Post-Return Burst Analysis (first 5 keystrokes pattern)
