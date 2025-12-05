# Robot Animal Interaction Agent Dev Environment

## Quick start

1. Ensure Docker Desktop (or Docker + Compose) is running.
2. From the repository root, build the images:
   ```bash
   docker compose build
   ```
3. Start the stack with hot reloads:
   ```bash
   docker compose up
   ```

Services:
- Frontend (Next.js): http://localhost:3000
- FastAPI docs: http://localhost:8000/docs

The frontend uses `NEXT_PUBLIC_API_BASE` (set to `http://localhost:8000` in docker-compose) to call the backend.
