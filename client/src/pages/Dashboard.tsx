import { useEffect, useRef, useState } from "react";
import type { SkillCard } from "@shared/types";
import { api } from "../api/client";
import { SkillCardTile } from "../components/SkillCardTile";

type ShareState = {
  cardId: string | null;
  error?: string;
  requestId: number;
  status: "idle" | "sharing" | "success" | "error";
  url?: string;
};

const initialShareState: ShareState = {
  cardId: null,
  requestId: 0,
  status: "idle"
};

export function Dashboard() {
  const [cards, setCards] = useState<SkillCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shareState, setShareState] = useState<ShareState>(initialShareState);
  const shareRequestIdRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    async function loadCards() {
      setError(null);
      setIsLoading(true);
      setCards([]);

      try {
        const nextCards = await api.cards();
        if (isMounted) {
          setCards(nextCards);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load cards.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCards();

    return () => {
      isMounted = false;
      shareRequestIdRef.current += 1;
    };
  }, []);

  async function handleShare(cardId: string) {
    const requestId = shareRequestIdRef.current + 1;
    shareRequestIdRef.current = requestId;
    setShareState({ cardId, requestId, status: "sharing" });

    try {
      const share = await api.share(cardId);
      if (shareRequestIdRef.current !== requestId) {
        return;
      }

      setShareState({ cardId, requestId, status: "success", url: share.url });
    } catch (shareError) {
      if (shareRequestIdRef.current !== requestId) {
        return;
      }

      setShareState({
        cardId,
        error: shareError instanceof Error ? shareError.message : "Unable to create share link.",
        requestId,
        status: "error"
      });
    }
  }

  return (
    <div className="stack">
      <section className="page-title">
        <div>
          <h1>Skill Card Library</h1>
          <p>Reusable AI work habits owned by the user.</p>
        </div>
      </section>

      {isLoading ? <div className="panel">Loading cards...</div> : null}

      {!isLoading && error ? <div className="panel">{error}</div> : null}

      {shareState.status === "success" && shareState.url ? (
        <div className="panel stack">
          <strong>Share link ready</strong>
          <a href={shareState.url}>{shareState.url}</a>
        </div>
      ) : null}

      {!isLoading && !error && cards.length > 0 ? (
        <section className="grid" aria-label="Skill cards">
          {cards.map((card) => (
            <SkillCardTile
              card={card}
              isSharing={shareState.status === "sharing" && shareState.cardId === card.id}
              key={card.id}
              onShare={handleShare}
              shareError={shareState.status === "error" && shareState.cardId === card.id ? shareState.error : null}
            />
          ))}
        </section>
      ) : null}

      {!isLoading && !error && cards.length === 0 ? (
        <div className="panel">No skill cards yet.</div>
      ) : null}
    </div>
  );
}
