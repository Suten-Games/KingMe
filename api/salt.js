import crypto from 'crypto';
import { verifyRequest } from './_verify.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify wallet ownership
  const auth = verifyRequest(req, res);
  if (!auth) return; // response already sent

  const { wallet } = auth;

  const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return res.status(500).json({ error: 'Missing Upstash credentials' });
  }

  const key = `salt:kingme:${wallet}`;

  try {
    // Check if salt already exists
    const getRes = await fetch(`${UPSTASH_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    const { result } = await getRes.json();

    if (result) {
      return res.status(200).json({ salt: result });
    }

    // Generate new random salt (64 hex chars = 32 bytes)
    const salt = crypto.randomBytes(32).toString('hex');

    // Store it permanently
    await fetch(`${UPSTASH_URL}/set/${key}/${encodeURIComponent(salt)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });

    return res.status(200).json({ salt });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
