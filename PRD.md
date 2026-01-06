Product Requirements Document (PRD): TalonHunt Integrity Sandbox v2.0Internal Code: TH-GHOSTBUSTERTarget Threat: Stealth Overlays (Cluely, Interview Coder) & LLM InjectionTimeline: 7 Days (Sprint 0)1. Executive SummaryThe TalonHunt Integrity Sandbox is a forensic coding environment designed to detect "invisible" cheating tools. Unlike traditional proctoring which relies on visual data (webcams/screen recording) that tools like Cluely easily bypass, this system relies on Behavioral Biometrics.By analyzing how code is written—specifically keystroke latency, linearity, and focus leaks—we can distinguish between a human composing a solution and a human transcribing an AI-generated answer.Core Value: "Cluely hides the answer on their screen. We detect the pattern of them reading it."2. The Threat Model: Why Standard Proctoring FailsThe Threat: Tools like Cluely create a transparent overlay window that sits above the browser.The Blind Spot: Screen-sharing software (Zoom, etc.) captures the browser layer, not the OS overlay layer. The recruiter sees a normal screen, but the candidate sees the answer floating in front of them.The Solution: We ignore the screen entirely. We analyze the Data Bridge—the physical act of moving the answer from the overlay into the code editor.3. User Stories3.1. The Recruiter (Admin)Story: "As a recruiter, I want to be alerted if a candidate is transcribing code rather than thinking, so I can catch users reading from hidden overlays."Story: "As a recruiter, I want to know if the candidate clicks outside the browser window, even for a millisecond, which suggests they are interacting with a cheat tool."3.2. The Candidate (User)Story: "As a candidate, I want a high-performance editor (Monaco) that doesn't lag while I type."Story: "As a candidate, I want to know if I am flagged for a 'false positive' (e.g., checking documentation) so I can explain myself."4. Functional Requirements: The Detection EnginesThis system implements three specific heuristics to defeat Cluely-style tools.4.1. Anti-Transcription Engine (The "Zombie" Check)Candidates reading from an AI overlay type differently than those thinking through a problem.Linearity Index: Tracks the cursor position over time.Human Behavior: Non-linear. Writes function header -> jumps inside -> writes logic -> jumps back to fix typo -> scrolls up to import library.Transcriber Behavior: 98% Linear. Types line 1 -> types line 2 -> types line 3. They rarely jump back because they aren't "compiling" the code in their head.The "Reading Rhythm":Logic: Calculate the standard deviation of inter-keystroke intervals (Flight Time).Trigger: If typing rhythm matches average English reading speed (approx 200-250 wpm equivalent) with low variance, flag as "Live Transcription."4.2. Focus Leak Detector (The "Overlay Click")To scroll down on a long Cluely answer, the candidate must click the overlay.Micro-Blur Listener: Most cheat tools claim to be "click-through," but many require interaction to copy/scroll.Logic: Listen for window.onblur events that last < 1000ms.Trigger: A pattern of "Type -> Micro-Blur (Scroll) -> Type -> Micro-Blur" indicates interaction with a foreground application that isn't the browser.4.3. Injection Defense (The "God Mode" Check)Some tools try to inject the code programmatically to save typing time.Velocity Variance:Logic: No human has a variance of 0ms between keys.Trigger: If 50+ characters are entered with a Flight Time Variance < 5ms, flag as "Script Injection." This defeats "Auto-Type" bots.5. Technical Architecture5.1. StackFrontend: Next.js + Monaco Editor (React)Telemetry Processing: Client-side lightweight JS workers (to prevent main thread lag).Backend: Supabase (PostgreSQL + Realtime).Visualization: Recharts (for the "Velocity vs Time" graph).5.2. Data Schema (Telemetry Log)We do not just save the code; we save the construction of the code.TypeScripttype KeystrokeEvent = {
  timestamp: number;      // ms since session start
  key: string;           // 'a', 'b', 'Enter', 'Backspace'
  latency: number;       // ms since last key press
  cursorPos: number;     // Linear index in document
  isPaste: boolean;
};

type SessionRiskReport = {
  sessionId: string;
  transcriptionScore: number; // 0-100 (High = likely reading)
  linearityScore: number;     // 0-100 (100 = perfect start-to-finish typing)
  focusLostCount: number;
  injectionEvents: number;
};
5.3. The "Linearity" Algorithm (Simplified)JavaScript// Heuristic to detect linear transcription
function calculateLinearity(events) {
  let linearMoves = 0;
  let nonLinearMoves = 0;

  for (let i = 1; i < events.length; i++) {
    const expectedPos = events[i-1].cursorPos + 1;
    if (Math.abs(events[i].cursorPos - expectedPos) < 5) {
      linearMoves++;
    } else {
      nonLinearMoves++; // Jumped cursor to refactor/edit
    }
  }
  
  // A real coder usually has 20-30% non-linear moves (deletes, jumps).
  // A transcriber is often >95% linear.
  return (linearMoves / events.length) * 100;
}
6. UX/UI Implementation6.1. Recruiter Dashboard ("The Truth Lens")Live Status: "Candidate is Typing..." vs "Candidate is Transcribing (High Confidence)."The "Pulse" Graph: A live line chart showing Typing Velocity (y-axis) over Time (x-axis).Normal: Spiky (Think... Burst... Delete... Think).Cheating: Flat line (Consistent reading/typing pace).Playback Mode: A slider to replay the code construction. If the replay looks like a typewriter (one character after another, never going back), it visually proves cheating to the hiring manager.6.2. Candidate ViewClean & Simple: Standard Monaco editor.Latency Warning: If network latency is high, show a warning (so we don't blame lag for "thinking pauses").No "Cheating" Accusations: Never show the candidate they are flagged. This prevents them from adjusting their behavior.7. Development Roadmap (7-Day Sprint)DayFocusDeliverableMonCore SetupNext.js repo, Monaco implementation, Supabase connection.TueTelemetryBuild useKeystrokeDynamics hook. Capture latency & cursor deltas.WedDetection LogicImplement LinearityIndex and RhythmVariance algorithms.ThuDashboard UIBuild the Recruiter view with Realtime Supabase subscription.FriVisualsAdd the "Pulse" graph and Session Replay slider.SatStress TestSelf-test using Cluely/ChatGPT to calibrate thresholds.SunPolishFinal deployment, PDF report generation.8. Strategic Pitch Notes (How to sell this PRD)The "Cluely Killer" Argument: "We don't try to see what's on their screen. We look at their brain activity through their fingers. If they are reading, we know. If they are thinking, we know."The False Positive Defense: "We don't auto-reject. We give you a 'Probabilistic Score' so you can ask: 'Hey, I noticed you typed that solution out perfectly linearly without any testing. Can you explain your logic?' If they can't, you have your answer."

Here's a more in-depth explanation of how it tackles tools like cluely AI and other tools like that: 
Yes, this pitch is actually **uniquely positioned** to defeat tools like Cluely AI, and highlighting this will make your offer significantly more valuable.

Tools like Cluely, Interview Coder, and various "Copilot" extensions rely on a specific gap in current proctoring tech: **Visual Invisibility**. They create a transparent overlay that screen-sharing software (like Zoom or HackerRank's screen record) cannot see.

However, your proposed **TalonHunt Integrity Sandbox** relies on **Behavioral Telemetry**, which bypasses Cluely's "stealth" entirely.

Here is the technical explanation of how your solution tackles Cluely, which you should add to the "Technical Architecture" section of your pitch to demonstrate deep expertise.

### How TalonHunt Defeats Cluely (The Pitch Logic)

You can explain to the founder that Cluely works by showing the candidate the answer, but the candidate still has to get that answer into the code editor. This creates a "Data Bridge" that your system monitors.

#### 1. Detection Vector: The "Transcription Zombie" Pattern

Candidates using Cluely are **transcribing**, not **composing**.

* **The Behavior:** A candidate reading a solution from a Cluely overlay types linearly (start to finish) with a consistent rhythm. They rarely go back to refactor, they don't jump between lines, and their "flight time" (latency between keystrokes) matches reading speed, not thinking speed.
* **Your Solution:** The **Integrity Sandbox** calculates a "Linearity Score."
* *Real Coder:* High non-linearity (jumps, deletes, cursor moves).
* *Cluely User:* High linearity (types line 1, then line 2, then line 3).
* *Pitch:* "Cluely hides the answer, but it can't hide the fact that the user is typing like a transcriber, not an engineer. Our algorithm flags 'Linear Input' anomalies."



#### 2. Detection Vector: Focus Leaks (The "Overlay Click")

* **The Behavior:** While Cluely's overlay is visually invisible, it is still a separate OS window. If the candidate clicks on the Cluely overlay to scroll down or copy text, the browser window *instantly* loses focus.
* **Your Solution:** The **Focus Loss Detector**.
* *Implementation:* Even a micro-focus loss (e.g., 200ms) triggers a `blur` event in the browser.
* *Pitch:* "Cluely users have to interact with their cheat tool. The moment they click that overlay to scroll, our `window.onblur` listener catches them. We log every 'micro-switch' that traditional screen shares miss."



#### 3. Detection Vector: Injection vs. Human Typing

* **The Behavior:** Some advanced versions of these tools try to "inject" the code or "auto-type" it to avoid manual transcription.
* **Your Solution:** The **Velocity Cap**.
* *Implementation:* No human types at a perfectly constant 50ms latency between keys. Machines do.
* *Pitch:* "If the keystroke latency variance is too low (i.e., robotic perfection), we flag it as a script injection, effectively blocking auto-typers."



### Updated Feature: "Anti-Transcription Metrics"

You should update the **Integrity Signals** section of your PRD to explicitly mention this, as it sounds much more sophisticated.

**Add this to Section 3.2 (Integrity Signals) of the PRD:**

| Signal | What It Detects | How It Works |
| --- | --- | --- |
| **Linearity Index** | Transcribing vs. Solving | Tracks cursor position over time. If cursor progress is 95% linear (no jumping back to edit), flag as "Transcription" (Cluely usage). |
| **Latency Variance** | Auto-Typers / Bots | Calculates standard deviation of time-between-keys. If variance < 5ms (robotic consistency), flag as "Injection." |
| **Micro-Focus Events** | Overlay Interaction | Logs `blur` events < 1 second. High frequency implies interacting with a hidden overlay. |

### The Strategic "Kill Shot" in the Pitch

When you present this to TalonHunt, use this narrative:

> "Everyone is trying to block Cluely by recording the screen, but Cluely is invisible to screen recorders. That's a losing battle.
> **TalonHunt doesn't look at the screen; we look at the keystrokes.** By measuring *how* the code is written (linearity and latency), we can detect if a human is thinking or just transcribing an AI answer. This makes TalonHunt the only platform that is 'architecturally immune' to overlay cheats."

This frames your 1-week build not just as a feature, but as a **fundamental competitive advantage**.