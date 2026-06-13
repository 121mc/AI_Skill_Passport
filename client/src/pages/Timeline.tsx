import { Download, Edit3, Lightbulb, Play, PlusCircle, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MemoryEvent } from "@shared/types";
import { api } from "../api/client";

const eventIcons: Record<MemoryEvent["type"], typeof PlusCircle> = {
  created: PlusCircle,
  imported: Download,
  shared: Share2,
  suggested: Lightbulb,
  updated: Edit3,
  used: Play
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN");
}

const eventTypeLabels: Record<MemoryEvent["type"], string> = {
  created: "创建",
  imported: "导入",
  shared: "分享",
  suggested: "建议",
  updated: "更新",
  used: "使用"
};

export function Timeline() {
  const requestIdRef = useRef(0);
  const [events, setEvents] = useState<MemoryEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setEvents([]);
    setError(null);
    setIsLoading(true);

    async function loadTimeline() {
      try {
        const nextEvents = await api.timeline();
        if (requestIdRef.current !== requestId) {
          return;
        }

        setEvents(nextEvents);
      } catch (loadError) {
        if (requestIdRef.current === requestId) {
          setError(errorMessage(loadError, "无法加载记忆时间线。"));
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    }

    void loadTimeline();

    return () => {
      requestIdRef.current += 1;
    };
  }, []);

  return (
    <div className="stack">
      <section className="page-title">
        <div>
          <h1>记忆时间线</h1>
          <p>查看习惯使用、分享、导入和建议记录。</p>
        </div>
      </section>

      {isLoading ? <div className="panel">正在加载记忆时间线...</div> : null}

      {!isLoading && error ? (
        <div className="panel" role="alert">
          {error}
        </div>
      ) : null}

      {!isLoading && !error && events.length === 0 ? <div className="panel">还没有记忆事件。</div> : null}

      {!isLoading && !error && events.length > 0 ? (
        <section className="stack" aria-label="记忆事件">
          {events.map((event) => {
            const Icon = eventIcons[event.type];

            return (
              <article className="panel stack" key={event.id}>
                <div className="button-row">
                  <span className="badge">
                    <Icon size={14} aria-hidden="true" />
                    {eventTypeLabels[event.type]}
                  </span>
                  <span className="tag">{formatDate(event.createdAt)}</span>
                </div>
                <div>
                  <h2>{event.title}</h2>
                  <p>{event.detail}</p>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
