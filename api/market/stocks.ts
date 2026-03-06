// api/market/stocks.ts — Yahoo Finance proxy (avoids CORS on web)
// GET /api/market/stocks?symbols=AAPL,MSFT

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const symbols = url.searchParams.get('symbols');

  if (!symbols) {
    return new Response(JSON.stringify({ error: 'Missing symbols param' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
    const res = await fetch(yahooUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KingMe/1.0)' },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Yahoo ${res.status}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const results = data?.quoteResponse?.result || [];

    // Return just ticker→price map (minimal payload)
    const prices: Record<string, number> = {};
    for (const quote of results) {
      const price = quote.regularMarketPrice;
      if (quote.symbol && typeof price === 'number' && price > 0) {
        prices[quote.symbol.toUpperCase()] = price;
      }
    }

    return new Response(JSON.stringify({ prices }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
