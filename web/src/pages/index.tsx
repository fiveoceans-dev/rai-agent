import { useEffect, useMemo, useState } from "react";

type SourceType = "webcam" | "usb" | "rtsp" | "upload";
type Profile = "fast" | "accurate" | "cpu";

interface HealthResponse {
  status?: string;
  services?: Record<string, string>;
}

interface SourceResponse {
  sourceId: string;
  label: string;
}

interface SessionResponse {
  sessionId: string;
  state: string;
}

interface EventItem {
  id: string;
  timestamp: number;
  type: string;
  payload: Record<string, unknown>;
}

interface EventsPage {
  items: EventItem[];
  nextCursor?: number | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<SourceType>("webcam");
  const [sourceValue, setSourceValue] = useState("");
  const [profile, setProfile] = useState<Profile>("fast");
  const [pipelines, setPipelines] = useState({ vision: true, audio: false, llm: false });
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<string>("ready");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsCursor, setEventsCursor] = useState<number | null>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<Record<string, unknown> | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const metricEvent = useMemo(() => events.find((e) => e.type === "metric"), [events]);
  const metricPayload = metricEvent?.payload as Record<string, unknown> | undefined;

  const statusPill = useMemo(() => {
    if (error) return "bg-amber-100 text-amber-900 border border-amber-200";
    if (sessionId) return "bg-emerald-100 text-emerald-900 border border-emerald-200";
    return "bg-slate-100 text-slate-700 border border-slate-200";
  }, [error, sessionId]);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch(`${API_BASE}/health`);
        const data: HealthResponse = await response.json();
        setHealth(data);
        setHealthError(null);
      } catch (err) {
        setHealthError(err instanceof Error ? err.message : "Unknown error");
      }
    };

    fetchHealth();
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(async () => {
      try {
        const cursor = eventsCursor ?? 0;
        const res = await fetch(`${API_BASE}/sessions/${sessionId}/events?cursor=${cursor}&limit=50`);
        const data: EventsPage = await res.json();
        if (data.items?.length) {
          setEvents((prev) => [...prev, ...data.items]);
          if (data.nextCursor !== undefined && data.nextCursor !== null) {
            setEventsCursor(data.nextCursor);
          } else {
            setEventsCursor(null);
          }
        }
      } catch (err) {
        // Keep polling; show error in advanced panel
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [sessionId, eventsCursor]);

  const handleConnectSource = async () => {
    setError(null);
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { type: sourceType };
      if (sourceType === "rtsp" && sourceValue) payload.url = sourceValue;
      if (sourceType === "usb" && sourceValue) payload.deviceId = sourceValue;
      const res = await fetch(`${API_BASE}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Failed to create source: ${res.status}`);
      const data: SourceResponse = await res.json();
      setSourceId(data.sourceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create source");
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async () => {
    if (!sourceId) {
      setError("Create or select a source first.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, pipelines, profile }),
      });
      if (!res.ok) throw new Error(`Failed to start session: ${res.status}`);
      const data: SessionResponse = await res.json();
      setSessionId(data.sessionId);
      setSessionState(data.state);
      setEvents([]);
      setEventsCursor(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session");
    } finally {
      setLoading(false);
    }
  };

  const handleStopSession = () => {
    setSessionId(null);
    setSessionState("stopped");
    setEventsCursor(null);
  };

  const handleAnalyzeUpload = async () => {
    if (!uploadFile) {
      setError("Select a file to analyze.");
      return;
    }
    setError(null);
    setUploadResult(null);
    const formData = new FormData();
    formData.append("file", uploadFile);
    try {
      const res = await fetch(`${API_BASE}/analyze/frame`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`Analyze failed: ${res.status}`);
      const data = await res.json();
      setUploadResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze upload");
    }
  };

  const badge = (label: string, tone: "neutral" | "ok" | "warn" | "muted" = "neutral") => {
    const styles = {
      neutral: "border-slate-300 bg-white text-slate-700",
      ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
      warn: "border-amber-200 bg-amber-50 text-amber-900",
      muted: "border-slate-200 bg-slate-100 text-slate-600",
    }[tone];
    return (
      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${styles}`}>
        {label}
      </span>
    );
  };

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <header className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Research console</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold text-slate-900">Robot Agent Lab</h1>
              <p className="text-sm text-slate-600">Minimal controls for exercising perception pipelines.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusPill}`}>
                {sessionId ? "Session running" : "Ready"}
              </span>
              {health?.status && badge(`API ${health.status}`, "ok")}
              {healthError && badge("API unreachable", "warn")}
              {error && badge("Attention needed", "warn")}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <span className="uppercase tracking-wide text-[10px] text-slate-500">API</span>
              <code className="text-[12px] text-slate-800">{API_BASE}</code>
            </span>
            {sessionId && (
              <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <span className="uppercase tracking-wide text-[10px] text-slate-500">Session</span>
                <code className="text-[12px] text-slate-800">{sessionId}</code>
              </span>
            )}
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
            {error}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Source</p>
                  <h2 className="text-lg font-semibold text-slate-900">Acquisition</h2>
                  <p className="text-xs text-slate-500">Pick a source, enable pipelines, run.</p>
                </div>
                {badge("Golden path", "muted")}
              </div>
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {(["webcam", "usb", "rtsp", "upload"] as SourceType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setSourceType(type)}
                      className={`rounded-md border px-3 py-2 text-left font-medium transition ${
                        sourceType === type
                          ? "border-slate-900 bg-slate-900 text-slate-50"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      {type.toUpperCase()}
                    </button>
                  ))}
                </div>
                {(sourceType === "rtsp" || sourceType === "usb") && (
                  <input
                    value={sourceValue}
                    onChange={(e) => setSourceValue(e.target.value)}
                    placeholder={sourceType === "rtsp" ? "rtsp://camera/stream" : "USB device id"}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-inner focus:border-slate-500 focus:outline-none"
                  />
                )}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <label className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <span>Vision</span>
                    <input
                      type="checkbox"
                      checked={pipelines.vision}
                      onChange={(e) => setPipelines({ ...pipelines, vision: e.target.checked })}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <span>ASR</span>
                    <input
                      type="checkbox"
                      checked={pipelines.audio}
                      onChange={(e) => setPipelines({ ...pipelines, audio: e.target.checked })}
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <span>LLM</span>
                    <input
                      type="checkbox"
                      checked={pipelines.llm}
                      onChange={(e) => setPipelines({ ...pipelines, llm: e.target.checked })}
                    />
                  </label>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-600">Profile</span>
                  <select
                    value={profile}
                    onChange={(e) => setProfile(e.target.value as Profile)}
                    className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  >
                    <option value="fast">Fast (default)</option>
                    <option value="accurate">Accurate</option>
                    <option value="cpu">CPU-only</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleConnectSource}
                    className="flex-1 rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-50 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:opacity-50 disabled:hover:translate-y-0"
                    disabled={loading}
                  >
                    {sourceId ? "Reconnect source" : "Connect source"}
                  </button>
                  <button
                    onClick={handleStartSession}
                    className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:border-slate-400 disabled:opacity-50 disabled:hover:translate-y-0"
                    disabled={loading || !sourceId}
                  >
                    Start analysis
                  </button>
                </div>
                <button
                  onClick={handleStopSession}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 disabled:opacity-50 disabled:hover:translate-y-0"
                  disabled={!sessionId}
                >
                  Stop session
                </button>
                {sourceId && (
                  <p className="text-xs text-slate-600">
                    Source <code className="text-slate-800">{sourceId}</code>
                  </p>
                )}
                {sessionId && (
                  <p className="text-xs text-slate-600">
                    Session <code className="text-slate-800">{sessionId}</code> ({sessionState})
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Offline</p>
                  <h2 className="text-lg font-semibold text-slate-900">Analyze upload</h2>
                  <p className="text-xs text-slate-500">Send a still or clip for a quick check.</p>
                </div>
                {badge("Clip", "muted")}
              </div>
              <div className="mt-3 space-y-3 text-sm">
                <input
                  type="file"
                  accept="video/*,image/*"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-slate-700"
                />
                <button
                  onClick={handleAnalyzeUpload}
                  className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:border-slate-400"
                >
                  Analyze clip
                </button>
                {uploadResult && (
                  <pre className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
                    {JSON.stringify(uploadResult, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Live view</p>
                  <h2 className="text-lg font-semibold text-slate-900">Feed + metrics</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {badge(sessionId ? "Running" : "Idle", sessionId ? "ok" : "muted")}
                  {badge(`Profile: ${profile}`, "neutral")}
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-[1.5fr,1fr]">
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-500 flex aspect-video items-center justify-center">
                  {sessionId ? "Live feed placeholder (wired to camera/RTSP in the service)" : "Waiting for a running session"}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <span>FPS</span>
                      <span className="font-semibold text-emerald-700">
                        {typeof metricPayload?.fps === "number" ? metricPayload.fps : "--"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Latency (ms)</span>
                      <span className="font-semibold text-emerald-700">
                        {typeof metricPayload?.latencyMs === "number" ? metricPayload.latencyMs : "--"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Dropped</span>
                      <span className="font-semibold text-amber-700">
                        {typeof metricPayload?.queueDepth === "number" ? metricPayload.queueDepth : 0}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    {sessionId ? "Streaming events every ~2s from the running session." : "Start a session to stream metrics and events."}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Notebook</p>
                  <h2 className="text-lg font-semibold text-slate-900">Events & transcript</h2>
                </div>
                {badge(`${events.length} events`, "neutral")}
              </div>
              <div className="mt-3 max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-slate-50">
                {events.length === 0 && (
                  <p className="px-4 py-3 text-sm text-slate-600">
                    No events yet. Start a session to stream detections and transcripts.
                  </p>
                )}
                {events.map((event) => (
                  <div key={event.id} className="border-b border-slate-200 px-4 py-3 text-sm last:border-b-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-semibold uppercase tracking-wide text-xs text-slate-700">{event.type}</p>
                      <p className="text-[11px] text-slate-500">{new Date(event.timestamp * 1000).toLocaleTimeString()}</p>
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-slate-800">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Debug</p>
                  <h2 className="text-lg font-semibold text-slate-900">Advanced panel</h2>
                </div>
                <button
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1 text-sm text-slate-800 transition hover:-translate-y-0.5 hover:border-slate-400"
                >
                  {showAdvanced ? "Hide" : "Show"}
                </button>
              </div>
              {showAdvanced && (
                <div className="mt-3 grid gap-3 md:grid-cols-2 text-xs">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <p className="font-semibold text-slate-800">Health</p>
                    <pre className="text-slate-800 whitespace-pre-wrap">
                      {health ? JSON.stringify(health, null, 2) : "No health data"}
                    </pre>
                    {healthError && <p className="text-amber-700">Health error: {healthError}</p>}
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <p className="font-semibold text-slate-800">Session</p>
                    <pre className="text-slate-800 whitespace-pre-wrap">
                      {JSON.stringify(
                        {
                          sourceId,
                          sessionId,
                          sessionState,
                          profile,
                          pipelines,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
