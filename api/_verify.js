// Shared signature verification for API routes.
// Verifies that the caller owns the wallet by checking an ed25519 signature.

import nacl from 'tweetnacl';
import bs58 from 'bs58';

const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes — reject stale signatures

/**
 * Verifies a wallet signature from the request.
 * Expects query params: wallet, signature, timestamp
 * The signed message must be: "kingme:<wallet>:<timestamp>"
 *
 * Returns { wallet } on success, or sends an error response and returns null.
 */
export function verifyRequest(req, res) {
  const { wallet, signature, timestamp } = req.query;

  if (!wallet || !signature || !timestamp) {
    res.status(401).json({ error: 'Missing wallet, signature, or timestamp' });
    return null;
  }

  // Check timestamp freshness (replay protection)
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(Date.now() - ts) > MAX_AGE_MS) {
    res.status(401).json({ error: 'Signature expired' });
    return null;
  }

  // Reconstruct the message the client should have signed
  const message = `kingme:${wallet}:${timestamp}`;
  const messageBytes = new TextEncoder().encode(message);

  // Decode the wallet public key and signature from base58
  let publicKeyBytes;
  let signatureBytes;
  try {
    publicKeyBytes = bs58.decode(wallet);
    signatureBytes = bs58.decode(signature);
  } catch {
    res.status(401).json({ error: 'Invalid wallet or signature encoding' });
    return null;
  }

  if (publicKeyBytes.length !== 32 || signatureBytes.length !== 64) {
    res.status(401).json({ error: 'Invalid key or signature length' });
    return null;
  }

  // Verify ed25519 signature
  const valid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  if (!valid) {
    res.status(401).json({ error: 'Invalid signature' });
    return null;
  }

  return { wallet };
}
