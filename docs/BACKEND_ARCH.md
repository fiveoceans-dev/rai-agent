# Backend Architecture — Local Demo MVP

Audience: Backend/infra/ML engineers. Goal: run everything locally on a Mac M1 Max via Docker (arm64-friendly), with clear module boundaries and demo-ready defaults.

## Golden Path (Dev)
1. `docker compose up` (builds `ml-api` + `web` from `docker-compose.yml`).
2. API available at `http://localhost:8000`; WS at `/ws/stream`.
3. Frontend hits API using `NEXT_PUBLIC_API_BASE`.
4. Use a webcam or an MP4 to validate the CV path; optional audio clip for ASR.

## Services (containers)
Current (in `docker-compose.yml`):
- **FastAPI Gateway (`ml-api`)**: orchestrates requests, WebSocket, session state, and routing to tool functions.
- **Web UI (`web`)**: operator/dev console (Next.js), talks to the API via `NEXT_PUBLIC_API_BASE`.

Planned / optional (described in this doc, not yet wired into `docker-compose.yml`):
- **CV/YOLO Service**: bundled model weights; exposes a Python module (preferred) inside API container or as sidecar.
- **ASR Service**: local Whisper/Coqui-style container; optional for demo if resources allow.
- **LLM Proxy**: local GGUF/OpenAI-compatible bridge; can be stubbed for demo.
- **DB**: Postgres (or SQLite-in-container) for sessions/events; volume-backed.
- **Object storage**: local volume for uploads and artifacts.

## Pipelines (local-first)
- **Vision:** decode (ffmpeg/libav) → preprocess (resize, normalize) → YOLO forward → postprocess (NMS, labels) → overlays/events.
- **Audio:** VAD → ASR (streaming for live; batch for uploads) → transcripts + word timings.
- **LLM tools:** summarize last N seconds, answer based on detections/transcripts; grounded responses with citations.
- **Session events:** emitted as structured messages, stored in DB, streamed over WS.

## API Contracts (summary)
- `POST /sources`: register source (rtsp/usb/webcam/upload); validate URL/size/duration; returns `sourceId`.
- `POST /sessions`: start session `{sourceId, pipelines, profile}` → `sessionId`.
- `GET /sessions/{id}/events`: paginated events.
- `POST /analyze/frame`: single image → detections/overlays.
- `POST /analyze/audio`: short clip → transcript/timings.
- WS `/ws/stream`: bi-di frames/audio/commands; emits detections/transcripts/agent/metric/error.
- Error envelope: `{error: {code, message, details?}}` with stable codes.

## Performance Profiles (Mac M1 Max)
- **fast**: 720p, 15–20 fps target, lightweight YOLO; MPS if available; drop frames on backlog.
- **accurate**: 1080p/30 fps if GPU allows; otherwise fallback to fast.
- **cpu-only**: 480p, reduced fps, minimal models.
- Downsample/transcode unsupported inputs; enforce caps on resolution/bitrate/duration.

## Observability (lean)
- Metrics: fps, per-stage latency, queue depth, dropped frames, GPU/CPU/mem utilization.
- Logs: structured; include sourceId/sessionId, stage, model/version, resolution, errors.
- Tracing (optional): spans for decode/preprocess/model/postprocess/asr/llm.tool_call; correlation ids across HTTP/WS.

## Reliability (demo-focused)
- Health checks: `/health` for API; lightweight self-test for CV/ASR on startup.
- Watchdog: auto-restart stalled sources; reconnect RTSP with backoff.
- Backpressure: bounded queues; drop oldest frames when congested; emit metric/event.
- Safe defaults: refuse oversized uploads, unsupported codecs; clear errors.

## Data & Storage
- DB schema (minimal): `sessions`, `sources`, `events` (jsonb payload), `artifacts` (paths).
- Artifacts stored on a mounted volume; include annotated frames and reports.

## Model & Device Handling
- Ship arm64-ready wheels/images; prefer MPS on M1 Max; allow `FORCE_CPU=1`.
- Model registry config: name, version, device, profile; hot-reload without restart where possible.

## Extensibility (future)
- Swap CV models via config; add tracker/pose modules.
- Swap ASR backends; add diarization.
- Plug in real LLM with tools; add vector store sidecar.
- Add ROS2 bridge container when moving beyond local demo.
