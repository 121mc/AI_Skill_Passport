import { RefreshCw, Server, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, type HealthResponse } from "../api/client";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function Settings() {
  const requestIdRef = useRef(0);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadHealth() {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setError(null);
    setIsLoading(true);

    try {
      const nextHealth = await api.health();
      if (requestIdRef.current !== requestId) {
        return;
      }

      setHealth(nextHealth);
    } catch (loadError) {
      if (requestIdRef.current === requestId) {
        setError(errorMessage(loadError, "Unable to load API health."));
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadHealth();

    return () => {
      requestIdRef.current += 1;
    };
  }, []);

  return (
    <div className="stack">
      <section className="page-title">
        <div>
          <h1>Settings</h1>
          <p>Model provider status and local demo configuration.</p>
        </div>
        <button className="button subtle" type="button" onClick={() => void loadHealth()}>
          <RefreshCw size={16} aria-hidden="true" />
          {isLoading ? "Refreshing" : "Refresh"}
        </button>
      </section>

      {isLoading && !health ? <div className="panel">Loading API health...</div> : null}

      {error ? (
        <div className="panel" role="alert">
          {error}
        </div>
      ) : null}

      {health ? (
        <section className="panel stack">
          <div className="button-row">
            <span className={`badge ${health.ok ? "public" : "private"}`}>API {health.ok ? "online" : "offline"}</span>
            <span className="badge">{health.provider}</span>
            <span className={`badge ${health.modelConfigured ? "public" : "team"}`}>
              Model {health.modelConfigured ? "configured" : "missing"}
            </span>
            <span className={`badge ${health.fallbackEnabled ? "link" : "private"}`}>
              Fallback {health.fallbackEnabled ? "enabled" : "disabled"}
            </span>
          </div>

          <div className="grid">
            <article className="card stack">
              <Server size={18} aria-hidden="true" />
              <div>
                <h2>API status</h2>
                <p>{health.ok ? "Server API is reachable." : "Server API reported an offline status."}</p>
              </div>
            </article>
            <article className="card stack">
              <ShieldCheck size={18} aria-hidden="true" />
              <div>
                <h2>Secrets</h2>
                <p>Browser never receives LLM_API_KEY. API keys stay backend-only.</p>
              </div>
            </article>
          </div>
        </section>
      ) : null}
    </div>
  );
}
