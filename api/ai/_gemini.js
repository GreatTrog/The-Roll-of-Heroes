const TEXT_MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-2.0-flash-001'];
const IMAGE_MODEL_CANDIDATES = [
  'gemini-3.1-flash-image-preview',
  'gemini-2.5-flash-image-preview',
  'gemini-2.0-flash-preview-image-generation',
];

function parseApiError(bodyText) {
  try {
    const parsed = JSON.parse(bodyText);
    return {
      code: parsed?.error?.code,
      message: parsed?.error?.message ?? bodyText,
    };
  } catch {
    return { message: bodyText };
  }
}

async function callGenerateContent(apiKey, models, body) {
  let lastError = 'Unknown Gemini error.';

  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (response.ok) {
      return { model, data: await response.json() };
    }

    const bodyText = await response.text();
    const parsed = parseApiError(bodyText);
    lastError = `Model ${model} failed (${response.status}): ${parsed.message}`;
    const modelUnavailable = response.status === 404 || String(parsed.message).toLowerCase().includes('no longer available');

    if (!modelUnavailable) break;
  }

  throw new Error(lastError);
}

function extractFirstTextPart(response) {
  const text = response?.candidates?.[0]?.content?.parts?.find((part) => typeof part?.text === 'string')?.text;
  if (!text) throw new Error('Gemini response missing text content.');
  return text;
}

function extractJsonObject(raw) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model did not return JSON.');
  }
  return raw.slice(start, end + 1);
}

function extractInlineImageDataUrl(response) {
  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  const withImage = parts.find((part) => part?.inlineData?.data);
  if (!withImage?.inlineData?.data) return undefined;
  const mime = withImage.inlineData.mimeType || 'image/png';
  return `data:${mime};base64,${withImage.inlineData.data}`;
}

export async function generateBackstoryFromPrompt(apiKey, prompt) {
  const { model, data } = await callGenerateContent(apiKey, TEXT_MODEL_CANDIDATES, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.8,
      responseMimeType: 'application/json',
    },
  });

  const text = extractFirstTextPart(data);
  return {
    model,
    backstory: JSON.parse(extractJsonObject(text)),
  };
}

export async function generatePortraitFromPrompt(apiKey, prompt) {
  const { model, data } = await callGenerateContent(apiKey, IMAGE_MODEL_CANDIDATES, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  const imageUrl = extractInlineImageDataUrl(data);
  return {
    model,
    url: imageUrl,
    thumbnail: imageUrl,
  };
}
