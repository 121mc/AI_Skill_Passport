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
        setError(errorMessage(loadError, "无法加载 API 状态。"));
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
          <h1>设置</h1>
          <p>查看模型服务状态和本地演示配置。</p>
        </div>
        <button className="button subtle" type="button" onClick={() => void loadHealth()}>
          <RefreshCw size={16} aria-hidden="true" />
          {isLoading ? "刷新中" : "刷新"}
        </button>
      </section>

      {isLoading && !health ? <div className="panel">正在加载 API 状态...</div> : null}

      {error ? (
        <div className="panel" role="alert">
          {error}
        </div>
      ) : null}

      {health ? (
        <section className="panel stack">
          <div className="button-row">
            <span className={`badge ${health.ok ? "public" : "private"}`}>API {health.ok ? "在线" : "离线"}</span>
            <span className="badge">{health.provider}</span>
            <span className={`badge ${health.modelConfigured ? "public" : "team"}`}>
              模型{health.modelConfigured ? "已配置" : "缺失"}
            </span>
            <span className={`badge ${health.fallbackEnabled ? "link" : "private"}`}>
              降级输出{health.fallbackEnabled ? "已启用" : "已关闭"}
            </span>
          </div>

          <div className="grid">
            <article className="card stack">
              <Server size={18} aria-hidden="true" />
              <div>
                <h2>API 状态</h2>
                <p>{health.ok ? "服务端 API 可访问。" : "服务端 API 当前离线。"}</p>
              </div>
            </article>
            <article className="card stack">
              <ShieldCheck size={18} aria-hidden="true" />
              <div>
                <h2>密钥</h2>
                <p>浏览器不会收到 LLM_API_KEY，API 密钥只保存在后端。</p>
              </div>
            </article>
          </div>
        </section>
      ) : null}
    </div>
  );
}
