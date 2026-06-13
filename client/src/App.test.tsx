import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { GenerateResponse, MemoryEvent, Recommendation, ShareLink, SkillCard } from "@shared/types";
import type { HealthResponse } from "./api/client";

const sampleCard: SkillCard & { presetPrompt: string } = {
  id: "card-1",
  name: "Workshop Writer",
  description: "Keeps workshops concise.",
  presetPrompt: "请为一次 HCI 课程展示写一份 8 页中文讲稿大纲，只输出文本，不要生成图片或文件。",
  scenarios: ["draft brief"],
  tone: ["direct"],
  structure: ["summary first"],
  styleRules: ["short sentences"],
  constraints: ["no jargon"],
  examples: ["Before -> After"],
  tags: ["writing"],
  privacy: "private",
  compatibility: {
    chat: 80,
    ppt: 90,
    writing: 95,
    coding: 20
  },
  usageCount: 0,
  createdAt: "2026-06-12T00:00:00.000Z",
  updatedAt: "2026-06-12T00:00:00.000Z"
};

const secondCard: SkillCard = {
  ...sampleCard,
  id: "card-2",
  name: "Second Card",
  description: "Keeps second-card work isolated."
};

const sampleRecommendation: Recommendation = {
  card: sampleCard,
  score: 88,
  reasons: ["匹配 PPT 大纲任务", "保持文案简洁"]
};

const suggestedCard = {
  name: "AI 技能护照展示助手",
  description: "用于 HCI 项目演示的可复用文本大纲习惯。",
  presetPrompt: "请生成一份中文 HCI 项目展示大纲，只输出文本。",
  scenarios: ["HCI 项目展示"],
  tone: ["清晰"],
  structure: ["8 页大纲"],
  styleRules: ["使用简洁要点"],
  constraints: ["中文输出", "只输出文本"],
  examples: ["标题 -> 核心信息"],
  tags: ["ppt", "hci"],
  privacy: "private" as const
};

const sampleGenerateResponse: GenerateResponse = {
  sessionId: "session-1",
  context: "生成上下文",
  output: "生成的中文 PPT 大纲",
  provider: "local",
  model: "fallback-demo",
  usedFallback: true,
  suggestedCard
};

const sampleShare: ShareLink = {
  id: "share-1",
  cardId: sampleCard.id,
  snapshot: {
    ...sampleCard,
    privacy: "link",
    usageCount: 3,
    lastUsedAt: "2026-06-12T03:00:00.000Z"
  },
  createdAt: "2026-06-12T04:00:00.000Z",
  expiresAt: "2026-06-19T04:00:00.000Z",
  importCount: 2
};

const sampleTimelineEvent: MemoryEvent = {
  id: "event-1",
  type: "imported",
  cardId: sampleCard.id,
  title: "导入分享技能卡片",
  detail: sampleCard.name,
  createdAt: "2026-06-12T05:00:00.000Z"
};

type MockJsonResponse<T> = {
  ok: boolean;
  json: () => Promise<T>;
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

function okJson<T>(body: T): MockJsonResponse<T> {
  return {
    ok: true,
    json: async () => body
  };
}

function errorJson(message: string): MockJsonResponse<{ error: string }> {
  return {
    ok: false,
    json: async () => ({ error: message })
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

describe("App", () => {
  it("renders the local demo navigation", () => {
    render(<App />);

    expect(screen.getByRole("link", { name: /卡片库/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /任务生成/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /时间线/i })).toBeInTheDocument();
  });

  it("preserves blank newline drafts while editing card array fields", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => sampleCard
      }))
    );
    window.history.pushState({}, "", "/cards/card-1");

    render(<App />);

    const scenarios = await screen.findByLabelText("适用场景");
    await user.click(scenarios);
    await user.keyboard("{End}{Enter}");

    expect(scenarios).toHaveValue("draft brief\n");
  });

  it("clears stale card detail while a new route card is loading", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.endsWith("/cards/card-1")) {
          return {
            ok: true,
            json: async () => sampleCard
          };
        }

        if (url.endsWith("/cards/card-2")) {
          return new Promise(() => undefined);
        }

        throw new Error(`Unexpected request: ${url}`);
      })
    );
    window.history.pushState({}, "", "/cards/card-1");

    render(<App />);

    expect(await screen.findByRole("heading", { name: sampleCard.name })).toBeInTheDocument();

    act(() => {
      window.history.pushState({}, "", "/cards/card-2");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() => expect(screen.queryByRole("heading", { name: sampleCard.name })).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /保存/i })).not.toBeInTheDocument();
    expect(screen.getByText("正在加载卡片...")).toBeInTheDocument();
  });

  it("ignores a stale card save result after the route changes", async () => {
    const user = userEvent.setup();
    const saveCardOne = createDeferred<MockJsonResponse<SkillCard>>();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method || "GET";

        if (method === "GET" && url.endsWith("/cards/card-1")) {
          return okJson(sampleCard);
        }

        if (method === "PATCH" && url.endsWith("/cards/card-1")) {
          return saveCardOne.promise;
        }

        if (method === "GET" && url.endsWith("/cards/card-2")) {
          return okJson(secondCard);
        }

        throw new Error(`Unexpected request: ${method} ${url}`);
      })
    );
    window.history.pushState({}, "", "/cards/card-1");

    render(<App />);

    expect(await screen.findByRole("heading", { name: sampleCard.name })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /保存/i }));

    act(() => {
      window.history.pushState({}, "", "/cards/card-2");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(await screen.findByRole("heading", { name: secondCard.name })).toBeInTheDocument();

    await act(async () => {
      saveCardOne.resolve(okJson({ ...sampleCard, name: "Saved Old Card" }));
      await saveCardOne.promise;
    });

    expect(screen.getByRole("heading", { name: secondCard.name })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Saved Old Card" })).not.toBeInTheDocument();
    expect(screen.queryByText("卡片已保存。")).not.toBeInTheDocument();
  });

  it("ignores a stale card save result after navigating away and back to the same card", async () => {
    const user = userEvent.setup();
    const saveCardOne = createDeferred<MockJsonResponse<SkillCard>>();
    const freshCardOne = { ...sampleCard, name: "Fresh Workshop Writer" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method || "GET";

        if (method === "GET" && url.endsWith("/cards/card-1")) {
          return okJson(freshCardOne);
        }

        if (method === "PATCH" && url.endsWith("/cards/card-1")) {
          return saveCardOne.promise;
        }

        if (method === "GET" && url.endsWith("/cards/card-2")) {
          return okJson(secondCard);
        }

        throw new Error(`Unexpected request: ${method} ${url}`);
      })
    );
    window.history.pushState({}, "", "/cards/card-1");

    render(<App />);

    expect(await screen.findByRole("heading", { name: freshCardOne.name })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /保存/i }));

    act(() => {
      window.history.pushState({}, "", "/cards/card-2");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(await screen.findByRole("heading", { name: secondCard.name })).toBeInTheDocument();

    act(() => {
      window.history.pushState({}, "", "/cards/card-1");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(await screen.findByRole("heading", { name: freshCardOne.name })).toBeInTheDocument();

    await act(async () => {
      saveCardOne.resolve(okJson({ ...sampleCard, name: "Stale Saved Card" }));
      await saveCardOne.promise;
    });

    expect(screen.getByRole("heading", { name: freshCardOne.name })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Stale Saved Card" })).not.toBeInTheDocument();
    expect(screen.queryByText("卡片已保存。")).not.toBeInTheDocument();
  });

  it("locks card detail editors while save is in flight", async () => {
    const user = userEvent.setup();
    const saveCardOne = createDeferred<MockJsonResponse<SkillCard>>();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method || "GET";

        if (method === "GET" && url.endsWith("/cards/card-1")) {
          return okJson(sampleCard);
        }

        if (method === "PATCH" && url.endsWith("/cards/card-1")) {
          return saveCardOne.promise;
        }

        throw new Error(`Unexpected request: ${method} ${url}`);
      })
    );
    window.history.pushState({}, "", "/cards/card-1");

    render(<App />);

    expect(await screen.findByRole("heading", { name: sampleCard.name })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /保存/i }));

    expect(screen.getByLabelText("名称")).toBeDisabled();
    expect(screen.getByLabelText("描述")).toBeDisabled();
    expect(screen.getByLabelText("可见性")).toBeDisabled();
    expect(screen.getByLabelText("适用场景")).toBeDisabled();
  });

  it("ignores a stale card share result after the route changes", async () => {
    const user = userEvent.setup();
    const shareCardOne = createDeferred<MockJsonResponse<{ shareId: string; url: string }>>();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method || "GET";

        if (method === "GET" && url.endsWith("/cards/card-1")) {
          return okJson(sampleCard);
        }

        if (method === "GET" && url.endsWith("/cards/card-2")) {
          return okJson(secondCard);
        }

        if (method === "POST" && url.endsWith("/share")) {
          return shareCardOne.promise;
        }

        throw new Error(`Unexpected request: ${method} ${url}`);
      })
    );
    window.history.pushState({}, "", "/cards/card-1");

    render(<App />);

    expect(await screen.findByRole("heading", { name: sampleCard.name })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /分享/i }));

    act(() => {
      window.history.pushState({}, "", "/cards/card-2");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(await screen.findByRole("heading", { name: secondCard.name })).toBeInTheDocument();

    await act(async () => {
      shareCardOne.resolve(okJson({ shareId: "share-1", url: "https://share.test/card-1" }));
      await shareCardOne.promise;
    });

    expect(screen.getByRole("heading", { name: secondCard.name })).toBeInTheDocument();
    expect(screen.queryByText("分享链接：https://share.test/card-1")).not.toBeInTheDocument();
  });

  it("clears a previous dashboard share URL when the next share fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith("/cards")) {
          return {
            ok: true,
            json: async () => [sampleCard, secondCard]
          };
        }

        if (url.endsWith("/share") && init?.body) {
          const body = JSON.parse(String(init.body)) as { cardId: string };

          if (body.cardId === sampleCard.id) {
            return {
              ok: true,
              json: async () => ({ shareId: "share-1", url: "https://share.test/card-1" })
            };
          }

          return {
            ok: false,
            json: async () => ({ error: "Share failed" })
          };
        }

        throw new Error(`Unexpected request: ${url}`);
      })
    );

    render(<App />);

    const shareButtons = await screen.findAllByRole("button", { name: /分享/i });
    await user.click(shareButtons[0]);
    expect(await screen.findByRole("link", { name: "https://share.test/card-1" })).toBeInTheDocument();

    await user.click(shareButtons[1]);

    await waitFor(() => expect(screen.queryByRole("link", { name: "https://share.test/card-1" })).not.toBeInTheDocument());
    expect(await screen.findByRole("alert")).toHaveTextContent("Share failed");
  });

  it("ignores an older dashboard share success after a newer share fails", async () => {
    const user = userEvent.setup();
    const slowShare = createDeferred<MockJsonResponse<{ shareId: string; url: string }>>();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith("/cards")) {
          return okJson([sampleCard, secondCard]);
        }

        if (url.endsWith("/share") && init?.body) {
          const body = JSON.parse(String(init.body)) as { cardId: string };

          if (body.cardId === sampleCard.id) {
            return slowShare.promise;
          }

          return errorJson("Share failed");
        }

        throw new Error(`Unexpected request: ${url}`);
      })
    );

    render(<App />);

    const shareButtons = await screen.findAllByRole("button", { name: /分享/i });
    await user.click(shareButtons[0]);
    await user.click(shareButtons[1]);

    expect(await screen.findByRole("alert")).toHaveTextContent("Share failed");

    await act(async () => {
      slowShare.resolve(okJson({ shareId: "share-1", url: "https://share.test/slow-card-1" }));
      await slowShare.promise;
    });

    expect(screen.queryByRole("link", { name: "https://share.test/slow-card-1" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Share failed");
  });

  it("loads task recommendations and previews a query-selected card with all fields", async () => {
    const user = userEvent.setup();
    const requests: Array<{ body: unknown; method: string; url: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method || "GET";
        requests.push({ body: init?.body ? JSON.parse(String(init.body)) : undefined, method, url });

        if (method === "GET" && url.endsWith("/cards/card-1")) {
          return okJson(sampleCard);
        }

        if (method === "POST" && url.endsWith("/recommend")) {
          return okJson([sampleRecommendation]);
        }

        if (method === "POST" && url.endsWith("/context/preview")) {
          return okJson({ context: "Preview context from selected card", appliedCards: [] });
        }

        throw new Error(`Unexpected request: ${method} ${url}`);
      })
    );
    window.history.pushState({}, "", "/task?card=card-1");

    render(<App />);

    expect(await screen.findByRole("heading", { name: sampleCard.name })).toBeInTheDocument();
    expect(await screen.findByDisplayValue(sampleCard.presetPrompt)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /预览上下文/i }));

    expect(await screen.findByText("Preview context from selected card")).toBeInTheDocument();
    expect(requests.find((request) => request.url.endsWith("/context/preview"))).toMatchObject({
      body: {
        task: sampleCard.presetPrompt,
        selectedCards: [{ cardId: "card-1", mode: "all", selectedFields: [] }]
      },
      method: "POST",
      url: "/api/context/preview"
    });
  });

  it("loads the query-selected card preset prompt into the task editor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method || "GET";

        if (method === "GET" && url.endsWith("/cards/card-1")) {
          return okJson(sampleCard);
        }

        if (method === "POST" && url.endsWith("/recommend")) {
          return okJson([sampleRecommendation]);
        }

        throw new Error(`Unexpected request: ${method} ${url}`);
      })
    );
    window.history.pushState({}, "", "/task?card=card-1");

    render(<App />);

    expect(await screen.findByDisplayValue(sampleCard.presetPrompt)).toBeInTheDocument();
  });

  it("generates with selected fields, displays fallback details, and saves the suggestion", async () => {
    const user = userEvent.setup();
    const requests: Array<{ body: unknown; method: string; url: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method || "GET";
        requests.push({ body: init?.body ? JSON.parse(String(init.body)) : undefined, method, url });

        if (method === "POST" && url.endsWith("/recommend")) {
          return okJson([sampleRecommendation]);
        }

        if (method === "POST" && url.endsWith("/generate")) {
          return okJson(sampleGenerateResponse);
        }

        if (method === "POST" && url.endsWith("/cards")) {
          return okJson({ ...sampleCard, ...suggestedCard, id: "suggested-card-1" });
        }

        throw new Error(`Unexpected request: ${method} ${url}`);
      })
    );
    window.history.pushState({}, "", "/task");

    render(<App />);

    expect(await screen.findByRole("heading", { name: sampleCard.name })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /选择字段/i }));

    const styleRules = screen.getByRole("checkbox", { name: /风格规则/i });
    expect(styleRules).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: /示例/i }));

    await user.click(screen.getByRole("button", { name: /生成文本/i }));

    expect(await screen.findByText("生成的中文 PPT 大纲")).toBeInTheDocument();
    expect(screen.getByText("本地降级")).toBeInTheDocument();
    expect(screen.getByText("AI 技能护照展示助手")).toBeInTheDocument();
    expect(requests.find((request) => request.url.endsWith("/generate"))).toMatchObject({
      body: {
        task: "请为 HCI 课程项目“AI Skill Passport”写一份 8 页中文展示大纲，只输出文本。",
        selectedCards: [{ cardId: "card-1", mode: "partial", selectedFields: ["styleRules", "examples"] }]
      }
    });

    await user.click(screen.getByRole("button", { name: /保存建议/i }));

    expect(await screen.findByText("建议已保存。")).toBeInTheDocument();
    expect(requests.find((request) => request.url.endsWith("/cards"))).toMatchObject({
      body: suggestedCard,
      method: "POST"
    });
  });

  it("ignores stale task preview results after the task changes", async () => {
    const user = userEvent.setup();
    const preview = createDeferred<MockJsonResponse<{ context: string; appliedCards: [] }>>();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method || "GET";

        if (method === "POST" && url.endsWith("/recommend")) {
          return okJson([sampleRecommendation]);
        }

        if (method === "POST" && url.endsWith("/context/preview")) {
          return preview.promise;
        }

        throw new Error(`Unexpected request: ${method} ${url}`);
      })
    );
    window.history.pushState({}, "", "/task");

    render(<App />);

    expect(await screen.findByRole("heading", { name: sampleCard.name })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /预览上下文/i }));
    expect(screen.getByText("预览：loading")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("任务"));
    await user.type(screen.getByLabelText("任务"), "新的任务");

    await waitFor(() => expect(screen.getByText("预览：idle")).toBeInTheDocument());

    await act(async () => {
      preview.resolve(okJson({ context: "Stale preview context", appliedCards: [] }));
      await preview.promise;
    });

    expect(screen.queryByText("Stale preview context")).not.toBeInTheDocument();
    expect(screen.getByText("预览：idle")).toBeInTheDocument();
  });

  it("ignores stale generate results after selected cards change", async () => {
    const user = userEvent.setup();
    const generate = createDeferred<MockJsonResponse<GenerateResponse>>();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method || "GET";

        if (method === "POST" && url.endsWith("/recommend")) {
          return okJson([sampleRecommendation]);
        }

        if (method === "POST" && url.endsWith("/generate")) {
          return generate.promise;
        }

        throw new Error(`Unexpected request: ${method} ${url}`);
      })
    );
    window.history.pushState({}, "", "/task?card=card-1");

    render(<App />);

    expect(await screen.findByRole("heading", { name: sampleCard.name })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /生成文本/i }));
    expect(screen.getByText("生成：loading")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /不应用/i }));

    expect(screen.getByText("生成：idle")).toBeInTheDocument();

    await act(async () => {
      generate.resolve(okJson(sampleGenerateResponse));
      await generate.promise;
    });

    expect(screen.queryByText("生成的中文 PPT 大纲")).not.toBeInTheDocument();
    expect(screen.getByText("生成：idle")).toBeInTheDocument();
  });

  it("previews a share snapshot and imports or forks it", async () => {
    const user = userEvent.setup();
    const requests: Array<{ body: unknown; method: string; url: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method || "GET";
        requests.push({ body: init?.body ? JSON.parse(String(init.body)) : undefined, method, url });

        if (method === "GET" && url.endsWith("/share/share-1")) {
          return okJson(sampleShare);
        }

        if (method === "POST" && url.endsWith("/share/share-1/import")) {
          return okJson({ ...sampleCard, id: "imported-1", name: "Imported Workshop" });
        }

        if (method === "POST" && url.endsWith("/share/share-1/fork")) {
          return okJson({ ...sampleCard, id: "fork-1", name: "Workshop Writer 副本" });
        }

        throw new Error(`Unexpected request: ${method} ${url}`);
      })
    );
    window.history.pushState({}, "", "/share/share-1");

    render(<App />);

    expect(await screen.findByRole("heading", { name: sampleCard.name })).toBeInTheDocument();
    expect(screen.getByText(sampleCard.description)).toBeInTheDocument();
    expect(screen.getByText("链接分享")).toBeInTheDocument();
    expect(screen.getByText("只读快照")).toBeInTheDocument();
    expect(screen.getByText("draft brief")).toBeInTheDocument();
    expect(screen.getByText("3 次使用")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /导入/i }));
    expect(await screen.findByText("已导入为 Imported Workshop。")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /复刻并编辑/i }));
    expect(await screen.findByText("已复刻为 Workshop Writer 副本。")).toBeInTheDocument();
    expect(requests.find((request) => request.url.endsWith("/fork"))).toMatchObject({
      body: { name: "Workshop Writer 副本", privacy: "private" },
      method: "POST"
    });
  });

  it("ignores stale share preview loads when the share route changes", async () => {
    const slowShare = createDeferred<MockJsonResponse<ShareLink>>();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.endsWith("/share/share-1")) {
          return slowShare.promise;
        }

        if (url.endsWith("/share/share-2")) {
          return okJson({
            ...sampleShare,
            id: "share-2",
            snapshot: { ...secondCard, privacy: "public" }
          });
        }

        throw new Error(`Unexpected request: ${url}`);
      })
    );
    window.history.pushState({}, "", "/share/share-1");

    render(<App />);
    expect(screen.getByText("正在加载分享预览...")).toBeInTheDocument();

    act(() => {
      window.history.pushState({}, "", "/share/share-2");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(await screen.findByRole("heading", { name: secondCard.name })).toBeInTheDocument();

    await act(async () => {
      slowShare.resolve(okJson(sampleShare));
      await slowShare.promise;
    });

    expect(screen.getByRole("heading", { name: secondCard.name })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: sampleCard.name })).not.toBeInTheDocument();
  });

  it("shows timeline events and an empty timeline distinctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.endsWith("/timeline")) {
          return okJson([sampleTimelineEvent]);
        }

        throw new Error(`Unexpected request: ${url}`);
      })
    );
    window.history.pushState({}, "", "/timeline");

    const { unmount } = render(<App />);

    expect(await screen.findByRole("heading", { name: "记忆时间线" })).toBeInTheDocument();
    expect(screen.getByText("导入分享技能卡片")).toBeInTheDocument();
    expect(screen.getByText(sampleCard.name)).toBeInTheDocument();
    expect(screen.getByText("导入")).toBeInTheDocument();

    unmount();
    vi.stubGlobal("fetch", vi.fn(async () => okJson([])));
    render(<App />);

    expect(await screen.findByText("还没有记忆事件。")).toBeInTheDocument();
  });

  it("keeps the newest settings health refresh when responses finish out of order", async () => {
    const user = userEvent.setup();
    const slowRefresh = createDeferred<MockJsonResponse<HealthResponse>>();
    let healthRequestCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.endsWith("/health")) {
          healthRequestCount += 1;

          if (healthRequestCount === 1) {
            return okJson({ fallbackEnabled: true, modelConfigured: false, ok: true, provider: "initial-provider" });
          }

          if (healthRequestCount === 2) {
            return slowRefresh.promise;
          }

          return okJson({ fallbackEnabled: false, modelConfigured: true, ok: true, provider: "new-provider" });
        }

        throw new Error(`Unexpected request: ${url}`);
      })
    );
    window.history.pushState({}, "", "/settings");

    render(<App />);

    expect(await screen.findByText("initial-provider")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /刷新/i }));
    await user.click(screen.getByRole("button", { name: /刷新/i }));

    expect(await screen.findByText("new-provider")).toBeInTheDocument();

    await act(async () => {
      slowRefresh.resolve(okJson({ fallbackEnabled: true, modelConfigured: false, ok: false, provider: "stale-provider" }));
      await slowRefresh.promise;
    });

    expect(screen.getByText("new-provider")).toBeInTheDocument();
    expect(screen.queryByText("stale-provider")).not.toBeInTheDocument();
    expect(screen.getByText("浏览器不会收到 LLM_API_KEY，API 密钥只保存在后端。")).toBeInTheDocument();
  });
});
