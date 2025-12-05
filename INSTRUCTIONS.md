You are an expert full-stack engineer.
I am on macOS and I want a local research/dev environment for a robot-animal-interaction agent that runs as a web app on http://localhost
 and talks to a Python ML API, all inside Docker.

Please generate all the code and config files needed for this setup, with clear file names and contents.

High-level requirements

Root project folder: rai-agent/

Use Docker Compose to run:

ml-api → Python 3.11 + FastAPI backend on port 8000

web → Next.js + React + TypeScript frontend on port 3000

I’ll access the app via http://localhost:3000

Frontend should call backend at http://localhost:8000 using an env var: NEXT_PUBLIC_API_BASE.

1. Project structure

Create this structure (and fill in all files):

rai-agent/
  docker-compose.yml
  ml-api/
    Dockerfile
    requirements.txt
    app/
      __init__.py
      main.py
  web/
    Dockerfile
    package.json
    tsconfig.json
    next.config.mjs
    postcss.config.cjs
    tailwind.config.cjs
    next-env.d.ts
    src/
      pages/
        _app.tsx
        index.tsx
      styles/
        globals.css

2. docker-compose.yml

Write docker-compose.yml so that:

Service ml-api:

builds from ./ml-api

maps port 8000:8000

mounts ./ml-api/app to /app/app for hot reload

runs: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

Service web:

builds from ./web

maps port 3000:3000

mounts ./web to /app and keeps /app/node_modules as container-only

sets env NEXT_PUBLIC_API_BASE=http://localhost:8000

depends on ml-api

runs npm run dev

3. Python backend: ml-api
3.1 requirements.txt

Create ml-api/requirements.txt with at least:

fastapi

uvicorn[standard]

pydantic

python-multipart

numpy

torch

torchvision

torchaudio

opencv-python-headless

pillow

librosa

3.2 Dockerfile for ml-api

Create ml-api/Dockerfile:

Start from python:3.11-slim

Install minimal system deps for OpenCV/audio (e.g. ffmpeg, libsm6, libxext6)

Set WORKDIR /app

Copy requirements.txt, run pip install

Copy app folder

Expose port 8000

Default CMD should run uvicorn as above (but docker-compose will override)

3.3 app/main.py (FastAPI app)

Create ml-api/app/main.py:

Import and configure FastAPI

Add CORS to allow http://localhost:3000 and http://127.0.0.1:3000

Expose:

@app.get("/health")
async def health():
    return {"status": "ok"}


Add a dummy endpoint:

@app.post("/analyze/frame")
async def analyze_frame(file: UploadFile = File(...)):
    # For now, just return filename
    return {"message": "frame received", "filename": file.filename}


Add a simple WebSocket at /ws/stream that just echoes text messages for now.

Also create an empty __init__.py in ml-api/app/.

4. Next.js frontend: web
4.1 package.json

Create web/package.json using:

"next": "15.0.0" (or latest 15.x)

"react": "18.3.1"

"react-dom": "18.3.1"

"typescript": "^5.6.0"

"tailwindcss": "^3.4.0"

"postcss": "^8.4.0"

"autoprefixer": "^10.4.0"

Scripts:

"scripts": {
  "dev": "next dev -H 0.0.0.0 -p 3000",
  "build": "next build",
  "start": "next start -H 0.0.0.0 -p 3000"
}

4.2 Dockerfile for web

Create web/Dockerfile:

Base image: node:22-alpine

WORKDIR /app

Copy package.json and run npm install

Copy the rest of the app

Expose port 3000

Default CMD: npm run dev

4.3 Next config and TS config

Create web/tsconfig.json with a typical Next + TS config (strict mode, jsx: "preserve", moduleResolution: "bundler", etc.), and include all src/**/*.ts and src/**/*.tsx.

Create web/next-env.d.ts with standard Next type references.

Create web/next.config.mjs:

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true
};

export default nextConfig;

4.4 Tailwind + PostCSS

Create web/tailwind.config.cjs so Tailwind scans ./src/**/*.{js,ts,jsx,tsx}.

Create web/postcss.config.cjs with Tailwind and Autoprefixer.

Create web/src/styles/globals.css:

Include @tailwind base;, @tailwind components;, @tailwind utilities;

Add a simple dark background for body.

4.5 _app.tsx and index.tsx

Create web/src/pages/_app.tsx to import globals.css and render Component.

Create web/src/pages/index.tsx that:

Reads NEXT_PUBLIC_API_BASE (defaulting to http://localhost:8000 if undefined).

On mount (useEffect), calls /health on the backend.

Displays the API health JSON and which base URL it used.

Example behavior:

Show page title: Robot Agent Interaction– Local Dev”

Show “API health: {…}”

Show <code>{API_BASE}</code>.

5. Usage instructions (add to a comment or README)

Also output a short README block with commands:

docker compose build

docker compose up

Then:

Open http://localhost:3000 for frontend

Open http://localhost:8000/docs for FastAPI docs

The whole output should be file-by-file, with clearly labeled sections like:

rai-agent/docker-compose.yml
--------------------------------
<code here>

rai-agent/ml-api/Dockerfile
-------------------------------
<code here>
...


so I can copy everything into my project and run it immediately on my Mac with Docker.