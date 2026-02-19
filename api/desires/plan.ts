// api/desires/plan.ts — Vercel Edge Function
// Claude sees the user's FULL financial picture and generates an executable action plan

import type { VercelRequest, VercelResponse } from '@vercel/node';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || ''; // server-side only, never exposed
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

export interface ActionStep {
  id: string;
  order: number;
  type: 'swap' | 'dca' | 'deposit' | 'reduce_expense' | 'set_stoploss' | 'adjust_401k' | 'info';
  title: string;
  description: string;
  urgency: 'now' | 'this_week' | 'this_month' | 'ongoing';
  executable: boolean; // can we do this on-chain?
  execution?: {
    action: 'jupiter_swap' | 'perena_deposit' | 'dca_setup' | 'navigate' | 'none';
    params?: {
      fromToken?: string;  // symbol or mint
      toToken?: string;
      amount?: number;
      frequency?: string;  // for DCA
      targetScreen?: string; // for navigation
    };
  };
  impact?: string; // e.g., "Earns $182/mo in yield"
}

export interface ActionPlan {
  desire: string;
  estimatedCost: number;
  productRecommendation: string;
  summary: string;
  currentFreedomDays: number;
  freedomAfterPurchase: number;
  canAffordNow: boolean;
  timelineMonths: number; // months to save if can't afford
  riskWarnings: string[];
  steps: ActionStep[];
  alternativePlan?: string; // cheaper alternative if desire is unrealistic
}

export interface FinancialSnapshot {
  // Freedom
  freedomDays: number;
  freedomState: string;

  // Income
  totalMonthlyIncome: number;
  tradingMonthly: number;
  tradingPercent: number;
  paycheckMonthly: number;
  assetIncomeMonthly: number;

  // Outflow
  totalMonthlyObligations: number;
  totalMonthlyDebtPayments: number;
  monthlySurplus: number;

  // Assets
  totalLiquidAssets: number;
  totalBankBalance: number;
  usdStarBalance: number;
  cryptoHoldings: Array<{ symbol: string; value: number }>;

  // Retirement
  has401k: boolean;
  monthly401k: number;
  percent401k: number;
  grossPay: number;

  // Risk
  tradingRiskActive: boolean; // trading > 20% && would cause deficit
  shortfallWithoutTrading: number;

  // Existing desires
  existingDesires: Array<{ name: string; cost: number }>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { desire, snapshot }: { desire: string; snapshot: FinancialSnapshot } = req.body;

  if (!desire || !snapshot) {
    return res.status(400).json({ error: 'Missing desire or financial snapshot' });
  }

  if (!CLAUDE_API_KEY) {
    return res.status(500).json({ error: 'Claude API key not configured' });
  }

  try {
    const prompt = buildPrompt(desire, snapshot);

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Claude API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.content[0].text;

    // Parse JSON response
    let plan: ActionPlan;
    try {
      plan = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        plan = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        throw new Error('Failed to parse Claude response');
      }
    }

    // Validate and enrich steps with IDs
    plan.steps = (plan.steps || []).map((step, i) => ({
      ...step,
      id: `step-${i}`,
      order: i + 1,
    }));

    return res.status(200).json(plan);
  } catch (error: any) {
    console.error('Desire plan error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate plan' });
  }
}

function buildPrompt(desire: string, s: FinancialSnapshot): string {
  return `You are KingMe's autonomous financial agent. You don't just advise — you BUILD EXECUTABLE PLANS.

The user wants something. Your job is to:
1. Research what they want and recommend a specific product/price
2. Analyze their COMPLETE financial picture
3. Identify risks that need addressing BEFORE spending
4. Generate a step-by-step action plan where EACH STEP can be executed on-chain

═══════════════════════════════════════════
USER'S COMPLETE FINANCIAL PICTURE
═══════════════════════════════════════════

FREEDOM SCORE: ${s.freedomDays} days (${s.freedomState})

MONTHLY INCOME:
  Total:      $${s.totalMonthlyIncome.toFixed(0)}/mo
  Paycheck:   $${s.paycheckMonthly.toFixed(0)}/mo
  Trading:    $${s.tradingMonthly.toFixed(0)}/mo (${s.tradingPercent.toFixed(0)}% of income)
  Assets:     $${s.assetIncomeMonthly.toFixed(0)}/mo

MONTHLY OUTFLOW:
  Obligations:  $${s.totalMonthlyObligations.toFixed(0)}/mo
  Debt payments: $${s.totalMonthlyDebtPayments.toFixed(0)}/mo
  Surplus:       $${s.monthlySurplus.toFixed(0)}/mo

RETIREMENT:
  ${s.has401k ? `401k contribution: ${s.percent401k.toFixed(1)}% ($${s.monthly401k.toFixed(0)}/mo) of $${s.grossPay.toFixed(0)}/mo gross` : 'No 401k tracked'}

LIQUID ASSETS:
  Bank accounts: $${s.totalBankBalance.toFixed(0)}
  Total liquid:  $${s.totalLiquidAssets.toFixed(0)}
  USD* (Perena): $${s.usdStarBalance.toFixed(0)} (earns 9.34% APY)
  Crypto: ${s.cryptoHoldings.length > 0 ? s.cryptoHoldings.map(h => `${h.symbol}: $${h.value.toFixed(0)}`).join(', ') : 'None tracked'}

RISK FLAGS:
  ${s.tradingRiskActive ? `⚠️ TRADING RISK: Trading is ${s.tradingPercent.toFixed(0)}% of income. Without it, $${s.shortfallWithoutTrading.toFixed(0)}/mo deficit.` : '✅ No trading income risk'}
  ${s.usdStarBalance < s.totalMonthlyObligations * 3 ? `⚠️ NO SAFETY BUFFER: Need $${(s.totalMonthlyObligations * 3).toFixed(0)} in USD* (3mo obligations). Have $${s.usdStarBalance.toFixed(0)}.` : `✅ Safety buffer: $${s.usdStarBalance.toFixed(0)} in USD*`}

EXISTING DESIRES:
  ${s.existingDesires.length > 0 ? s.existingDesires.map(d => `- ${d.name}: $${d.cost.toLocaleString()}`).join('\n  ') : 'None'}

═══════════════════════════════════════════
USER WANTS: "${desire}"
═══════════════════════════════════════════

AVAILABLE ON-CHAIN ACTIONS (use these in your steps):
- "jupiter_swap": Swap any token via Jupiter (e.g., USDC → USD*, SOL → USDC)
- "perena_deposit": Deposit USDC into Perena USD* for 9.34% APY
- "dca_setup": Set up recurring swap on Jupiter (weekly/monthly DCA)
- "navigate": Point user to a screen in the app (e.g., obligations, income)
- "none": Informational step (set stop losses manually, etc.)

RULES:
- If they have a trading risk flag, the FIRST step must address safety (buffer/stop-losses)
- If USD* buffer is below 3 months of obligations, include a step to build it
- Be specific: real product names, real prices, exact dollar amounts
- Every financial step should be executable where possible
- Timeline must be realistic based on their actual surplus
- If the desire costs more than 6 months of surplus, suggest a cheaper alternative too
- Keep steps to 3-6 maximum. Don't overwhelm.
- For PHYSICAL PURCHASES (electronics, appliances, cars, furniture, etc.): do NOT generate a token swap to "buy" it. Instead, generate an "info" step that says "Set aside $X from your bank account" or "Withdraw $X USDC to your bank." The user buys physical goods off-chain.
- Only generate jupiter_swap or perena_deposit actions for actual on-chain moves (building buffers, DCA into yield, rebalancing crypto positions).
- Never generate a swap where fromToken and toToken are the same (e.g., USDC → USDC).

Respond with ONLY valid JSON matching this TypeScript interface:

interface ActionPlan {
  desire: string;              // what they asked for
  estimatedCost: number;       // realistic price
  productRecommendation: string; // specific product name
  summary: string;             // 1-2 sentence description
  currentFreedomDays: number;  // echo back
  freedomAfterPurchase: number; // calculated
  canAffordNow: boolean;       // can they buy without going negative?
  timelineMonths: number;      // months to save at current surplus (0 if can afford now)
  riskWarnings: string[];      // critical warnings
  steps: ActionStep[];         // the executable plan
  alternativePlan?: string;    // cheaper path if needed
}

interface ActionStep {
  type: "swap" | "dca" | "deposit" | "reduce_expense" | "set_stoploss" | "adjust_401k" | "info";
  title: string;               // short action title
  description: string;         // 1-2 sentences
  urgency: "now" | "this_week" | "this_month" | "ongoing";
  executable: boolean;
  execution?: {
    action: "jupiter_swap" | "perena_deposit" | "dca_setup" | "navigate" | "none";
    params?: {
      fromToken?: string;
      toToken?: string;
      amount?: number;
      frequency?: string;
      targetScreen?: string;
    };
  };
  impact?: string;
}

Return ONLY the JSON. No markdown, no backticks, no explanation.`;
}
