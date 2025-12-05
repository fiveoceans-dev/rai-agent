from fastapi import FastAPI, File, UploadFile, WebSocket
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Robot Animal Interaction API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/upload/video")
async def upload_video(file: UploadFile = File(...)) -> JSONResponse:
    return JSONResponse({"message": "video received", "filename": file.filename})


@app.post("/upload/image")
async def upload_image(file: UploadFile = File(...)) -> JSONResponse:
    return JSONResponse({"message": "image received", "filename": file.filename})


@app.post("/upload/audio")
async def upload_audio(file: UploadFile = File(...)) -> JSONResponse:
    return JSONResponse({"message": "audio received", "filename": file.filename})


@app.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"echo: {data}")
    except Exception:
        await websocket.close()
