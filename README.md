# AI Profile Picture Stylizer

Glassy, lightweight web app to restyle a profile photo with AI themes. Supports Google Gemini and OpenRouter (same Gemini image model via OpenRouter).

Note on pricing: On Sept 6–7, 2025, Google made Gemini image gen free for that weekend. Outside that window, usage typically requires billing.

## Features

- Glassmorphism UI with drag-and-drop image upload
- One‑click styles and custom theme prompts
- History gallery with downloads
- Settings pane to add API keys, choose provider, and encrypted storage
- Key validity indicators (green dot when validated)
 - Encrypted local persistence for keys, history, and usage (with passphrase)
 - Estimated cost pill (prompt tokens only) using $0.30/M in, $2.50/M out

## Getting Started

Prerequisites: Node.js 18+ recommended.

1) Install dependencies

- `npm install`

2) Run the dev server

- `npm run dev`

3) Open the app

- Visit the local URL shown by Vite

4) Add your API key(s) in Settings

- Google Gemini key: https://aistudio.google.com/app/apikey
  - Weekend promo: Free on Sept 6–7, 2025; otherwise paid
- OpenRouter key (optional): https://openrouter.ai/keys
  - Uses the same Gemini image model via OpenRouter

5) (Optional) Set an encryption passphrase

- When set, your keys are AES‑GCM encrypted at rest in `localStorage`
- Without a passphrase, keys live only in-memory for the current session

## Providers

- Google Gemini: Uses `@google/genai` and the `gemini-2.5-flash-image-preview` model
- OpenRouter: Calls OpenRouter Images API and forces the same model: `google/gemini-2.5-flash-image-preview`

Switch provider anytime from the Settings pane.

## Deploy on Cloudflare Pages

This is a static Vite app and works well on Cloudflare Pages.

- Build command: `npm run build`
- Build output directory: `dist`

Steps:
- Push this repository to GitHub
- In Cloudflare Pages, create a new project from your GitHub repo
- Set build command and output directory as above
- Deploy (no server-side secrets are required)

## Notes on Security

- This is a browser-only app; API keys are used client-side
- For best safety, use a dedicated key with least privileges and quotas
- Use the passphrase option to encrypt keys, history, and usage at rest in `localStorage`

## Cost Estimation

- Pricing used: $0.30 per 1M input tokens, $2.50 per 1M output tokens (as provided).
- Estimator counts prompt tokens only (~4 chars ≈ 1 token) and assumes 0 output tokens for image generation.
- Display is an approximation meant for awareness, not billing.

## License

MIT
