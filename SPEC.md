# AI Skill Passport Real LLM Local Demo SPEC

Date: 2026-06-12
Source deck: `C:\Users\hp\Documents\Tencent Files\2374637357\FileRecv\AI_Skill_Passport_Cloud_Web.pptx`
Target: local demo for "AI Skill Passport / 云端 Web 版 AI 习惯护照"

## 1. Goal

Build a local web demo that proves the project is more than a static UI: users can create, select, combine, share, import, and apply Skill Cards, and the selected cards are truly injected into a large language model request.

The demo should let an evaluator see this loop in one run:

1. The user owns a library of reusable AI work habits.
2. The user starts a new AI task.
3. The system recommends relevant Skill Cards.
4. The user chooses whether to apply all, part, or none of a card.
5. The backend converts selected cards into a model-ready context block.
6. A real LLM API generates a response using the selected habits.
7. The system proposes a new or updated habit after the task.
8. The user can save, share, preview, and import the habit.

## 2. Recommended Approach

Use a local full-stack demo:

- Frontend: Vite + React + TypeScript.
- Backend: Node.js + Express.
- Storage: local JSON file or SQLite; JSON is enough for the demo.
- LLM integration: provider adapter with OpenAI-compatible request shape.
- Runtime: `http://localhost:5173` for frontend and `http://localhost:8787` for backend.

This is the recommended option because it is real enough to demonstrate technical validity while still small enough to finish quickly.

### Alternatives Considered

Pure frontend mock:

- Pros: fastest, most stable.
- Cons: does not prove real model integration.
- Decision: not enough, because the user explicitly wants real LLM access.

Full cloud product:

- Pros: closest to final product vision.
- Cons: login, deployment, database, auth, billing, and privacy work would distract from the local demo.
- Decision: out of scope for this version.

Local full-stack demo with real LLM:

- Pros: demonstrates the core mechanism and remains presentation-friendly.
- Cons: needs API key handling and failure fallback.
- Decision: use this.

## 3. Scope

### In Scope

- Skill Card library.
- Skill Card detail view.
- Task composer with real LLM generation.
- Skill recommendation based on tags and simple text matching.
- Skill application modes:
  - apply all
  - apply selected fields
  - apply only for this task
  - do not apply
- Prompt/context preview before generation.
- Real backend LLM request.
- Save generated habit suggestion.
- Share link generation.
- Share preview and import/fork.
- Local privacy level selector:
  - private
  - link share
  - team
  - public demo
- Memory timeline of habit changes.
- Compatibility labels for different model/tool contexts.

### Out of Scope

- Real user accounts.
- OAuth.
- Multi-user cloud deployment.
- Payment, billing, or quotas.
- Real public community feed.
- Browser extension.
- Fine-tuning.
- Vector database.
- Long-term encrypted cloud storage.
- Automatic access to external AI tools.

## 4. Product Narrative

The demo should support one primary story:

"AI is powerful, but users keep repeating their preferences. AI Skill Passport turns reusable AI collaboration habits into visible, selectable Skill Cards. When the user starts a new task, selected cards become model context, so the LLM continues the user's style across tasks and tools."

The interface must make three things obvious:

- The habit is user-owned and editable.
- The user chooses when and how the habit is applied.
- The LLM output changes because of the selected habit.

## 5. Core Demo Scenario

Seed cards:

1. Classroom Presentation
   - Tone: formal but not stiff.
   - Structure: background, problem, concept, flow, value, summary.
   - Style: concise slides, visible hierarchy, fewer long paragraphs.
   - Applies to: PPT, course presentation, HCI report.

2. Defense Presentation
   - Tone: confident, evidence-led.
   - Structure: research question, method, result, contribution, limitation.
   - Style: emphasize problem-solution logic and diagrams.

3. Formal Chinese Email
   - Tone: polite, concise, respectful.
   - Structure: greeting, purpose, key points, request, closing.

4. Minimal Visual Style
   - Tone: clean and direct.
   - Structure: one idea per section.
   - Style: restrained colors, clear spacing, no dense decoration.

Demo task:

```text
帮我为 HCI 课程做一个 8 页项目展示 PPT 大纲，主题是 AI Skill Passport。
```

Expected behavior:

- The system recommends "Classroom Presentation" and "Minimal Visual Style".
- The user applies all of Classroom Presentation and selected fields of Minimal Visual Style.
- The backend sends the merged context and task to the LLM.
- The returned outline should reflect the selected habits:
  - 8-slide structure.
  - formal but natural Chinese.
  - problem-solution-value flow.
  - limited text per slide.
  - mention Skill Cards, sharing, importing, and user control.
- The system suggests saving a new card such as "HCI Project Demo Outline".

## 6. Information Architecture

Routes:

- `/`
  - dashboard and card library.
- `/cards/:cardId`
  - card detail and edit page.
- `/task`
  - task composer, recommendation, context preview, LLM output.
- `/timeline`
  - memory timeline of saved and updated habits.
- `/share/:shareId`
  - share preview, import, and fork.
- `/settings`
  - model provider, API status, and local demo settings.

## 7. UI Requirements

### Dashboard / Card Library

Show a scannable grid or list of Skill Cards.

Each card displays:

- name
- short description
- tags
- privacy level
- usage count
- last used time
- compatibility score
- main actions:
  - use
  - edit
  - share

### Card Detail

Show editable fields:

- name
- description
- scenarios
- tone
- structure
- style rules
- constraints
- examples
- tags
- privacy level

Actions:

- apply all
- select fields to apply
- temporary use
- generate share link
- save changes

### Task Composer

Panels:

- task input
- recommended cards
- selected habits
- context preview
- model output
- save/update suggestion

The context preview is important. It should show the exact structured habit block that will be sent to the backend, so the demo visibly proves how the Skill Card connects to the model.

### Share Preview

Show:

- shared card content
- source card name
- privacy mode
- preview-only notice
- import button
- fork and edit button

## 8. Data Model

### SkillCard

```ts
type SkillCard = {
  id: string;
  name: string;
  description: string;
  scenarios: string[];
  tone: string[];
  structure: string[];
  styleRules: string[];
  constraints: string[];
  examples: string[];
  tags: string[];
  privacy: "private" | "link" | "team" | "public";
  compatibility: {
    chat: number;
    ppt: number;
    writing: number;
    coding: number;
  };
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
};
```

### TaskSession

```ts
type TaskSession = {
  id: string;
  userTask: string;
  selectedCards: SelectedCard[];
  generatedContext: string;
  modelProvider: string;
  modelName: string;
  output: string;
  status: "draft" | "generating" | "completed" | "failed";
  createdAt: string;
};
```

### SelectedCard

```ts
type SelectedCard = {
  cardId: string;
  mode: "all" | "partial" | "temporary";
  selectedFields: Array<
    "tone" | "structure" | "styleRules" | "constraints" | "examples"
  >;
};
```

### ShareLink

```ts
type ShareLink = {
  id: string;
  cardId: string;
  snapshot: SkillCard;
  createdAt: string;
  expiresAt?: string;
  importCount: number;
};
```

### MemoryEvent

```ts
type MemoryEvent = {
  id: string;
  type: "created" | "used" | "updated" | "shared" | "imported" | "suggested";
  cardId?: string;
  taskSessionId?: string;
  title: string;
  detail: string;
  createdAt: string;
};
```

## 9. Backend API

Base URL: `http://localhost:8787/api`

### Cards

- `GET /cards`
  - returns all local cards.
- `GET /cards/:id`
  - returns one card.
- `POST /cards`
  - creates a card.
- `PATCH /cards/:id`
  - updates a card.
- `DELETE /cards/:id`
  - deletes a card.

### Recommendations

- `POST /recommend`
  - input: `{ task: string }`
  - output: ranked cards.
  - first version uses keyword/tag matching.

### Context Preview

- `POST /context/preview`
  - input: `{ task: string, selectedCards: SelectedCard[] }`
  - output: `{ context: string, appliedCards: AppliedCardSummary[] }`
  - no LLM call.

### LLM Generation

- `POST /generate`
  - input:

```json
{
  "task": "帮我为 HCI 课程做一个 8 页项目展示 PPT 大纲，主题是 AI Skill Passport。",
  "selectedCards": [
    {
      "cardId": "classroom-presentation",
      "mode": "all",
      "selectedFields": []
    }
  ]
}
```

  - output:

```json
{
  "sessionId": "session_001",
  "context": "...",
  "output": "...",
  "suggestedCard": {
    "name": "HCI Project Demo Outline",
    "description": "..."
  }
}
```

### Sharing

- `POST /share`
  - input: `{ cardId: string }`
  - output: `{ shareId: string, url: string }`
- `GET /share/:shareId`
  - returns share preview snapshot.
- `POST /share/:shareId/import`
  - imports card into local library.
- `POST /share/:shareId/fork`
  - imports card with user edits.

### Timeline

- `GET /timeline`
  - returns memory events.

## 10. LLM Integration

The backend must call a real model provider from the server only. The browser must never receive the API key.

Environment variables:

```bash
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=
LLM_MODEL=
LLM_TIMEOUT_MS=30000
LLM_MOCK_FALLBACK=true
```

`LLM_API_KEY` and `LLM_MODEL` are intentionally empty in `.env.example`. The server must read the real values from the developer's local `.env` file, fail with a clear configuration error when they are missing, and use fallback content only when `LLM_MOCK_FALLBACK=true`.

Adapter contract:

```ts
type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type LlmGenerateInput = {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
};

type LlmGenerateResult = {
  text: string;
  provider: string;
  model: string;
  raw?: unknown;
};
```

The first adapter should support OpenAI-compatible chat completion style APIs. Keeping `LLM_BASE_URL` configurable makes it possible to switch between OpenAI, DeepSeek, Qwen, or a local OpenAI-compatible gateway without changing UI code.

## 11. Prompt Composition

The backend builds the request in three parts:

### System Message

```text
你是 AI Skill Passport Demo 中的任务助手。
你的目标不是简单回答用户，而是严格应用用户选择的 Skill Cards。
如果习惯卡与本次任务冲突，以本次任务为准。
输出要明确体现已应用的语气、结构、风格和限制。
```

### Skill Context

Generated from selected cards:

```text
用户选择的 AI 使用习惯如下：

[Skill Card: Classroom Presentation]
应用模式：全部使用
适用场景：课程汇报、HCI 项目展示、课堂演示
语气偏好：正式但自然，不要过度营销
结构偏好：背景 -> 问题 -> 方案 -> 交互流程 -> HCI 价值 -> 总结
视觉偏好：每页一个核心观点，少长段文字，多流程与卡片
限制：避免空泛口号，必须能被课堂观众快速理解

[Skill Card: Minimal Visual Style]
应用模式：部分使用
视觉偏好：克制配色，清晰层级，避免过度装饰
```

### User Task

```text
用户本次任务：
帮我为 HCI 课程做一个 8 页项目展示 PPT 大纲，主题是 AI Skill Passport。
```

The prompt builder must preserve user control:

- Current task overrides long-term habit.
- Partial selection only includes selected fields.
- Temporary use does not update usage history unless generation succeeds.
- Saved card suggestions require user confirmation.

## 12. Habit Suggestion Logic

After generation, the backend asks the model to provide a short suggested habit update in structured JSON-like text, or the backend generates one deterministically from the selected cards and task.

For demo reliability, use deterministic suggestion first:

- If output succeeds, suggest a new card based on task type and selected habits.
- Example: "HCI Project Demo Outline".

Optional second pass:

- Ask the LLM to summarize reusable preferences from the completed output.
- Parse best-effort JSON.
- Fall back to deterministic suggestion on parse failure.

## 13. Error Handling

LLM call failure cases:

- missing API key
- invalid model
- network timeout
- provider rate limit
- malformed provider response

Required behavior:

- UI shows a clear error state.
- If `LLM_MOCK_FALLBACK=true`, backend returns a clearly marked fallback output.
- Fallback output must say it is fallback content, not a real model response.
- Context preview must still work without API key.
- API key is never logged.

## 14. Privacy and Control

The demo should communicate HCI design values:

- The user can inspect every habit before applying it.
- The user can choose full, partial, temporary, or no use.
- The user confirms before saving a suggested habit.
- Sharing creates a snapshot, not live access to the original private card.
- Imported cards become local user-owned copies.

No real personal data should be seeded in the demo.

## 15. Testing Requirements

### Unit-Level Checks

- Prompt builder includes all selected fields for `all` mode.
- Prompt builder includes only selected fields for `partial` mode.
- Prompt builder excludes unselected cards.
- Recommendation ranks seeded cards correctly for the demo task.
- Share import creates a new local card id.

### API Checks

- `GET /cards` returns seed cards.
- `POST /context/preview` returns deterministic context without LLM.
- `POST /generate` calls the LLM adapter when API config exists.
- `POST /generate` returns fallback only when fallback is enabled and the provider fails.
- `POST /share` creates a share snapshot.
- `POST /share/:id/import` imports a copy.

### Manual Demo Acceptance

The demo is acceptable when:

1. A user can open the card library locally.
2. A user can select Skill Cards for a task.
3. The app displays the exact model context.
4. The backend sends a real LLM request when credentials are configured.
5. The LLM output visibly follows the selected habits.
6. A new habit suggestion appears after generation.
7. The user can save the suggestion.
8. The user can generate a share link.
9. The share link preview can be imported or forked.
10. The demo still runs in fallback mode if the model provider fails.

## 16. Implementation Boundaries

Suggested folder structure:

```text
ai-skill-passport-demo/
  client/
    src/
      components/
      pages/
      api/
      types/
      styles/
  server/
    src/
      index.ts
      routes/
      services/
        cards.ts
        recommend.ts
        promptBuilder.ts
        llm/
          adapter.ts
          openaiCompatible.ts
          mockFallback.ts
      data/
        seedCards.json
        db.json
  .env.example
  package.json
  README.md
```

For the first working version, avoid over-abstracting. The only abstraction that matters is the LLM adapter, because it keeps the project from being locked to one provider.

## 17. Demo Script

1. Open dashboard.
2. Point out the Skill Card library.
3. Open "Classroom Presentation" and show editable habits.
4. Go to task composer.
5. Enter the HCI PPT outline task.
6. Show recommended cards.
7. Apply one card fully and one partially.
8. Open context preview and explain this is the habit block sent to the model.
9. Click generate.
10. Show real model response.
11. Save suggested card.
12. Generate share link.
13. Open share preview and import/fork.

## 18. Success Criteria

The project succeeds if the audience can answer these questions after seeing the demo:

- What is a Skill Card?
- How does a Skill Card affect the model?
- How does the user control whether a habit is applied?
- How can habits be reused across tasks?
- How can habits be shared and imported?
- Why is this different from just saving old prompts?

## 19. Default Implementation Decisions

These decisions are fixed for the MVP:

- Provider path: OpenAI-compatible adapter.
- Storage: JSON file.
- Generation: non-streaming request/response.
- UI style: app-like dashboard with visual language borrowed from the existing deck.
- API key handling: server-only `.env`; never expose keys to frontend code.
- Fallback: enabled by default for presentation stability, clearly labeled when used.

These can vary later without changing the core product design:

- Specific model name.
- Specific OpenAI-compatible provider.
- Whether to add streaming output.
- Whether to replace JSON storage with SQLite.
