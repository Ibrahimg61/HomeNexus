import crypto from 'crypto';

export function hasValidApiKey(request: Request) {
  const configuredKey = process.env.HOMENEXUS_API_KEY;
  const authorization = request.headers.get('authorization');

  if (!configuredKey || !authorization?.startsWith('Bearer ')) {
    return false;
  }

  const providedKey = authorization.slice('Bearer '.length);
  const expected = Buffer.from(configuredKey);
  const provided = Buffer.from(providedKey);

  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}