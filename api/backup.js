import { verifyRequest } from './_verify.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

  const key = `backup:${wallet}`;

  if (req.method === 'POST') {
    const { data } = req.body;

    try {
      // Use POST body instead of URL path to support large backups (2MB+)
      const r = await fetch(`${UPSTASH_URL}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['SET', key, data]),
      });
      const result = await r.json();
      if (result.error) throw new Error(result.error);
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET
  try {
    const r = await fetch(`${UPSTASH_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    const { result } = await r.json();
    return res.status(200).json({ data: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
