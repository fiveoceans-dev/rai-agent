import { useEffect, useState } from "react";

interface HealthResponse {
  status?: string;
  [key: string]: unknown;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch(`${API_BASE}/health`);
        const data = await response.json();
        setHealth(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    };

    fetchHealth();
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold">Robot Agent Interaction– Local Dev</h1>
        <p className="text-lg">API Base URL: <code>{API_BASE}</code></p>
        <div className="bg-slate-800 p-4 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-2">API health</h2>
          {health && <pre className="text-left">{JSON.stringify(health, null, 2)}</pre>}
          {error && <p className="text-red-300">Failed to fetch: {error}</p>}
          {!health && !error && <p>Loading...</p>}
        </div>
      </div>
    </main>
  );
}
