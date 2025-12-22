# Robot Animal Interaction Agent Dev Environment

## Quick start

1. Ensure Docker Desktop (or Docker + Compose) is running.
2. From the repository root, build the images:
   ```bash
   docker compose build
   ```
3. Start the stack with hot reloads (prints your LAN URL for other devices):
   ```bash
   ./scripts/compose-up.sh
   # or run: docker compose up
   ```

When using the helper script, you'll see LAN URLs such as `http://192.168.x.x:3000` and `http://192.168.x.x:8000`. Cross-device use may require setting `NEXT_PUBLIC_API_BASE` to your LAN IP and allowing the UI origin in API CORS.

Services:
- Frontend (Next.js): http://localhost:3000
- FastAPI docs: http://localhost:8000/docs

The frontend uses `NEXT_PUBLIC_API_BASE` (set to `http://localhost:8000` in docker-compose) to call the backend.

## Docs
- `docs/DEV_GUIDE.md` — dev guide + roadmap.
- `docs/BACKEND_ARCH.md` — backend contracts + planned services.
- `docs/UI_WORKFLOW.md` — operator/dev UI workflow.
- `INSTRUCTIONS.md` — original scaffold prompt (historical context).
