// api/rpc/send.ts — Solana RPC proxy for sendRawTransaction
// Forwards signed transactions to Helius RPC (key stays server-side)
// Public RPC rate-limits / 403s on sendRawTransaction from browsers

export const config = { runtime: 'edge' };

const HELIUS_API_KEY = process.env.HELIUS_API_KEY!;
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  }

  try {
    const body = await req.json();

    // Only allow sendRawTransaction and getLatestBlockhash — don't proxy everything
    const allowed = ['sendRawTransaction', 'sendTransaction', 'getLatestBlockhash', 'confirmTransaction', 'getSignatureStatuses'];
    if (!allowed.includes(body.method)) {
      return new Response(JSON.stringify({ error: `Method ${body.method} not allowed` }), { status: 403 });
    }

    const res = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 502 });
  }
}
