import { Save, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { PrivacyLevel, SkillCard } from "@shared/types";
import { api } from "../api/client";
import { PrivacyBadge } from "../components/PrivacyBadge";

const arrayFields = ["scenarios", "tone", "structure", "styleRules", "constraints", "examples", "tags"] as const;

type ArrayField = (typeof arrayFields)[number];
type ArrayDrafts = Record<ArrayField, string>;

const fieldLabels: Record<ArrayField, string> = {
  scenarios: "适用场景",
  tone: "语气",
  structure: "结构",
  styleRules: "风格规则",
  constraints: "约束",
  examples: "示例",
  tags: "标签"
};

function parseLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function createEmptyArrayDrafts(): ArrayDrafts {
  return {
    scenarios: "",
    tone: "",
    structure: "",
    styleRules: "",
    constraints: "",
    examples: "",
    tags: ""
  };
}

function createArrayDrafts(card: SkillCard): ArrayDrafts {
  return {
    scenarios: card.scenarios.join("\n"),
    tone: card.tone.join("\n"),
    structure: card.structure.join("\n"),
    styleRules: card.styleRules.join("\n"),
    constraints: card.constraints.join("\n"),
    examples: card.examples.join("\n"),
    tags: card.tags.join("\n")
  };
}

function parseArrayDrafts(drafts: ArrayDrafts): Pick<SkillCard, ArrayField> {
  return {
    scenarios: parseLines(drafts.scenarios),
    tone: parseLines(drafts.tone),
    structure: parseLines(drafts.structure),
    styleRules: parseLines(drafts.styleRules),
    constraints: parseLines(drafts.constraints),
    examples: parseLines(drafts.examples),
    tags: parseLines(drafts.tags)
  };
}

export function CardDetail() {
  const { cardId } = useParams();
  const activeCardIdRef = useRef<string | undefined>(cardId);
  const activeRouteTokenRef = useRef(0);
  const [card, setCard] = useState<SkillCard | null>(null);
  const [arrayDrafts, setArrayDrafts] = useState<ArrayDrafts>(createEmptyArrayDrafts);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  activeCardIdRef.current = cardId;

  useEffect(() => {
    let isMounted = true;
    const routeToken = activeRouteTokenRef.current + 1;
    activeRouteTokenRef.current = routeToken;

    async function loadCard() {
      setCard(null);
      setArrayDrafts(createEmptyArrayDrafts());
      setMessage(null);
      setShareUrl(null);
      setError(null);
      setIsSaving(false);
      setIsSharing(false);

      if (!cardId) {
        setError("缺少卡片 ID。");
        return;
      }

      try {
        const nextCard = await api.card(cardId);
        if (isMounted && activeCardIdRef.current === cardId && activeRouteTokenRef.current === routeToken) {
          setCard(nextCard);
          setArrayDrafts(createArrayDrafts(nextCard));
        }
      } catch (loadError) {
        if (isMounted && activeCardIdRef.current === cardId && activeRouteTokenRef.current === routeToken) {
          setError(loadError instanceof Error ? loadError.message : "无法加载卡片。");
        }
      }
    }

    void loadCard();

    return () => {
      isMounted = false;
    };
  }, [cardId]);

  useEffect(() => {
    return () => {
      activeCardIdRef.current = undefined;
      activeRouteTokenRef.current += 1;
    };
  }, []);

  function updateCardField<K extends keyof SkillCard>(field: K, value: SkillCard[K]) {
    setCard((currentCard) => (currentCard ? { ...currentCard, [field]: value } : currentCard));
  }

  function updateArrayDraft(field: ArrayField, value: string) {
    setArrayDrafts((currentDrafts) => ({ ...currentDrafts, [field]: value }));
  }

  async function handleSave() {
    if (!card || card.id !== cardId) {
      return;
    }

    const requestCardId = card.id;
    const requestRouteToken = activeRouteTokenRef.current;
    const payload = { ...card, ...parseArrayDrafts(arrayDrafts) };
    setIsSaving(true);
    setError(null);
    setMessage(null);
    setShareUrl(null);

    try {
      const updatedCard = await api.updateCard(requestCardId, payload);
      if (activeCardIdRef.current !== requestCardId || activeRouteTokenRef.current !== requestRouteToken) {
        return;
      }

      setCard(updatedCard);
      setArrayDrafts(createArrayDrafts(updatedCard));
      setMessage("卡片已保存。");
    } catch (saveError) {
      if (activeCardIdRef.current === requestCardId && activeRouteTokenRef.current === requestRouteToken) {
        setError(saveError instanceof Error ? saveError.message : "无法保存卡片。");
      }
    } finally {
      if (activeCardIdRef.current === requestCardId && activeRouteTokenRef.current === requestRouteToken) {
        setIsSaving(false);
      }
    }
  }

  async function handleShare() {
    if (!card || card.id !== cardId) {
      return;
    }

    const requestCardId = card.id;
    const requestRouteToken = activeRouteTokenRef.current;
    setIsSharing(true);
    setError(null);
    setMessage(null);
    setShareUrl(null);

    try {
      const share = await api.share(requestCardId);
      if (activeCardIdRef.current !== requestCardId || activeRouteTokenRef.current !== requestRouteToken) {
        return;
      }

      setShareUrl(share.url);
    } catch (shareError) {
      if (activeCardIdRef.current === requestCardId && activeRouteTokenRef.current === requestRouteToken) {
        setError(shareError instanceof Error ? shareError.message : "无法创建分享链接。");
      }
    } finally {
      if (activeCardIdRef.current === requestCardId && activeRouteTokenRef.current === requestRouteToken) {
        setIsSharing(false);
      }
    }
  }

  const loadedCard = card && card.id === cardId ? card : null;

  if (!loadedCard) {
    return (
      <div className="stack">
        <section className="page-title">
          <div>
            <h1>技能卡片详情</h1>
            <p>编辑习惯字段和默认文本任务。</p>
          </div>
        </section>

        {error ? <div className="panel">{error}</div> : <div className="panel">正在加载卡片...</div>}
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="page-title">
        <div>
          <h1>{loadedCard.name}</h1>
          <p>编辑习惯字段和默认文本任务。</p>
        </div>
        <PrivacyBadge privacy={loadedCard.privacy} />
      </section>

      {error ? <div className="panel">{error}</div> : null}
      {message ? <div className="panel">{message}</div> : null}
      {shareUrl ? (
        <div className="panel stack">
          <strong>分享链接已生成</strong>
          <a href={shareUrl}>{shareUrl}</a>
        </div>
      ) : null}

      <section className="two-column">
        <div className="panel stack">
          <label>
            名称
            <input disabled={isSaving} value={loadedCard.name} onChange={(event) => updateCardField("name", event.target.value)} />
          </label>

          <label>
            描述
            <textarea
              disabled={isSaving}
              value={loadedCard.description}
              onChange={(event) => updateCardField("description", event.target.value)}
            />
          </label>

          <label>
            预设提示词
            <textarea
              disabled={isSaving}
              value={loadedCard.presetPrompt ?? ""}
              onChange={(event) => updateCardField("presetPrompt", event.target.value)}
            />
          </label>

          <label>
            可见性
            <select
              disabled={isSaving}
              value={loadedCard.privacy}
              onChange={(event) => updateCardField("privacy", event.target.value as PrivacyLevel)}
            >
              <option value="private">私有</option>
              <option value="link">链接分享</option>
              <option value="team">团队</option>
              <option value="public">公开演示</option>
            </select>
          </label>

          <div className="button-row">
            <button className="button primary" type="button" onClick={handleSave} disabled={isSaving || isSharing}>
              <Save size={16} aria-hidden="true" />
              {isSaving ? "保存中" : "保存"}
            </button>
            <button className="button subtle" type="button" onClick={handleShare} disabled={isSharing || isSaving}>
              <Share2 size={16} aria-hidden="true" />
              {isSharing ? "分享中" : "分享"}
            </button>
          </div>
        </div>

        <div className="stack">
          {arrayFields.map((field) => (
            <label className="panel stack" key={field}>
              {fieldLabels[field]}
              <textarea disabled={isSaving} value={arrayDrafts[field]} onChange={(event) => updateArrayDraft(field, event.target.value)} />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
