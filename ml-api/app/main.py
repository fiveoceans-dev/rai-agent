import time
import uuid
from threading import Lock
from typing import Literal

from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Robot Animal Interaction API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SourceCreate(BaseModel):
    type: Literal["rtsp", "usb", "webcam", "upload"]
    url: str | None = None
    device_id: str | None = Field(default=None, alias="deviceId")
    label: str | None = None


class SourceResponse(BaseModel):
    sourceId: str
    label: str


class SessionCreate(BaseModel):
    sourceId: str = Field(alias="sourceId")
    pipelines: dict[str, bool] = Field(default_factory=dict)
    profile: Literal["fast", "accurate", "cpu"] | None = None


class SessionResponse(BaseModel):
    sessionId: str
    state: str


class Event(BaseModel):
    timestamp: float
    type: Literal["detection", "transcript", "agent", "metric", "error"]
    payload: dict
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))


class EventsPage(BaseModel):
    items: list[Event]
    nextCursor: int | None = None


sources_store: dict[str, SourceCreate] = {}
sessions_store: dict[str, dict] = {}
events_store: dict[str, list[Event]] = {}
store_lock = Lock()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "services": {"api": "ready"}}


def _seed_events(session_id: str) -> None:
    now = time.time()
    events = [
        Event(
            timestamp=now,
            type="detection",
            payload={
                "objects": [
                    {"id": "obj-1", "label": "demo-dog", "score": 0.92, "box": [0.2, 0.2, 0.6, 0.7]}
                ],
                "fps": 18,
                "latencyMs": 42,
            },
        ),
        Event(
            timestamp=now + 0.1,
            type="transcript",
            payload={"text": "Demo transcript ready.", "startMs": 0, "endMs": 1200, "confidence": 0.94},
        ),
        Event(
            timestamp=now + 0.2,
            type="metric",
            payload={"fps": 18, "latencyMs": 42, "queueDepth": 0},
        ),
    ]
    events_store[session_id] = events


@app.post("/sources", response_model=SourceResponse)
async def create_source(body: SourceCreate) -> SourceResponse:
    source_id = str(uuid.uuid4())
    label = body.label or f"{body.type}-{source_id[:6]}"
    with store_lock:
        sources_store[source_id] = body
    return SourceResponse(sourceId=source_id, label=label)


@app.post("/sessions", response_model=SessionResponse)
async def create_session(body: SessionCreate) -> SessionResponse:
    session_id = str(uuid.uuid4())
    with store_lock:
        sessions_store[session_id] = {
            "sourceId": body.sourceId,
            "pipelines": body.pipelines,
            "profile": body.profile or "fast",
            "state": "running",
        }
        _seed_events(session_id)
    return SessionResponse(sessionId=session_id, state="running")


@app.get("/sessions/{session_id}/events", response_model=EventsPage)
async def list_events(session_id: str, cursor: int = 0, limit: int = 50) -> EventsPage:
    with store_lock:
        events = events_store.get(session_id, [])
        slice_ = events[cursor : cursor + limit]
        next_cursor = cursor + len(slice_) if cursor + len(slice_) < len(events) else None
    return EventsPage(items=slice_, nextCursor=next_cursor)


@app.post("/upload/video")
async def upload_video(file: UploadFile = File(...)) -> JSONResponse:
    return JSONResponse({"message": "video received", "filename": file.filename})


@app.post("/upload/image")
async def upload_image(file: UploadFile = File(...)) -> JSONResponse:
    return JSONResponse({"message": "image received", "filename": file.filename})


@app.post("/upload/audio")
async def upload_audio(file: UploadFile = File(...)) -> JSONResponse:
    return JSONResponse({"message": "audio received", "filename": file.filename})


@app.post("/analyze/frame")
async def analyze_frame(file: UploadFile = File(...)) -> JSONResponse:
    return JSONResponse(
        {
            "message": "frame received",
            "filename": file.filename,
            "objects": [{"label": "demo-dog", "score": 0.9}],
            "latencyMs": 25,
        }
    )


@app.post("/analyze/audio")
async def analyze_audio(file: UploadFile = File(...)) -> JSONResponse:
    return JSONResponse(
        {
            "message": "audio received",
            "filename": file.filename,
            "transcript": "Demo transcript from audio.",
            "latencyMs": 120,
        }
    )


@app.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"echo: {data}")
    except WebSocketDisconnect:
        await websocket.close()
