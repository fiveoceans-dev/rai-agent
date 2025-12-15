# UI & Workflow — Local Demo MVP

Audience: Operators and product-minded engineers. Goal: a focused local demo on Mac M1 Max using Docker, with a clear “golden path” and an “advanced” view for developers.

## Golden Path (Operator)
1. Launch stack: `docker compose up`.
2. Open `http://localhost:3000`.
3. Connect source: choose webcam or upload sample clip (provided). RTSP optional.
4. Start analysis: pick profile `fast` (default). Toggle CV/ASR/LLM if available.
5. View overlays: boxes/labels on video, live fps/latency badges.
6. See transcripts & agent replies: live ASR feed; optional prompt box.
7. End session: stop analysis. Download session report (JSON + key frames) if desired.

## Screens & States
- **Home/Connect**
  - Source selector: Webcam | USB | RTSP URL | Upload.
  - Validation inline: URL schema checks, file size/duration caps.
  - Status pill: Ready | Connecting | Error (with reason).
- **Live View**
  - Video canvas + overlay layer (boxes, labels, pose optional).
  - Badges: FPS (input/effective), Latency (p50/p95), Dropped frames.
  - Controls: Start/Stop, Pause, Profile (Fast/Accurate/CPU), Mute audio capture.
- **Events & Transcript**
  - Stream of detections and transcripts with timestamps.
  - Agent responses (LLM) inline; quick actions (e.g., “Summarize last 10s”).
- **Advanced Panel (developer toggle)**
  - Raw JSON events, debug logs, model versions, device (MPS/CPU), queue depth.
  - WebSocket status and reconnect button.
- **Uploads**
  - Dropzone with progress; shows ETA and current stage (transcode → analyze → summarize).
  - Completion card with download links for report and annotated frames.

## UX Principles (Jony/Steve lens)
- Remove clutter; single primary action per screen.
- Immediate feedback on connect/start/stop; errors in plain language.
- Defaults that “just work” locally (Fast profile, webcam selected if available).
- Respect attention: small, meaningful animations; no noisy spinners.
- Accessibility: keyboard nav, high contrast toggle, captions from ASR, responsive layout.

## Network & Offline Handling
- If backend unreachable: show banner with retry; keep last good state cached.
- If RTSP/Webcam drops: inline error, auto-retry with backoff; allow manual reconnect.
- Upload resume: allow re-selecting file; warn on size/format rejection early.

## Minimal Data Model (UI)
- `Session`: id, sourceId, profile, state (ready/running/degraded/stopped), startedAt.
+- `Source`: id, type (webcam/usb/rtsp/upload), label, status.
- `Event`: timestamp, type (detection/transcript/agent/metric/error), payload.

## Demo Content
- Ship one sample MP4 (720p) and one short audio clip.
- Provide a test RTSP URL placeholder and clear note if unavailable.

## Operator Checklist (before demo)
- Camera allowed in browser; microphone permitted if ASR enabled.
- Docker stack running; backend reachable at `http://localhost:8000`.
- Fast profile selected; advanced panel closed unless asked.
