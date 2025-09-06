AI Profile Picture Stylizer — Agent Guide

Overview
- Purpose: Client-only web app that applies AI-driven styles to a user-provided image, producing a stylized profile picture.
- Stack: React + Vite + Tailwind (CDN). No server. All API calls occur from the browser.
- Providers: Google Gemini (via @google/genai) or OpenRouter (Images API), targeting the same Gemini image generation model.

Key Paths
- `App.tsx`: Main UI logic, tabs (Stylizer/History), Settings modal, provider selection, and request flow.
- `services/geminiService.ts`: Google Gemini image generation request (runtime key required).
- `services/openrouterService.ts`: OpenRouter Images API client; returns base64 image.
- `services/keyStore.ts`: Client-side key storage and encryption (AES-GCM via Web Crypto with PBKDF2 derivation).
- `constants.ts`: Predefined style themes.
- `index.html`, `index.tsx`, `vite.config.ts`: Vite entry and minimal config.

Runtime Configuration
- All secrets are input by the user in the Settings modal; no build-time env is required.
- Provider can be toggled between `google` and `openrouter`.
- Keys are validated:
  - Google: lightweight format check (length-based). Agents may optionally add a ping-call if desired.
  - OpenRouter: requests `GET https://openrouter.ai/api/v1/models` (requires Authorization) and checks `res.ok`.

Request Flow
1. User uploads an image; `fileToBase64` reads it into a data URL.
2. `extractBase64` splits data URL to `{ data, mimeType }`.
3. On generate:
   - If provider is `google`, call `stylizeWithGemini(data, mimeType, prompt, apiKey)`.
   - If provider is `openrouter`, call `stylizeImageOpenRouter(data, mimeType, prompt, { apiKey })`.
4. Response is expected as base64; UI composes a `data:image/png;base64,...` URL for preview and download.

OpenRouter Notes
- Endpoint: `POST https://openrouter.ai/api/v1/images` with `Authorization: Bearer <KEY>` and `X-Title` header.
- Body: multipart/form-data with fields `model`, `prompt`, and an image file (we append both `image` and `image[]` defensively).
- Response shapes may vary; handler checks for common patterns (`data[0].b64_json`, `images[0].b64_json`, `output`).

Security Model
- Client-only application. Keys are never sent to a backend you control unless the provider requires it.
- Users can specify an optional passphrase; keys are then AES‑GCM encrypted in localStorage. Without a passphrase, keys are session-only in memory.
- Agents should not add any server components or telemetry unless explicitly requested.

UX Notes
- Glassmorphism: Tailwind classes use `bg-white/5`, `border-white/10`, `backdrop-blur-xl`, subtle shadows.
- Settings shows a green/red/gray dot next to each key based on basic validation.

Extending
- Add more providers by creating a new service module with a `stylizeImage` signature returning base64.
- Wire into `App.tsx` provider selector; persist provider via `keyStore.setProvider`.
- Consider adding throttling, retries, and safety-messaging if provider blocks content.

