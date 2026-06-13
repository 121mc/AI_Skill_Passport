import { GitFork, Import } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { ShareLink, SkillCard } from "@shared/types";
import { api } from "../api/client";
import { PrivacyBadge } from "../components/PrivacyBadge";

const snapshotFields = [
  { key: "scenarios", label: "适用场景" },
  { key: "tone", label: "语气" },
  { key: "structure", label: "结构" },
  { key: "styleRules", label: "风格规则" },
  { key: "constraints", label: "约束" },
  { key: "examples", label: "示例" }
] as const;

type SnapshotField = (typeof snapshotFields)[number]["key"];
type OperationState = {
  error: string | null;
  message: string | null;
  status: "idle" | "importing" | "forking";
};

const idleOperation: OperationState = {
  error: null,
  message: null,
  status: "idle"
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString("zh-CN") : "未设置";
}

function ListField({ card, field, label }: { card: SkillCard; field: SnapshotField; label: string }) {
  const values = card[field];

  return (
    <section className="panel stack">
      <h2>{label}</h2>
      {values.length > 0 ? (
        <ul>
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      ) : (
        <p>没有记录{label}。</p>
      )}
    </section>
  );
}

export function SharePreview() {
  const { shareId } = useParams();
  const activeShareIdRef = useRef<string | undefined>(shareId);
  const loadRequestIdRef = useRef(0);
  const operationRequestIdRef = useRef(0);
  const [share, setShare] = useState<ShareLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [operation, setOperation] = useState<OperationState>(idleOperation);
  activeShareIdRef.current = shareId;

  useEffect(() => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    operationRequestIdRef.current += 1;
    setShare(null);
    setError(null);
    setOperation(idleOperation);
    setIsLoading(true);

    async function loadShare() {
      if (!shareId) {
        setError("缺少分享 ID。");
        setIsLoading(false);
        return;
      }

      try {
        const nextShare = await api.sharePreview(shareId);
        if (activeShareIdRef.current !== shareId || loadRequestIdRef.current !== requestId) {
          return;
        }

        setShare(nextShare);
      } catch (loadError) {
        if (activeShareIdRef.current === shareId && loadRequestIdRef.current === requestId) {
          setError(errorMessage(loadError, "无法加载分享预览。"));
        }
      } finally {
        if (activeShareIdRef.current === shareId && loadRequestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    }

    void loadShare();
  }, [shareId]);

  useEffect(() => {
    return () => {
      activeShareIdRef.current = undefined;
      loadRequestIdRef.current += 1;
      operationRequestIdRef.current += 1;
    };
  }, []);

  async function handleImport() {
    if (!shareId) {
      return;
    }

    const requestId = operationRequestIdRef.current + 1;
    operationRequestIdRef.current = requestId;
    setOperation({ error: null, message: null, status: "importing" });

    try {
      const card = await api.importShare(shareId);
      if (activeShareIdRef.current !== shareId || operationRequestIdRef.current !== requestId) {
        return;
      }

      setOperation({ error: null, message: `已导入为 ${card.name}。`, status: "idle" });
    } catch (importError) {
      if (activeShareIdRef.current === shareId && operationRequestIdRef.current === requestId) {
        setOperation({ error: errorMessage(importError, "无法导入分享。"), message: null, status: "idle" });
      }
    }
  }

  async function handleFork() {
    if (!shareId || !share) {
      return;
    }

    const requestId = operationRequestIdRef.current + 1;
    const forkName = `${share.snapshot.name} 副本`;
    operationRequestIdRef.current = requestId;
    setOperation({ error: null, message: null, status: "forking" });

    try {
      const card = await api.forkShare(shareId, { name: forkName, privacy: "private" });
      if (activeShareIdRef.current !== shareId || operationRequestIdRef.current !== requestId) {
        return;
      }

      setOperation({ error: null, message: `已复刻为 ${card.name}。`, status: "idle" });
    } catch (forkError) {
      if (activeShareIdRef.current === shareId && operationRequestIdRef.current === requestId) {
        setOperation({ error: errorMessage(forkError, "无法复刻分享。"), message: null, status: "idle" });
      }
    }
  }

  const snapshot = share?.snapshot ?? null;
  const isOperationInFlight = operation.status !== "idle";

  return (
    <div className="stack">
      <section className="page-title">
        <div>
          <h1>{snapshot ? snapshot.name : "分享预览"}</h1>
          <p>预览、导入或复刻一张分享出来的技能卡片快照。</p>
        </div>
        {snapshot ? <PrivacyBadge privacy={snapshot.privacy} /> : null}
      </section>

      {isLoading ? <div className="panel">正在加载分享预览...</div> : null}
      {!isLoading && error ? (
        <div className="panel" role="alert">
          {error}
        </div>
      ) : null}

      {!isLoading && snapshot && share ? (
        <section className="two-column">
          <div className="stack">
            <section className="panel stack">
              <div className="button-row">
                <span className="badge link">只读快照</span>
                <span className="badge">{share.importCount} 次导入</span>
              </div>

              <p>{snapshot.description}</p>
              {snapshot.presetPrompt ? <p>{snapshot.presetPrompt}</p> : null}
              <p>导入会创建本地副本；复刻会从此快照创建一个私有可编辑版本。</p>

              {snapshot.tags.length > 0 ? (
                <div className="tag-row" aria-label="快照标签">
                  {snapshot.tags.map((tag) => (
                    <span className="tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="button-row">
                <button className="button primary" type="button" onClick={handleImport} disabled={isOperationInFlight}>
                  <Import size={16} aria-hidden="true" />
                  {operation.status === "importing" ? "导入中" : "导入"}
                </button>
                <button className="button subtle" type="button" onClick={handleFork} disabled={isOperationInFlight}>
                  <GitFork size={16} aria-hidden="true" />
                  {operation.status === "forking" ? "复刻中" : "复刻并编辑"}
                </button>
              </div>

              {operation.message ? <p>{operation.message}</p> : null}
              {operation.error ? <p role="alert">{operation.error}</p> : null}
            </section>

            <section className="panel stack">
              <h2>快照字段</h2>
              <div className="tag-row">
                <span className="tag">{snapshot.usageCount} 次使用</span>
                <span className="tag">创建于 {formatDate(snapshot.createdAt)}</span>
                <span className="tag">更新于 {formatDate(snapshot.updatedAt)}</span>
                <span className="tag">上次使用 {formatDate(snapshot.lastUsedAt)}</span>
                <span className="tag">分享于 {formatDate(share.createdAt)}</span>
                <span className="tag">过期于 {formatDate(share.expiresAt)}</span>
              </div>
            </section>

            <section className="panel stack">
              <h2>适配度</h2>
              <div className="tag-row">
                <span className="tag">{snapshot.compatibility.chat}% 对话</span>
                <span className="tag">{snapshot.compatibility.ppt}% PPT</span>
                <span className="tag">{snapshot.compatibility.writing}% 写作</span>
                <span className="tag">{snapshot.compatibility.coding}% 编程</span>
              </div>
            </section>
          </div>

          <div className="stack">
            {snapshotFields.map((field) => (
              <ListField card={snapshot} field={field.key} key={field.key} label={field.label} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
