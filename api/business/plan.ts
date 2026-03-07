// api/business/plan.ts — Claude-powered business plan generator
// Takes business info + financials, returns a structured business plan

import type { VercelRequest, VercelResponse } from '@vercel/node';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

export interface BusinessPlanInput {
  businessName: string;
  description: string;
  entityType: string;
  ein?: string;
  stateOfFormation?: string;
  members?: string;
  monthlyExpenses: number;
  annualRevenue: number;
  bankBalance: number;
  walletBalance: number;
  totalDistributions: number;
  totalContributions: number;
  expenseBreakdown: Array<{ name: string; amount: number; frequency: string }>;
  transactionCount: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { input, type }: { input: BusinessPlanInput; type: 'business_plan' | 'tax_strategy' | 'expense_optimization' } = req.body;

  if (!input || !type) return res.status(400).json({ error: 'Missing input or type' });
  if (!CLAUDE_API_KEY) return res.status(500).json({ error: 'Claude API key not configured' });

  try {
    const prompt = buildPrompt(input, type);

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Claude API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.content[0].text;

    return res.status(200).json({ content, type });
  } catch (error: any) {
    console.error('Business plan error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate' });
  }
}

function buildPrompt(b: BusinessPlanInput, type: string): string {
  const financials = `
BUSINESS: ${b.businessName}
DESCRIPTION: ${b.description}
ENTITY TYPE: ${b.entityType}
${b.stateOfFormation ? `STATE: ${b.stateOfFormation}` : ''}
${b.members ? `MEMBERS: ${b.members}` : ''}

FINANCIALS:
  Monthly Expenses: $${b.monthlyExpenses.toFixed(0)}/mo
  Annual Revenue (est): $${b.annualRevenue.toFixed(0)}/yr
  Bank Balance: $${b.bankBalance.toFixed(0)}
  Crypto Wallet: $${b.walletBalance.toFixed(0)}
  Total Distributions: $${b.totalDistributions.toFixed(0)}
  Total Contributions: $${b.totalContributions.toFixed(0)}
  Transaction Count: ${b.transactionCount}

EXPENSE BREAKDOWN:
${b.expenseBreakdown.map(e => `  - ${e.name}: $${e.amount} (${e.frequency})`).join('\n')}
`;

  if (type === 'business_plan') {
    return `You are a business consultant generating a professional business plan.

${financials}

Generate a comprehensive but concise business plan in clean markdown format. Include:

1. **Executive Summary** — 2-3 paragraphs about the business, its mission, and value proposition
2. **Business Model** — How the business generates revenue, key revenue streams
3. **Market Opportunity** — Target market, TAM/SAM/SOM estimates if applicable
4. **Operations** — Current operational structure, key tools/services used
5. **Financial Overview** — Based on the actual numbers provided above
6. **Growth Strategy** — Realistic next steps based on current scale
7. **Risk Assessment** — Key risks and mitigation strategies
8. **12-Month Goals** — 3-5 specific, measurable goals

Keep it practical and grounded in the actual financials. This is a small/solo business — don't write it like a Fortune 500 plan. Use the actual expense and revenue numbers.

Write in clean markdown. Use headers, bullets, and bold text for readability. Keep it under 1500 words.`;
  }

  if (type === 'tax_strategy') {
    return `You are a tax advisor for small businesses.

${financials}

Based on this business's structure and financials, provide tax strategy insights in clean markdown:

1. **Current Tax Situation** — What they're likely paying based on entity type and revenue
2. **Entity Optimization** — Would a different entity type (S-Corp election, etc.) save money? Show the math.
3. **Deduction Opportunities** — Common deductions they might be missing based on their expense categories
4. **Quarterly Estimates** — What they should be paying quarterly based on income
5. **Year-End Checklist** — Key actions before Dec 31
6. **Retirement Strategy** — Solo 401k, SEP-IRA, or other options based on their income level

Be specific with dollar amounts where possible. Note that this is informational only, not tax advice.

Write in clean markdown. Keep it under 1000 words.`;
  }

  // expense_optimization
  return `You are a business efficiency consultant.

${financials}

Analyze this business's expenses and provide optimization insights in clean markdown:

1. **Expense Analysis** — Break down where the money is going
2. **Cost Reduction Opportunities** — Specific suggestions to reduce expenses, with estimated savings
3. **Tool Alternatives** — Cheaper alternatives for current tools/services
4. **Scaling Considerations** — What costs will increase/decrease as the business grows
5. **Distribution Strategy** — Based on revenue vs expenses, optimal owner distribution schedule

Be specific: name actual tools, services, and dollar amounts.

Write in clean markdown. Keep it under 800 words.`;
}
