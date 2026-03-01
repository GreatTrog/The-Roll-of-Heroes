import crypto from 'node:crypto';

const COOKIE_NAME = 'ai_unlock';
const DEFAULT_UNLOCK_SECONDS = 30 * 60;

function getSecret() {
  const secret = process.env.AI_FEATURE_PASSWORD;
  if (!secret) {
    throw new Error('AI_FEATURE_PASSWORD is not configured on the server.');
  }
  return secret;
}

function signExpiry(expiryMs) {
  const hmac = crypto.createHmac('sha256', getSecret());
  hmac.update(String(expiryMs));
  return hmac.digest('hex');
}

function timingSafeEqual(a, b) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function serializeCookie(name, value, maxAgeSeconds, secure) {
  const parts = [
    `${name}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function parseCookies(req) {
  const header = req.headers?.cookie;
  if (!header) return {};
  return header.split(';').reduce((acc, part) => {
    const [rawKey, ...rest] = part.trim().split('=');
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

export function issueAiUnlockCookie(res, req, unlockForSeconds = DEFAULT_UNLOCK_SECONDS) {
  const expiresAt = Date.now() + unlockForSeconds * 1000;
  const token = `${expiresAt}.${signExpiry(expiresAt)}`;
  const forwardedProto = req.headers['x-forwarded-proto'];
  const secure = process.env.NODE_ENV === 'production' || forwardedProto === 'https';
  res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, token, unlockForSeconds, secure));
  return { unlockForSeconds, expiresAt };
}

export function clearAiUnlockCookie(res) {
  res.setHeader('Set-Cookie', serializeCookie(COOKIE_NAME, '', 0, false));
}

export function requireAiUnlock(req) {
  const cookies = parseCookies(req);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return false;

  const [expiryRaw, signature] = raw.split('.');
  const expiryMs = Number(expiryRaw);
  if (!Number.isFinite(expiryMs) || !signature) return false;
  if (expiryMs <= Date.now()) return false;

  const expected = signExpiry(expiryMs);
  return timingSafeEqual(signature, expected);
}
