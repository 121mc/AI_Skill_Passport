# AI Skill Passport Local Demo

AI Skill Passport is a local full-stack demo for making AI work habits visible and reusable. You can manage Skill Cards, choose whether to apply each card in full, partially, temporarily, or not at all, preview the exact model context, generate through an OpenAI-compatible backend adapter, save a suggested habit, share snapshots, and import or fork shared cards.

## Run Locally

```sh
npm install
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:8787/api`

## LLM Configuration

Copy `.env.example` to `.env`, then configure the server-side LLM adapter:

```env
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=your_server_side_key
LLM_MODEL=your_model_name
LLM_TIMEOUT_MS=30000
LLM_MOCK_FALLBACK=true
```

The browser never receives `LLM_API_KEY`. If the provider is missing or fails and `LLM_MOCK_FALLBACK=true`, fallback output is clearly marked.

## Demo Script

1. Open dashboard and show Skill Card library.
2. Open `Classroom Presentation` and show editable habit fields.
3. Go to `/task`.
4. Use the default HCI PPT task.
5. Show `Classroom Presentation` and `Minimal Visual Style` recommendations.
6. Apply all of `Classroom Presentation` and selected fields from `Minimal Visual Style`.
7. Click `Preview Context` and show exact habit block.
8. Click `Generate`.
9. Show real model output or clearly marked fallback content.
10. Save suggested `HCI Project Demo Outline` card.
11. Generate a share link from dashboard.
12. Open share preview and import or fork the card.

## Verification

```sh
npm run test
npm run typecheck
npm run build
```

Manual acceptance covers card ownership, user-controlled application, backend context composition, LLM or fallback generation, habit suggestion, sharing, importing, and timeline history.
