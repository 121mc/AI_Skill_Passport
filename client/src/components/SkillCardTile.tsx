import { Edit3, Play, Share2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import type { SkillCard } from "@shared/types";
import { PrivacyBadge } from "./PrivacyBadge";

export function SkillCardTile({
  card,
  isSharing = false,
  onShare,
  shareError
}: {
  card: SkillCard;
  isSharing?: boolean;
  onShare?: (cardId: string) => void;
  shareError?: string | null;
}) {
  const navigate = useNavigate();

  return (
    <article className="card stack">
      <div className="button-row">
        <PrivacyBadge privacy={card.privacy} />
        <span className="badge">{card.compatibility.ppt}% PPT</span>
      </div>

      <div>
        <h2>{card.name}</h2>
        <p>{card.description}</p>
        {card.presetPrompt ? <p className="prompt-preview">{card.presetPrompt}</p> : null}
      </div>

      {card.tags.length > 0 ? (
        <div className="tag-row" aria-label="卡片标签">
          {card.tags.slice(0, 5).map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {shareError ? <p role="alert">{shareError}</p> : null}

      <div className="button-row">
        <button className="button primary" type="button" onClick={() => navigate(`/task?card=${encodeURIComponent(card.id)}`)}>
          <Play size={16} aria-hidden="true" />
          使用
        </button>
        <Link className="button" to={`/cards/${card.id}`}>
          <Edit3 size={16} aria-hidden="true" />
          编辑
        </Link>
        <button className="button subtle" type="button" onClick={() => onShare?.(card.id)} disabled={isSharing}>
          <Share2 size={16} aria-hidden="true" />
          {isSharing ? "分享中" : "分享"}
        </button>
      </div>
    </article>
  );
}
