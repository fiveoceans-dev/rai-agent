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
    if (error) return "bg-red-900 text-red-200";
    if (sessionId) return "bg-green-900 text-green-100";
    return "bg-slate-800 text-slate-200";
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

  const badge = (label: string) => (
    <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-200 border border-slate-700">{label}</span>
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-400">Local Demo MVP</p>
            <h1 className="text-3xl font-semibold">Robot Agent Interaction</h1>
            <p className="text-sm text-slate-400 mt-1">API: <code className="text-slate-200">{API_BASE}</code></p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm ${statusPill}`}>
              {sessionId ? "Session running" : "Ready"}
            </span>
            {health && health.status && badge(`API ${health.status}`)}
            {healthError && badge("API unreachable")}
          </div>
        </header>

        {error && <div className="rounded-md border border-red-500 bg-red-900/40 px-4 py-3 text-sm text-red-200">{error}</div>}

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Connect Source</h2>
                {badge("Golden path")}
              </div>
              <div className="mt-3 space-y-3">
                <div className="flex gap-2">
                  {(["webcam", "usb", "rtsp", "upload"] as SourceType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setSourceType(type)}
                      className={`flex-1 rounded-md border px-2 py-1 text-sm ${
                        sourceType === type ? "border-emerald-400 bg-emerald-900/40" : "border-slate-800 bg-slate-900"
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
                    className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                  />
                )}
                <div className="flex flex-wrap gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pipelines.vision}
                      onChange={(e) => setPipelines({ ...pipelines, vision: e.target.checked })}
                    />
                    Vision
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pipelines.audio}
                      onChange={(e) => setPipelines({ ...pipelines, audio: e.target.checked })}
                    />
                    ASR
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pipelines.llm}
                      onChange={(e) => setPipelines({ ...pipelines, llm: e.target.checked })}
                    />
                    LLM
                  </label>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span>Profile:</span>
                  <select
                    value={profile}
                    onChange={(e) => setProfile(e.target.value as Profile)}
                    className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1"
                  >
                    <option value="fast">Fast (default)</option>
                    <option value="accurate">Accurate</option>
                    <option value="cpu">CPU-only</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleConnectSource}
                    className="flex-1 rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
                    disabled={loading}
                  >
                    {sourceId ? "Reconnect Source" : "Connect Source"}
                  </button>
                  <button
                    onClick={handleStartSession}
                    className="flex-1 rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-indigo-950 hover:bg-indigo-400 disabled:opacity-50"
                    disabled={loading || !sourceId}
                  >
                    Start Analysis
                  </button>
                </div>
                <button
                  onClick={handleStopSession}
                  className="w-full rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-200 hover:border-slate-700"
                  disabled={!sessionId}
                >
                  Stop Session
                </button>
                {sourceId && (
                  <p className="text-xs text-slate-400">
                    Source: <code className="text-slate-200">{sourceId}</code>
                  </p>
                )}
                {sessionId && (
                  <p className="text-xs text-slate-400">
                    Session: <code className="text-slate-200">{sessionId}</code> ({sessionState})
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Analyze Upload</h2>
                {badge("Clip")}
              </div>
              <div className="mt-3 space-y-3 text-sm">
                <input
                  type="file"
                  accept="video/*,image/*"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-slate-200"
                />
                <button
                  onClick={handleAnalyzeUpload}
                  className="w-full rounded-md bg-slate-800 px-3 py-2 font-semibold hover:bg-slate-700"
                >
                  Analyze Clip
                </button>
                {uploadResult && (
                  <pre className="rounded-md border border-slate-800 bg-slate-950 p-2 text-xs text-slate-200">
                    {JSON.stringify(uploadResult, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Live View</h2>
                <div className="flex gap-2">
                  {badge(sessionId ? "Running" : "Idle")}
                  {badge(`Profile: ${profile}`)}
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <div className="aspect-video rounded-lg border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center text-slate-400">
                    {sessionId ? "Live feed placeholder (connects to camera/RTSP in future)" : "No session running"}
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
                    <div className="flex items-center justify-between">
                      <span>FPS</span>
                      <span className="font-semibold text-emerald-300">
                        {typeof metricPayload?.fps === "number" ? metricPayload.fps : "--"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Latency (ms)</span>
                      <span className="font-semibold text-emerald-300">
                        {typeof metricPayload?.latencyMs === "number" ? metricPayload.latencyMs : "--"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Dropped</span>
                      <span className="font-semibold text-amber-300">
                        {typeof metricPayload?.queueDepth === "number" ? metricPayload.queueDepth : 0}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
                    <p className="text-slate-300 font-semibold">Status</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {sessionId ? "Session active. Streaming events every 2s." : "Start a session to see live metrics."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Events & Transcript</h2>
                {badge(`${events.length} events`)}
              </div>
              <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
                {events.length === 0 && (
                  <p className="text-sm text-slate-400">No events yet. Start a session to stream detections and transcripts.</p>
                )}
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-md border border-slate-800 bg-slate-950 p-3 text-sm flex justify-between"
                  >
                    <div>
                      <p className="font-semibold capitalize">{event.type}</p>
                      <p className="text-xs text-slate-400">{new Date(event.timestamp * 1000).toLocaleTimeString()}</p>
                      <pre className="mt-2 text-xs text-slate-200 whitespace-pre-wrap">
                        {JSON.stringify(event.payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Advanced Panel</h2>
                <button
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="rounded-md border border-slate-700 px-3 py-1 text-sm hover:border-slate-500"
                >
                  {showAdvanced ? "Hide" : "Show"}
                </button>
              </div>
              {showAdvanced && (
                <div className="mt-3 grid gap-3 md:grid-cols-2 text-xs">
                  <div className="rounded-md border border-slate-800 bg-slate-950 p-3 space-y-2">
                    <p className="font-semibold text-slate-200">Health</p>
                    <pre className="text-slate-200 whitespace-pre-wrap">
                      {health ? JSON.stringify(health, null, 2) : "No health data"}
                    </pre>
                    {healthError && <p className="text-red-300">Health error: {healthError}</p>}
                  </div>
                  <div className="rounded-md border border-slate-800 bg-slate-950 p-3 space-y-2">
                    <p className="font-semibold text-slate-200">Session</p>
                    <pre className="text-slate-200 whitespace-pre-wrap">
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
