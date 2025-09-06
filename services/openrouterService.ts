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

  // First try multipart/form-data (some providers proxy OpenAI's shape)
  try {
    const binary = atob(base64ImageData);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const imgBlob = new Blob([bytes], { type: mimeType || 'image/png' });
  
    const form = new FormData();
    form.append('model', model);
    form.append('prompt', prompt);
    form.append('image', imgBlob, 'input-image');
    form.append('image[]', imgBlob, 'input-image');
  
    const res = await fetch('https://openrouter.ai/api/v1/images', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'X-Title': 'AI Profile Picture Stylizer',
        'X-OpenRouter-Title': 'AI Profile Picture Stylizer',
      },
      body: form,
    });
  
    if (res.ok) {
      const data = await res.json();
      const candidate1 = data?.data?.[0]?.b64_json as string | undefined;
      if (candidate1) return candidate1;
      const candidate2 = data?.images?.[0]?.b64_json as string | undefined;
      if (candidate2) return candidate2;
      const candidate3 = data?.output as string | undefined;
      if (candidate3) return candidate3;
      throw new Error('OpenRouter did not return an image. Please try a different prompt or image.');
    }

    // Some deployments respond 405/415 to multipart; fall through to JSON
    if (res.status !== 405 && res.status !== 415 && res.status !== 400) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenRouter request failed: ${res.status} ${res.statusText} ${text}`);
    }
  } catch (e) {
    // Network errors: try JSON next
  }

  // Fallback: JSON body with data URL (some proxies accept this)
  const dataUrl = `data:${mimeType || 'image/png'};base64,${base64ImageData}`;
  const res2 = await fetch('https://openrouter.ai/api/v1/images', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'AI Profile Picture Stylizer',
      'X-OpenRouter-Title': 'AI Profile Picture Stylizer',
    },
    body: JSON.stringify({ model, prompt, image: dataUrl, images: [dataUrl] }),
  });

  if (!res2.ok) {
    let msg = '';
    try { msg = await res2.text(); } catch {}
    throw new Error(`OpenRouter request failed (json): ${res2.status} ${res2.statusText} ${msg}`);
  }

  const j = await res2.json();
  const candidate1b = j?.data?.[0]?.b64_json as string | undefined;
  if (candidate1b) return candidate1b;
  const candidate2b = j?.images?.[0]?.b64_json as string | undefined;
  if (candidate2b) return candidate2b;
  const candidate3b = j?.output as string | undefined;
  if (candidate3b) return candidate3b;
  throw new Error('OpenRouter did not return an image (json). Please try a different prompt or image.');
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
