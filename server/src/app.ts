import cors from "cors";
import express from "express";
import type { ErrorRequestHandler } from "express";
import type { LlmConfig } from "./config.js";
import { createCardsRouter } from "./routes/cards.js";
import { createContextRouter } from "./routes/context.js";
import { createGenerateRouter } from "./routes/generate.js";
import { createRecommendRouter } from "./routes/recommend.js";
import { createShareRouter } from "./routes/share.js";
import { createTimelineRouter } from "./routes/timeline.js";
import type { LlmAdapter } from "./services/llm/types.js";
import type { JsonStore } from "./services/store.js";

export type CreateAppDeps = {
  store: JsonStore;
  adapter: LlmAdapter;
  config: LlmConfig;
  clientOrigin: string;
};

export function createApp(deps: CreateAppDeps) {
  const app = express();

  app.use(cors({ origin: deps.clientOrigin }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({
      ok: true,
      provider: deps.config.provider,
      modelConfigured: Boolean(deps.config.model),
      fallbackEnabled: deps.config.mockFallback
    });
  });

  app.use("/api/cards", createCardsRouter({ store: deps.store }));
  app.use("/api/recommend", createRecommendRouter({ store: deps.store }));
  app.use("/api/context", createContextRouter({ store: deps.store }));
  app.use("/api/generate", createGenerateRouter({ store: deps.store, adapter: deps.adapter, config: deps.config }));
  app.use("/api/share", createShareRouter({ store: deps.store, clientOrigin: deps.clientOrigin }));
  app.use("/api/timeline", createTimelineRouter({ store: deps.store }));

  app.use(errorHandler);

  return app;
}

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const publicError = publicHttpErrorFrom(error);
  if (publicError) {
    response.status(publicError.status).json({ error: publicError.message });
    return;
  }

  response.status(500).json({ error: "Internal server error" });
};

function publicHttpErrorFrom(error: unknown): { status: number; message: string } | undefined {
  const status = numericProperty(error, "status") ?? numericProperty(error, "statusCode");

  if (!status || status < 400 || status >= 500) {
    return undefined;
  }

  return {
    status,
    message: publicMessage(error) ?? defaultPublicMessage(status)
  };
}

function publicMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("publicMessage" in error)) {
    return undefined;
  }

  const value = (error as { publicMessage?: unknown }).publicMessage;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function defaultPublicMessage(status: number): string {
  if (status === 400) {
    return "Invalid request";
  }
  if (status === 404) {
    return "Not found";
  }
  if (status === 413) {
    return "Request body too large";
  }
  return "Request failed";
}

function numericProperty(error: unknown, key: "status" | "statusCode"): number | undefined {
  if (!error || typeof error !== "object" || !(key in error)) {
    return undefined;
  }

  const value = (error as Record<typeof key, unknown>)[key];
  return typeof value === "number" ? value : undefined;
}
