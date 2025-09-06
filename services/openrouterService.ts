// Minimal OpenRouter Images API client. Attempts image-to-image generation.
// Docs: https://openrouter.ai/docs (Images endpoint)

export interface OpenRouterOptions {
  apiKey: string;
}

export const OPENROUTER_MODEL = 'google/gemini-2.5-flash-image-preview';
export function getOpenRouterModelId() { return OPENROUTER_MODEL; }

// Tries to stylize an image using OpenRouter's images endpoint.
// Returns base64-encoded PNG.
export async function stylizeImageOpenRouter(
  base64ImageData: string,
  mimeType: string,
  prompt: string,
  opts: OpenRouterOptions
): Promise<string> {
  if (!opts.apiKey) throw new Error('Missing OpenRouter API key. Please add it in Settings.');

  const model = OPENROUTER_MODEL;

  // Convert base64 string to Blob so we can send multipart/form-data
  const binary = atob(base64ImageData);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const imgBlob = new Blob([bytes], { type: mimeType || 'image/png' });

  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  // Some backends expect field name `image` or `image[]`; attach both defensively
  form.append('image', imgBlob, 'input-image');
  form.append('image[]', imgBlob, 'input-image');

  const res = await fetch('https://openrouter.ai/api/v1/images', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'X-Title': 'AI Profile Picture Stylizer',
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenRouter request failed: ${res.status} ${res.statusText} ${text}`);
  }

  const data = await res.json();
  // Try common shapes
  // 1) { data: [{ b64_json: "..." }] }
  const candidate1 = data?.data?.[0]?.b64_json as string | undefined;
  if (candidate1) return candidate1;

  // 2) { images: [{ b64_json: "..." }] }
  const candidate2 = data?.images?.[0]?.b64_json as string | undefined;
  if (candidate2) return candidate2;

  // 3) { output: "...base64..." }
  const candidate3 = data?.output as string | undefined;
  if (candidate3) return candidate3;

  throw new Error('OpenRouter did not return an image. Please try a different prompt or image.');
}

export async function validateOpenRouterKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
