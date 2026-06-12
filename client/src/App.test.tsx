import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { SkillCard } from "@shared/types";

const sampleCard: SkillCard = {
  id: "card-1",
  name: "Workshop Writer",
  description: "Keeps workshops concise.",
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

    expect(screen.getByRole("link", { name: /Library/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Task/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Timeline/i })).toBeInTheDocument();
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

    const scenarios = await screen.findByLabelText("Scenarios");
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
    expect(screen.queryByRole("button", { name: /Save/i })).not.toBeInTheDocument();
    expect(screen.getByText("Loading card...")).toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: /Save/i }));

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
    expect(screen.queryByText("Card saved.")).not.toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: /Save/i }));

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
    expect(screen.queryByText("Card saved.")).not.toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: /Save/i }));

    expect(screen.getByLabelText("Name")).toBeDisabled();
    expect(screen.getByLabelText("Description")).toBeDisabled();
    expect(screen.getByLabelText("Privacy")).toBeDisabled();
    expect(screen.getByLabelText("Scenarios")).toBeDisabled();
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
    await user.click(screen.getByRole("button", { name: /Share/i }));

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
    expect(screen.queryByText("Share link: https://share.test/card-1")).not.toBeInTheDocument();
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

    const shareButtons = await screen.findAllByRole("button", { name: /Share/i });
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

    const shareButtons = await screen.findAllByRole("button", { name: /Share/i });
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
});
