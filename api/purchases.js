// api/purchases.js — Get/store add-on purchases per wallet in Upstash Redis
// GET: returns all purchased addon IDs for the authenticated wallet
// POST: records a new purchase (called after on-chain verification)

import { verifyRequest } from './_verify.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const auth = verifyRequest(req, res);
  if (!auth) return;

  const { wallet } = auth;

  const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return res.status(500).json({ error: 'Missing Upstash credentials' });
  }

  const key = `purchases:${wallet}`;

  if (req.method === 'POST') {
    // Record a new purchase
    const { addonId, signature, amount } = req.body;

    if (!addonId || !signature) {
      return res.status(400).json({ error: 'Missing addonId or signature' });
    }

    try {
      // Get existing purchases
      const getRes = await fetch(`${UPSTASH_URL}/get/${key}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      });
      const { result } = await getRes.json();
      const purchases = result ? JSON.parse(decodeURIComponent(result)) : [];

      // Don't duplicate
      if (purchases.some((p) => p.addonId === addonId)) {
        return res.status(200).json({ success: true, message: 'Already purchased' });
      }

      purchases.push({
        addonId,
        signature,
        amount: amount || 0,
        purchasedAt: new Date().toISOString(),
      });

      await fetch(`${UPSTASH_URL}/set/${key}/${encodeURIComponent(JSON.stringify(purchases))}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      });

      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET — return purchased addon IDs
  try {
    const r = await fetch(`${UPSTASH_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    const { result } = await r.json();
    const purchases = result ? JSON.parse(decodeURIComponent(result)) : [];
    return res.status(200).json({ purchases });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
