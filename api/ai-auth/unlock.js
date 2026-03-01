import { issueAiUnlockCookie } from '../ai/_auth.js';

const DEFAULT_UNLOCK_SECONDS = 30 * 60;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expectedPassword = process.env.AI_FEATURE_PASSWORD;
  if (!expectedPassword) {
    return res.status(500).json({ error: 'AI_FEATURE_PASSWORD is not configured on the server.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body.' });
    }
  }

  const provided = typeof body?.password === 'string' ? body.password : '';
  if (!provided) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  if (provided !== expectedPassword) {
    return res.status(401).json({ error: 'Invalid password.' });
  }

  const unlock = issueAiUnlockCookie(res, req, DEFAULT_UNLOCK_SECONDS);

  return res.status(200).json({
    ok: true,
    unlockForSeconds: unlock.unlockForSeconds,
  });
}
