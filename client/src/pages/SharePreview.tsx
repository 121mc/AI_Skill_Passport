import { GitFork, Import } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { ShareLink, SkillCard } from "@shared/types";
import { api } from "../api/client";
import { PrivacyBadge } from "../components/PrivacyBadge";

const snapshotFields = [
  { key: "scenarios", label: "Scenarios" },
  { key: "tone", label: "Tone" },
  { key: "structure", label: "Structure" },
  { key: "styleRules", label: "Style rules" },
  { key: "constraints", label: "Constraints" },
  { key: "examples", label: "Examples" }
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
  return value ? new Date(value).toLocaleString() : "Not set";
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
        <p>No {label.toLowerCase()} captured.</p>
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
        setError("Missing share id.");
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
          setError(errorMessage(loadError, "Unable to load share preview."));
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

      setOperation({ error: null, message: `Imported as ${card.name}.`, status: "idle" });
    } catch (importError) {
      if (activeShareIdRef.current === shareId && operationRequestIdRef.current === requestId) {
        setOperation({ error: errorMessage(importError, "Unable to import share."), message: null, status: "idle" });
      }
    }
  }

  async function handleFork() {
    if (!shareId || !share) {
      return;
    }

    const requestId = operationRequestIdRef.current + 1;
    const forkName = `${share.snapshot.name} Fork`;
    operationRequestIdRef.current = requestId;
    setOperation({ error: null, message: null, status: "forking" });

    try {
      const card = await api.forkShare(shareId, { name: forkName, privacy: "private" });
      if (activeShareIdRef.current !== shareId || operationRequestIdRef.current !== requestId) {
        return;
      }

      setOperation({ error: null, message: `Forked as ${card.name}.`, status: "idle" });
    } catch (forkError) {
      if (activeShareIdRef.current === shareId && operationRequestIdRef.current === requestId) {
        setOperation({ error: errorMessage(forkError, "Unable to fork share."), message: null, status: "idle" });
      }
    }
  }

  const snapshot = share?.snapshot ?? null;
  const isOperationInFlight = operation.status !== "idle";

  return (
    <div className="stack">
      <section className="page-title">
        <div>
          <h1>{snapshot ? snapshot.name : "Share Preview"}</h1>
          <p>Preview, import, or fork a shared Skill Card snapshot.</p>
        </div>
        {snapshot ? <PrivacyBadge privacy={snapshot.privacy} /> : null}
      </section>

      {isLoading ? <div className="panel">Loading share preview...</div> : null}
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
                <span className="badge link">Preview-only snapshot</span>
                <span className="badge">{share.importCount} imports</span>
              </div>

              <p>{snapshot.description}</p>
              <p>Importing creates a local user-owned copy. Forking starts from this snapshot and saves a private editable copy.</p>

              {snapshot.tags.length > 0 ? (
                <div className="tag-row" aria-label="Snapshot tags">
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
                  {operation.status === "importing" ? "Importing" : "Import"}
                </button>
                <button className="button subtle" type="button" onClick={handleFork} disabled={isOperationInFlight}>
                  <GitFork size={16} aria-hidden="true" />
                  {operation.status === "forking" ? "Forking" : "Fork and Edit"}
                </button>
              </div>

              {operation.message ? <p>{operation.message}</p> : null}
              {operation.error ? <p role="alert">{operation.error}</p> : null}
            </section>

            <section className="panel stack">
              <h2>Snapshot fields</h2>
              <div className="tag-row">
                <span className="tag">{snapshot.usageCount} uses</span>
                <span className="tag">Created {formatDate(snapshot.createdAt)}</span>
                <span className="tag">Updated {formatDate(snapshot.updatedAt)}</span>
                <span className="tag">Last used {formatDate(snapshot.lastUsedAt)}</span>
                <span className="tag">Shared {formatDate(share.createdAt)}</span>
                <span className="tag">Expires {formatDate(share.expiresAt)}</span>
              </div>
            </section>

            <section className="panel stack">
              <h2>Compatibility</h2>
              <div className="tag-row">
                <span className="tag">{snapshot.compatibility.chat}% chat</span>
                <span className="tag">{snapshot.compatibility.ppt}% PPT</span>
                <span className="tag">{snapshot.compatibility.writing}% writing</span>
                <span className="tag">{snapshot.compatibility.coding}% coding</span>
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
