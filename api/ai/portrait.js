import { requireAiUnlock } from './_auth.js';
import { generatePortraitFromPrompt } from './_gemini.js';

function readJsonBody(req) {
  if (typeof req.body === 'string') {
    return JSON.parse(req.body);
  }
  return req.body ?? {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireAiUnlock(req)) {
    return res.status(401).json({ error: 'AI features are locked. Re-enter password.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  }

  let body;
  try {
    body = readJsonBody(req);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }

  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt.' });
  }

  try {
    const result = await generatePortraitFromPrompt(apiKey, prompt);
    return res.status(200).json({
      ok: true,
      model: result.model,
      url: result.url,
      thumbnail: result.thumbnail,
    });
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
