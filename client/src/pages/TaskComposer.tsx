import { Eye, Save, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { GenerateResponse, Recommendation, SelectedCard, SkillField, SuggestedCard } from "@shared/types";
import { api } from "../api/client";
import { FieldPicker, allowedSkillFields } from "../components/FieldPicker";

const demoTask = "请为 HCI 课程项目“AI Skill Passport”写一份 8 页中文展示大纲，只输出文本。";
const defaultPartialFields: SkillField[] = ["styleRules"];
const modeLabels: Record<SelectedCard["mode"], string> = {
  all: "全部应用",
  partial: "部分字段",
  temporary: "仅本次"
};
const fieldLabels: Record<SkillField, string> = {
  tone: "语气",
  structure: "结构",
  styleRules: "风格规则",
  constraints: "约束",
  examples: "示例"
};

type RequestStatus = "idle" | "loading" | "success" | "error";

type OperationState = {
  error: string | null;
  status: RequestStatus;
};

const idleOperation: OperationState = {
  error: null,
  status: "idle"
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isAllowedSkillField(field: SkillField) {
  return allowedSkillFields.includes(field);
}

function sanitizeSelectedCards(selectedCards: SelectedCard[]): SelectedCard[] {
  return selectedCards.map((selectedCard) => {
    const selectedFields = selectedCard.selectedFields.filter(isAllowedSkillField);

    if (selectedCard.mode === "partial") {
      return {
        ...selectedCard,
        selectedFields: selectedFields.length > 0 ? selectedFields : defaultPartialFields
      };
    }

    return {
      ...selectedCard,
      selectedFields: []
    };
  });
}

function formatSuggestedCard(card: SuggestedCard) {
  return [
    card.description,
    card.presetPrompt ? `预设提示词: ${card.presetPrompt}` : "",
    card.scenarios.length > 0 ? `适用场景: ${card.scenarios.join(", ")}` : "",
    card.styleRules.length > 0 ? `风格规则: ${card.styleRules.join(", ")}` : "",
    card.tags.length > 0 ? `标签: ${card.tags.join(", ")}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function upsertSelection(selectedCards: SelectedCard[], nextCard: SelectedCard) {
  const existingCard = selectedCards.some((selectedCard) => selectedCard.cardId === nextCard.cardId);

  if (!existingCard) {
    return [...selectedCards, nextCard];
  }

  return selectedCards.map((selectedCard) => (selectedCard.cardId === nextCard.cardId ? nextCard : selectedCard));
}

function removeSelection(selectedCards: SelectedCard[], cardId: string) {
  return selectedCards.filter((selectedCard) => selectedCard.cardId !== cardId);
}

export function TaskComposer() {
  const [searchParams] = useSearchParams();
  const queryCardId = searchParams.get("card");
  const [task, setTask] = useState(demoTask);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedCards, setSelectedCards] = useState<SelectedCard[]>([]);
  const [recommendState, setRecommendState] = useState<OperationState>({ error: null, status: "loading" });
  const [previewState, setPreviewState] = useState<OperationState>(idleOperation);
  const [generateState, setGenerateState] = useState<OperationState>(idleOperation);
  const [saveState, setSaveState] = useState<OperationState>(idleOperation);
  const [previewContext, setPreviewContext] = useState<string | null>(null);
  const [generateResult, setGenerateResult] = useState<GenerateResponse | null>(null);
  const recommendRequestIdRef = useRef(0);
  const previewRequestIdRef = useRef(0);
  const generateRequestIdRef = useRef(0);
  const appliedQueryCardIdRef = useRef<string | null>(null);
  const presetPromptRequestIdRef = useRef(0);
  const appliedPresetCardIdRef = useRef<string | null>(null);
  const requestSelectedCards = useMemo(() => sanitizeSelectedCards(selectedCards), [selectedCards]);
  const selectedCardsKey = useMemo(() => JSON.stringify(requestSelectedCards), [requestSelectedCards]);

  useEffect(() => {
    if (!queryCardId || appliedPresetCardIdRef.current === queryCardId) {
      return;
    }

    const requestId = presetPromptRequestIdRef.current + 1;
    presetPromptRequestIdRef.current = requestId;

    async function loadPresetPrompt() {
      if (!queryCardId) {
        return;
      }

      try {
        const card = await api.card(queryCardId);
        if (presetPromptRequestIdRef.current !== requestId || appliedPresetCardIdRef.current === queryCardId) {
          return;
        }
        if (card.presetPrompt) {
          setTask(card.presetPrompt);
        }
        appliedPresetCardIdRef.current = queryCardId;
      } catch {
        if (presetPromptRequestIdRef.current === requestId) {
          appliedPresetCardIdRef.current = queryCardId;
        }
      }
    }

    void loadPresetPrompt();
  }, [queryCardId]);

  useEffect(() => {
    const requestId = recommendRequestIdRef.current + 1;
    recommendRequestIdRef.current = requestId;
    setRecommendations([]);
    setRecommendState({ error: null, status: "loading" });

    async function loadRecommendations() {
      try {
        const nextRecommendations = await api.recommend(task);
        if (recommendRequestIdRef.current !== requestId) {
          return;
        }

        setRecommendations(nextRecommendations);
        setRecommendState({ error: null, status: "success" });

        if (queryCardId && appliedQueryCardIdRef.current !== queryCardId) {
          setSelectedCards([{ cardId: queryCardId, mode: "all", selectedFields: [] }]);
          appliedQueryCardIdRef.current = queryCardId;
        }
      } catch (recommendError) {
        if (recommendRequestIdRef.current !== requestId) {
          return;
        }

        setRecommendations([]);
        setRecommendState({ error: getErrorMessage(recommendError, "无法加载推荐。"), status: "error" });
      }
    }

    void loadRecommendations();
  }, [queryCardId, task]);

  useEffect(() => {
    previewRequestIdRef.current += 1;
    generateRequestIdRef.current += 1;
    setPreviewContext(null);
    setGenerateResult(null);
    setPreviewState(idleOperation);
    setGenerateState(idleOperation);
    setSaveState(idleOperation);
  }, [selectedCardsKey, task]);

  useEffect(() => {
    return () => {
      recommendRequestIdRef.current += 1;
      previewRequestIdRef.current += 1;
      generateRequestIdRef.current += 1;
      presetPromptRequestIdRef.current += 1;
    };
  }, []);

  const isPreviewLoading = previewState.status === "loading";
  const isGenerateLoading = generateState.status === "loading";
  const isSaveLoading = saveState.status === "loading";

  function getSelection(cardId: string) {
    return selectedCards.find((selectedCard) => selectedCard.cardId === cardId);
  }

  function applyMode(cardId: string, mode: SelectedCard["mode"] | "none") {
    setPreviewContext(null);
    setGenerateResult(null);
    setSaveState(idleOperation);

    setSelectedCards((currentSelectedCards) => {
      if (mode === "none") {
        return removeSelection(currentSelectedCards, cardId);
      }

      const currentSelection = currentSelectedCards.find((selectedCard) => selectedCard.cardId === cardId);
      const selectedFields =
        mode === "partial"
          ? currentSelection?.selectedFields.length
            ? currentSelection.selectedFields.filter(isAllowedSkillField)
            : defaultPartialFields
          : [];

      return upsertSelection(currentSelectedCards, { cardId, mode, selectedFields });
    });
  }

  function updateSelectedFields(cardId: string, fields: SkillField[]) {
    const nextFields = fields.filter(isAllowedSkillField);
    setSelectedCards((currentSelectedCards) =>
      upsertSelection(currentSelectedCards, {
        cardId,
        mode: "partial",
        selectedFields: nextFields.length > 0 ? nextFields : defaultPartialFields
      })
    );
  }

  async function handlePreview() {
    const requestId = previewRequestIdRef.current + 1;
    const requestTask = task;
    const requestCards = requestSelectedCards;
    previewRequestIdRef.current = requestId;
    setPreviewState({ error: null, status: "loading" });
    setPreviewContext(null);

    try {
      const preview = await api.preview(requestTask, requestCards);
      if (previewRequestIdRef.current !== requestId) {
        return;
      }

      setPreviewContext(preview.context);
      setPreviewState({ error: null, status: "success" });
    } catch (previewError) {
      if (previewRequestIdRef.current !== requestId) {
        return;
      }

      setPreviewState({ error: getErrorMessage(previewError, "无法预览上下文。"), status: "error" });
    }
  }

  async function handleGenerate() {
    const requestId = generateRequestIdRef.current + 1;
    const requestTask = task;
    const requestCards = requestSelectedCards;
    generateRequestIdRef.current = requestId;
    setGenerateState({ error: null, status: "loading" });
    setGenerateResult(null);
    setSaveState(idleOperation);

    try {
      const result = await api.generate(requestTask, requestCards);
      if (generateRequestIdRef.current !== requestId) {
        return;
      }

      setGenerateResult(result);
      setGenerateState({ error: null, status: "success" });
    } catch (generateError) {
      if (generateRequestIdRef.current !== requestId) {
        return;
      }

      setGenerateState({ error: getErrorMessage(generateError, "无法生成文本。"), status: "error" });
    }
  }

  async function handleSaveSuggestion() {
    if (!generateResult?.suggestedCard) {
      return;
    }

    setSaveState({ error: null, status: "loading" });

    try {
      await api.createCard(generateResult.suggestedCard);
      setSaveState({ error: null, status: "success" });
    } catch (saveError) {
      setSaveState({ error: getErrorMessage(saveError, "无法保存建议卡片。"), status: "error" });
    }
  }

  return (
    <div className="stack">
      <section className="page-title">
        <div>
          <h1>任务生成器</h1>
          <p>选择习惯、预览上下文，然后生成可复制的文本。</p>
        </div>
      </section>

      <section className="two-column">
        <div className="stack">
          <label className="panel stack">
            任务
            <textarea value={task} onChange={(event) => setTask(event.target.value)} />
          </label>

          <section className="panel stack" aria-label="推荐卡片">
            <div>
              <h2>推荐卡片</h2>
              <p>选择每张卡片如何参与本次文本生成。</p>
            </div>

            {recommendState.status === "loading" ? <p>正在加载推荐...</p> : null}
            {recommendState.status === "error" && recommendState.error ? <p role="alert">{recommendState.error}</p> : null}
            {recommendState.status === "success" && recommendations.length === 0 ? <p>没有找到推荐卡片。</p> : null}

            {recommendations.map((recommendation) => {
              const selection = getSelection(recommendation.card.id);
              const selectedMode = selection?.mode ?? "none";

              return (
                <article className="card stack" key={recommendation.card.id}>
                  <div>
                    <h2>{recommendation.card.name}</h2>
                    <p>{recommendation.card.description}</p>
                  </div>

                  <div className="tag-row" aria-label={`${recommendation.card.name} 推荐理由`}>
                    <span className="tag">{recommendation.score}% 匹配</span>
                    {recommendation.reasons.map((reason) => (
                      <span className="tag" key={reason}>
                        {reason}
                      </span>
                    ))}
                  </div>

                  <div className="button-row" aria-label={`${recommendation.card.name} 应用方式`}>
                    <button
                      className={`button ${selectedMode === "all" ? "primary" : ""}`}
                      type="button"
                      onClick={() => applyMode(recommendation.card.id, "all")}
                    >
                      全部应用
                    </button>
                    <button
                      className={`button ${selectedMode === "partial" ? "primary" : ""}`}
                      type="button"
                      onClick={() => applyMode(recommendation.card.id, "partial")}
                    >
                      选择字段
                    </button>
                    <button
                      className={`button ${selectedMode === "temporary" ? "primary" : ""}`}
                      type="button"
                      onClick={() => applyMode(recommendation.card.id, "temporary")}
                    >
                      仅本次
                    </button>
                    <button className={`button ${selectedMode === "none" ? "primary" : ""}`} type="button" onClick={() => applyMode(recommendation.card.id, "none")}>
                      不应用
                    </button>
                  </div>

                  {selection?.mode === "partial" ? (
                    <FieldPicker value={selection.selectedFields} onChange={(fields) => updateSelectedFields(recommendation.card.id, fields)} />
                  ) : null}
                </article>
              );
            })}
          </section>
        </div>

        <aside className="stack">
          <section className="panel stack">
            <div>
              <h2>已选择卡片</h2>
              <p>将发送 {requestSelectedCards.length} 张卡片。</p>
            </div>

            {requestSelectedCards.length > 0 ? (
              <div className="tag-row">
                {requestSelectedCards.map((selectedCard) => (
                  <span className="tag" key={selectedCard.cardId}>
                    {selectedCard.cardId}: {modeLabels[selectedCard.mode]}
                    {selectedCard.selectedFields.length > 0 ? ` (${selectedCard.selectedFields.map((field) => fieldLabels[field]).join(", ")})` : ""}
                  </span>
                ))}
              </div>
            ) : (
              <p>尚未选择卡片。</p>
            )}

            <div className="button-row">
              <button className="button" type="button" onClick={handlePreview} disabled={isPreviewLoading || isGenerateLoading}>
                <Eye size={16} aria-hidden="true" />
                {isPreviewLoading ? "预览中" : "预览上下文"}
              </button>
              <button className="button primary" type="button" onClick={handleGenerate} disabled={isPreviewLoading || isGenerateLoading}>
                <Wand2 size={16} aria-hidden="true" />
                {isGenerateLoading ? "生成中" : "生成文本"}
              </button>
            </div>
          </section>

          {previewState.status === "error" && previewState.error ? (
            <section className="panel" role="alert">
              {previewState.error}
            </section>
          ) : null}

          {previewContext ? (
            <section className="panel stack">
              <h2>上下文预览</h2>
              <pre>{previewContext}</pre>
            </section>
          ) : null}

          {generateState.status === "error" && generateState.error ? (
            <section className="panel" role="alert">
              {generateState.error}
            </section>
          ) : null}

          {generateResult ? (
            <section className="panel stack">
              <div className="button-row">
                <span className="badge">{generateResult.usedFallback ? "本地降级" : "真实模型"}</span>
                <span className="badge">{generateResult.provider}</span>
                <span className="badge">{generateResult.model}</span>
              </div>

              <div className="stack">
                <h2>生成上下文</h2>
                <pre>{generateResult.context}</pre>
              </div>

              <div className="stack">
                <h2>文本结果</h2>
                <pre>{generateResult.output}</pre>
              </div>

              <div className="stack">
                <div>
                  <h2>{generateResult.suggestedCard.name}</h2>
                  <p>{formatSuggestedCard(generateResult.suggestedCard)}</p>
                </div>
                <div className="button-row">
                  <button className="button primary" type="button" onClick={handleSaveSuggestion} disabled={isSaveLoading || saveState.status === "success"}>
                    <Save size={16} aria-hidden="true" />
                    {saveState.status === "success" ? "已保存建议" : isSaveLoading ? "保存建议中" : "保存建议"}
                  </button>
                </div>
                {saveState.status === "success" ? <p>建议已保存。</p> : null}
                {saveState.status === "error" && saveState.error ? <p role="alert">{saveState.error}</p> : null}
              </div>
            </section>
          ) : null}

          <section className="panel stack">
            <h2>运行状态</h2>
            <div className="tag-row">
              <span className="tag">推荐：{recommendState.status}</span>
              <span className="tag">预览：{previewState.status}</span>
              <span className="tag">生成：{generateState.status}</span>
              <span className="tag">保存：{saveState.status}</span>
            </div>
            <Sparkles size={18} aria-hidden="true" />
          </section>
        </aside>
      </section>
    </div>
  );
}
