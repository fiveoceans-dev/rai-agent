# Robot Animal Interaction Agent — Development Guide

This document outlines how to extend and maintain the system so both non-technical users and developers can work productively.

## What's Implemented Today (Repo Reality Check)
- `docker-compose.yml` runs two services: `ml-api` (FastAPI) and `web` (Next.js).
- The backend is a demo scaffold: in-memory sources/sessions/events plus stub analysis endpoints (`/analyze/frame`, `/analyze/audio`) and a WebSocket echo (`/ws/stream`).
- The frontend is a minimal “research console” that can create a source, start a session, poll events, and upload a file for `/analyze/frame`.
- CV/ASR/LLM/DB/ROS2 are design targets described below (not yet implemented/wired up in Compose).
- LAN access: `./scripts/compose-up.sh` prints your LAN URLs, but cross-device use requires setting `NEXT_PUBLIC_API_BASE` to that LAN IP and allowing the UI origin in API CORS.

## Goals and Users (Local Demo MVP)
- **Operators (non-technical):** Simple local UI to connect a camera or upload a clip, view overlays, start/stop analysis, and review detections/conversations.
- **Developers/Researchers:** Local-first stack (Mac M1 Max) with Dockerized services (DB, YOLO/CV, LLM proxy), hot-reload, and modular components that can later grow to distributed/ROS2.

## High-Level Architecture (Local-first)
- **Frontend (Next.js):** Operator UI, live view overlays, uploads. Talks to FastAPI via HTTP/WebSocket (`NEXT_PUBLIC_API_BASE`).
- **API Gateway (FastAPI):** Single entry point. Routes to CV/ASR/LLM tools. Runs in Docker on Mac M1 Max.
- **Model Services (Dockerized):** YOLO/CV container, optional ASR container, lightweight LLM proxy (e.g., local GGUF runner or OpenAI-compatible bridge). Keep images arm64-friendly.
- **Ingestion Layer:** Adapters for browser webcam, USB/UVC, RTSP, and file uploads. Normalize to `Frame` + `AudioChunk`.
- **Processing Pipelines:** Decode → preprocess → model → postprocess → publish. All run locally; prefer GPU if available, otherwise CPU with throttling.
- **Storage/State:** Local DB in Docker (e.g., Postgres/SQLite-in-container) for sessions/events; local object store (volume) for uploads and artifacts.
- **Observability:** Structured logs, health endpoints, minimal metrics (fps, latency, queue depth) exposed locally.

## Data Flow (Typical Session)
1. User selects a source (webcam/USB/RTSP) or uploads a video.
2. Frames/audio are normalized and enqueued.
3. Vision pipeline runs real-time detection/tracking; audio pipeline runs VAD/ASR.
4. Outputs (objects, poses, transcripts) are emitted as events and cached per session.
5. LLM agent consumes events via tools, produces summaries or suggested actions.
6. UI renders overlays, transcripts, and agent responses; ROS2 bridge publishes events for downstream robot behaviors.

## Interfaces
- **HTTP (FastAPI)**
  - `GET /health` — liveness.
  - `POST /sources` — register/start a source (webcam hint, USB path, RTSP URL, or upload).
  - `POST /analyze/frame` — single-frame analysis (already in repo as a stub).
  - `POST /analyze/audio` — short audio analysis/transcription.
  - `GET /sessions/{id}/events` — paged session events (detections, transcripts).
- **WebSocket**
  - `/ws/stream` — bidirectional: send frames/audio chunks or control commands; receive detections/events/agent output.
- **ROS2**
  - Topics: `rai_agent/detections`, `rai_agent/audio/transcript`, `rai_agent/agent_output`.
  - Services/Actions: optional for robot commands; keep compatibility with Foxy/Humble types.

## Frontend UX Notes
- **Home/Connect:** Select source (webcam/USB/RTSP/upload). Show status and minimal setup guidance.
- **Live View:** Player with overlays (bounding boxes, pose skeletons, labels), fps/latency badges, start/stop buttons.
- **Transcripts/Chat:** Live ASR feed plus LLM responses; allow prompting the agent with quick actions.
- **Sessions:** List past runs with timestamps and key events; downloadable logs.
- Keep a “simple mode” for operators and an “advanced mode” for developers (show raw JSON/events).

## Modularity Guidelines
- **Adapters:** One adapter per source type; normalize outputs to a shared `Frame` and `AudioChunk` schema.
- **Pipelines:** Keep models behind interfaces (e.g., `VisionModel.run(frame) -> Detections`). Allow swapping YOLO/Segmenter/Tracker via config.
- **Tools:** LLM tools should be stateless functions with explicit inputs/outputs; avoid hidden globals.
- **ROS2 Bridge:** Map internal events to ROS2 messages in one place to avoid duplication.
- **Configs:** Use environment variables + a typed config module; avoid hard-coding device paths.

## Performance and Quality (Local Demo)
- Target: smooth demo on Mac M1 Max, 720p@15–20 fps on YOLO fast profile; degrade to 480p if CPU-only.
- Batch vs. stream: live sources stream; uploads processed in batch with progress events.
- Resilience: timeouts on camera connections; retries/backoff for RTSP; clear UI errors.
- Testing: fixture-based tests for adapters; smoke tests for end-to-end camera → detections → UI overlays.

## Local Development Workflow
- Bring up the stack: `docker compose up` (hot reload enabled for API and web).
- Backend changes: edit `ml-api/app`, add endpoints/routers, and expand `requirements.txt` as needed.
- Frontend changes: edit `web/src`; fetch backend via `NEXT_PUBLIC_API_BASE`.
- Add new pipelines: create a module under `ml-api/app` for the model wrapper and wire it into a router or WebSocket handler; keep CPU/GPU selection configurable.
- ROS2: develop against a local ROS2 daemon; gate ROS2 code paths so the API can run without ROS2 installed.

## Roadmap Starters (Local-first bias)
- Add authenticated sessions and role-based UI (optional in demo mode).
- Improve detectors/trackers and ASR profiles; support switching models (fast/accurate).
- Add vector store-backed memory (local container) for the LLM agent.
- Bundle canned sample sources (test RTSP URL, sample video) for offline demos.

## Expanded Workflows
### Operator Flow (non-technical)
- Select source: webcam/USB/RTSP/upload via guided UI.
- Start analysis: toggle CV/audio/LLM modules; show status and throughput.
- View results: overlays on video, detection list, transcripts, agent responses.
- Export/share: download session report (JSON + annotated frames), copy transcript.

### Developer Flow
- Configure sources via API (register RTSP URLs, USB IDs).
- Attach to WebSocket for live events; inject synthetic frames for testing.
- Swap models by changing config and hot-reloading modules.
- Extend tools: add LLM tool functions and expose via agent registry.
- Bridge to ROS2: subscribe/publish using stable schemas to integrate with robots.

## Suggested API Contracts (sketch, local)
- `POST /sources` — body: `{type: "rtsp"|"usb"|"webcam"|"upload", url?: string, deviceId?: string}`; validate URL scheme, require one locator; returns `{sourceId}`. Reject uploads > maxSizeMB and unsupported codecs with `400`.
- `POST /sessions` — `{sourceId, pipelines: {vision: bool, audio: bool, llm: bool}, profile?: "fast"|"accurate"}`; returns `{sessionId}`.
- `GET /sessions/{id}/events` — paginated `{items: Event[], nextCursor?}` with bounded page size (e.g., 200).
- `POST /analyze/frame` — accepts image file; responds `{objects, overlays, latencyMs}`; reject > maxResolution or file size.
- `POST /analyze/audio` — accepts audio clip (< maxDurationSec, < maxSizeMB); responds `{transcript, words[], latencyMs}`.
- WebSocket `/ws/stream` — messages:
  - Up: `{type: "frame"|"audio"|"command", data, sessionId}`; enforce rate limits and size caps; close with code/reason on violation.
  - Down: `{type: "detection"|"transcript"|"agent"|"metric"|"error", data}`.

**Error envelope (HTTP/WS):** `{error: {code: string, message: string, details?: object}}`; use stable codes (e.g., `INVALID_INPUT`, `UNSUPPORTED_CODEC`, `RATE_LIMITED`, `SOURCE_OFFLINE`).

## Event Schema Hints
- **Detection:** `{objects: [{id, label, score, box, maskId?, trackId?}], fps, latencyMs}`
- **Transcript:** `{text, speaker?, startMs, endMs, confidence}`
- **Agent:** `{role: "assistant", content, citations?, commands?}`
- **Metric:** `{fps, queueDepth, gpuUtil?, cpuUtil?}`

## ROS2 Message Sketches (future; not required for local demo)
- Target Foxy/Humble compatibility; use standard msg types where possible.
- Topic `rai_agent/detections` (custom msg): `std_msgs/Header header`, `Detection[] detections`; `Detection {string label, float32 prob, float32[4] bbox_xyxy, int32 track_id}`; QoS: `reliable`, `depth 10`.
- Topic `rai_agent/audio/transcript`: `std_msgs/Header header`, `string text`, `float32 start_ms`, `float32 end_ms`, `float32 confidence`; QoS: `reliable`, `depth 50`.
- Topic `rai_agent/agent_output`: `std_msgs/Header header`, `string content`, `string suggested_action`; QoS: `best_effort`, `depth 10`.
- Versioning: include `schema_version` field in payloads; break changes gated by config flag.

## UI Composition (operator-friendly)
- **Connect Panel:** source selection with validation and inline help.
- **Live Canvas:** video element with overlay layer; show fps/latency badges.
- **Events Stream:** rolling list of detections, transcripts, agent notes.
- **Controls:** start/stop, pause, choose model profile (fast vs accurate), mute audio capture.
- **Advanced Toggle:** reveal raw JSON, debug logs, and model/version info for developers.
- **Accessibility/I18N:** ensure captions for transcripts, high-contrast theme option, keyboard navigation; prepare copy for localization. Handle offline/unstable network with retry banners and cached last state.

## Modularity Checklist (when adding features)
- New source? Implement adapter interface and update source registry.
- New model? Wrap in a strategy class with `load`, `run`, `unload`; expose configurable params.
- New tool? Define inputs/outputs and register with the agent; add minimal tests.
- New ROS2 message? Add to a single mapping layer; keep API payloads unchanged.
- New UI surface? Route through API/WebSocket; avoid frontend-only business logic.

## Reliability and Safety
- Validate inputs early (file type/size, URL schema) and sanitize filenames.
- Time-budget each pipeline stage; drop or downsample frames when overloaded.
- Provide clear operator feedback when sources disconnect or models fail.
- Add kill-switch to stop all processing quickly.

## Observability (local-friendly)
- Metrics: fps (input/output), per-stage latency (decode, preprocess, model, postprocess), queue depth, dropped frames, GPU/CPU/memory utilization, source uptime. Keep overhead low; expose via simple `/metrics` or JSON.
- Logs (structured): sourceId/sessionId, stage, duration_ms, device, model_name/version, resolution, codec, errors; avoid PII.
- Tracing: span names like `ingest.decode`, `vision.model`, `audio.asr`, `llm.tool_call`; correlation ids across HTTP/WS. Keep tracing optional in demo mode.

## Performance Profiles and Device Selection (M1 Max priority)
- Presets: **fast** (720p/15–20 fps, lightweight YOLO), **accurate** (1080p/30 fps if GPU), **cpu-only** fallback (480p, reduced fps).
- Downsampling rules: clamp resolution; transcode unsupported codecs; drop frames when queue depth exceeds threshold.
- Device selection: prefer MPS/GPU on M1 Max; env/config to force CPU; surface device choice and throughput to UI.

## LLM/Tooling Guardrails
- Prompt/memory limits: cap context window; truncate transcripts with a sliding window; store long-term data in external store if needed.
- Grounding: require citations or source snippets for summaries; tag outputs with source ids and timestamps.
- Failure containment: timeouts and retries per tool; circuit breakers for flaky integrations; degrade gracefully (skip tool, return partial results with warnings).

## Proposal: Live + File Processing (local practical patterns)
- **Unified ingest contract:** Normalize all inputs (live camera/webcam/RTSP, USB, uploads) to a `Frame` + `AudioChunk` schema with timestamps and sourceId. Keep adapters thin and side-effect free.
- **Live streams (web/USB/RTSP):**
  - Use bounded queues per session; apply backpressure by dropping oldest frames when queue depth exceeds threshold (configurable).
  - Adaptive frame rate: dynamically downsample to sustain target latency; surface effective fps to UI and metrics.
  - Codec handling: rely on ffmpeg-compatible decode; explicitly reject unsupported codecs with clear errors.
  - Health checks: periodic keepalive from source adapter; auto-reconnect with backoff for RTSP/USB.
- **File uploads (video/audio):**
  - Enforce max size/duration; transcode to canonical format/resolution before processing.
  - Batch pipeline with progress events over WebSocket; allow pause/resume; store outputs (detections, transcripts) alongside the original file.
  - Support "analyze clip" mode using the same pipelines but without real-time constraints; run at accelerated speed if resources allow.
- **Pipeline orchestration:**
  - Split into stages (decode → preprocess → model → postprocess → publish) with clear message shapes between stages.
  - Use worker pools with concurrency caps per stage; expose config to pin stages to CPU/GPU.
  - Backpressure rules: if postprocess/LLM lags, drop/skip non-critical frames; never block decode indefinitely.
- **Audio handling:**
  - For live: VAD-gated streaming ASR; small chunk sizes; emit partial and final hypotheses.
  - For files: offline ASR with batch decoding; emit word-level timing for alignment with video.
  - **Resilience:**
    - Timeouts per stage; circuit breaker on repeated model failures; fallback to lighter model profile when overloaded.
    - Explicit error events with codes; keep session state consistent (started, running, degraded, stopped).
  - **Operator/developer visibility:**
    - UI shows current ingest source, effective fps, latency, dropped frames, and ASR status.
    - Developers can subscribe to debug topics (e.g., raw detections, stage timings) gated behind an advanced toggle.
