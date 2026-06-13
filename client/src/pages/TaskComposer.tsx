import { Eye, Save, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { GenerateResponse, Recommendation, SelectedCard, SkillField, SuggestedCard } from "@shared/types";
import { api } from "../api/client";
import { FieldPicker, allowedSkillFields } from "../components/FieldPicker";

const demoTask = "帮我为 HCI 课程做一个 8 页项目展示 PPT 大纲，主题是 AI Skill Passport。";
const defaultPartialFields: SkillField[] = ["styleRules"];

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
    card.scenarios.length > 0 ? `Scenarios: ${card.scenarios.join(", ")}` : "",
    card.styleRules.length > 0 ? `Style: ${card.styleRules.join(", ")}` : "",
    card.tags.length > 0 ? `Tags: ${card.tags.join(", ")}` : ""
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
  const requestSelectedCards = useMemo(() => sanitizeSelectedCards(selectedCards), [selectedCards]);
  const selectedCardsKey = useMemo(() => JSON.stringify(requestSelectedCards), [requestSelectedCards]);

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
        setRecommendState({ error: getErrorMessage(recommendError, "Unable to load recommendations."), status: "error" });
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

      setPreviewState({ error: getErrorMessage(previewError, "Unable to preview context."), status: "error" });
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

      setGenerateState({ error: getErrorMessage(generateError, "Unable to generate output."), status: "error" });
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
      setSaveState({ error: getErrorMessage(saveError, "Unable to save suggestion."), status: "error" });
    }
  }

  return (
    <div className="stack">
      <section className="page-title">
        <div>
          <h1>Task Composer</h1>
          <p>Select habits, preview model context, then generate.</p>
        </div>
      </section>

      <section className="two-column">
        <div className="stack">
          <label className="panel stack">
            Task
            <textarea value={task} onChange={(event) => setTask(event.target.value)} />
          </label>

          <section className="panel stack" aria-label="Recommended cards">
            <div>
              <h2>Recommended cards</h2>
              <p>Choose how each card contributes to this task.</p>
            </div>

            {recommendState.status === "loading" ? <p>Loading recommendations...</p> : null}
            {recommendState.status === "error" && recommendState.error ? <p role="alert">{recommendState.error}</p> : null}
            {recommendState.status === "success" && recommendations.length === 0 ? <p>No recommendations found.</p> : null}

            {recommendations.map((recommendation) => {
              const selection = getSelection(recommendation.card.id);
              const selectedMode = selection?.mode ?? "none";

              return (
                <article className="card stack" key={recommendation.card.id}>
                  <div>
                    <h2>{recommendation.card.name}</h2>
                    <p>{recommendation.card.description}</p>
                  </div>

                  <div className="tag-row" aria-label={`${recommendation.card.name} recommendation reasons`}>
                    <span className="tag">{recommendation.score}% match</span>
                    {recommendation.reasons.map((reason) => (
                      <span className="tag" key={reason}>
                        {reason}
                      </span>
                    ))}
                  </div>

                  <div className="button-row" aria-label={`${recommendation.card.name} application mode`}>
                    <button
                      className={`button ${selectedMode === "all" ? "primary" : ""}`}
                      type="button"
                      onClick={() => applyMode(recommendation.card.id, "all")}
                    >
                      Apply all
                    </button>
                    <button
                      className={`button ${selectedMode === "partial" ? "primary" : ""}`}
                      type="button"
                      onClick={() => applyMode(recommendation.card.id, "partial")}
                    >
                      Selected fields
                    </button>
                    <button
                      className={`button ${selectedMode === "temporary" ? "primary" : ""}`}
                      type="button"
                      onClick={() => applyMode(recommendation.card.id, "temporary")}
                    >
                      Only this task
                    </button>
                    <button className={`button ${selectedMode === "none" ? "primary" : ""}`} type="button" onClick={() => applyMode(recommendation.card.id, "none")}>
                      Do not apply
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
              <h2>Selected cards</h2>
              <p>{requestSelectedCards.length} card{requestSelectedCards.length === 1 ? "" : "s"} will be sent.</p>
            </div>

            {requestSelectedCards.length > 0 ? (
              <div className="tag-row">
                {requestSelectedCards.map((selectedCard) => (
                  <span className="tag" key={selectedCard.cardId}>
                    {selectedCard.cardId}: {selectedCard.mode}
                    {selectedCard.selectedFields.length > 0 ? ` (${selectedCard.selectedFields.join(", ")})` : ""}
                  </span>
                ))}
              </div>
            ) : (
              <p>No cards selected.</p>
            )}

            <div className="button-row">
              <button className="button" type="button" onClick={handlePreview} disabled={isPreviewLoading || isGenerateLoading}>
                <Eye size={16} aria-hidden="true" />
                {isPreviewLoading ? "Previewing" : "Preview Context"}
              </button>
              <button className="button primary" type="button" onClick={handleGenerate} disabled={isPreviewLoading || isGenerateLoading}>
                <Wand2 size={16} aria-hidden="true" />
                {isGenerateLoading ? "Generating" : "Generate"}
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
              <h2>Preview Context</h2>
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
                <span className="badge">{generateResult.usedFallback ? "Fallback" : "Real model"}</span>
                <span className="badge">{generateResult.provider}</span>
                <span className="badge">{generateResult.model}</span>
              </div>

              <div className="stack">
                <h2>Generated Context</h2>
                <pre>{generateResult.context}</pre>
              </div>

              <div className="stack">
                <h2>Output</h2>
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
                    {saveState.status === "success" ? "Saved Suggestion" : isSaveLoading ? "Saving Suggestion" : "Save Suggestion"}
                  </button>
                </div>
                {saveState.status === "success" ? <p>Suggestion saved.</p> : null}
                {saveState.status === "error" && saveState.error ? <p role="alert">{saveState.error}</p> : null}
              </div>
            </section>
          ) : null}

          <section className="panel stack">
            <h2>Ready state</h2>
            <div className="tag-row">
              <span className="tag">{recommendState.status} recommendations</span>
              <span className="tag">{previewState.status} preview</span>
              <span className="tag">{generateState.status} generate</span>
              <span className="tag">{saveState.status} save</span>
            </div>
            <Sparkles size={18} aria-hidden="true" />
          </section>
        </aside>
      </section>
    </div>
  );
}
