// OpenRouter client using Gemini 2.5 Flash Image Preview for image generation.
// Docs: https://openrouter.ai/docs

export interface OpenRouterOptions {
  apiKey: string;
}

export const OPENROUTER_MODEL = 'google/gemini-2.5-flash-image-preview';
export function getOpenRouterModelId() { return OPENROUTER_MODEL; }

// Stylizes an image using OpenRouter's chat completions endpoint with Gemini image generation.
// Returns base64-encoded PNG.
export async function stylizeImageOpenRouter(
  base64ImageData: string,
  mimeType: string,
  prompt: string,
  opts: OpenRouterOptions
): Promise<string> {
  if (!opts.apiKey) throw new Error('Missing OpenRouter API key. Please add it in Settings.');

  const model = OPENROUTER_MODEL;

  // Create a prompt that includes the image reference and styling instructions
  const dataUrl = `data:${mimeType || 'image/png'};base64,${base64ImageData}`;
  const fullPrompt = `Create a stylized version of the provided image with this style: ${prompt}. Generate a new image that applies the requested styling while maintaining the subject and composition of the original image.`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'AI Profile Picture Stylizer',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: fullPrompt
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl
              }
            }
          ]
        }
      ],
      modalities: ['image', 'text'],
      max_tokens: 4000
    }),
  });

  if (!res.ok) {
    let msg = '';
    try { 
      const errorData = await res.json();
      msg = errorData.error?.message || JSON.stringify(errorData);
    } catch {
      msg = await res.text().catch(() => '');
    }
    throw new Error(`OpenRouter request failed: ${res.status} ${res.statusText} - ${msg}`);
  }

  const data = await res.json();
  
  // Check for generated images in the response
  const message = data.choices?.[0]?.message;
  if (!message) {
    throw new Error('OpenRouter did not return a valid response.');
  }

  // Look for images in the message
  const images = message.images;
  if (images && images.length > 0) {
    const imageUrl = images[0].image_url?.url;
    if (imageUrl && imageUrl.startsWith('data:image/')) {
      // Extract base64 data from data URL
      const base64Match = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (base64Match) {
        return base64Match[1];
      }
    }
  }

  throw new Error('OpenRouter did not return a generated image. Please try a different prompt or image.');
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
