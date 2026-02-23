// // src/services/claude.ts
// import type { FreedomResult } from '../types';

// const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_CLAUDE_API_KEY || '';
// const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

// interface DesireResearchResult {
//   productName: string;
//   recommendedPrice: number;
//   summary: string;
//   recommendation: string;
//   impactDays: number;
//   impactChange: number;
//   alternatives?: Array<{
//     name: string;
//     price: number;
//     reason: string;
//   }>;
// }

// /**
//  * Research a desire using Claude API
//  */
// export async function researchDesire(
//   desireDescription: string,
//   currentFreedom: FreedomResult
// ): Promise<DesireResearchResult> {
//   if (!CLAUDE_API_KEY) {
//     throw new Error('Claude API key not configured. Add EXPO_PUBLIC_CLAUDE_API_KEY to your .env file.');
//   }

//   try {
//     const prompt = `You are a financial advisor helping someone make a smart purchase decision.

// USER'S CURRENT SITUATION:
// - Days of freedom: ${currentFreedom.days}
// - Daily asset income: $${(currentFreedom.dailyAssetIncome * 365).toFixed(2)}/year
// - Daily needs (obligations): $${(currentFreedom.dailyNeeds * 365).toFixed(2)}/year
// - Current state: ${currentFreedom.state}

// USER WANTS: "${desireDescription}"

// Your task:
// 1. Research and recommend a specific product/service
// 2. Provide a realistic price estimate
// 3. Calculate the impact on their freedom score
// 4. Give advice on timing (buy now vs. wait)

// Respond ONLY with valid JSON in this exact format (no markdown, no backticks):
// {
//   "productName": "Specific product recommendation",
//   "recommendedPrice": 850,
//   "summary": "Brief description of the product and why it's a good choice",
//   "recommendation": "Your advice on when to buy and why. Be specific about timing and financial impact.",
//   "impactDays": ${Math.max(0, currentFreedom.days - 30)},
//   "impactChange": -30
// }

// The impactDays should be current days minus the cost impact. The impactChange is the difference.

// Be realistic about prices. Consider:
// - If they want a "dishwasher", recommend something specific like "Bosch 300 Series" at $850
// - If they want a "vacation", estimate based on typical costs like "5-day Hawaii trip" at $3000
// - If they want a "gaming laptop", be specific like "ASUS ROG Zephyrus G14" at $1600

// Keep summary under 100 words. Keep recommendation under 150 words.`;

//     const response = await fetch(CLAUDE_API_URL, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'x-api-key': CLAUDE_API_KEY,
//         'anthropic-version': '2023-06-01',
//       },
//       body: JSON.stringify({
//         model: 'claude-sonnet-4-20250514',
//         max_tokens: 1000,
//         messages: [
//           {
//             role: 'user',
//             content: prompt,
//           },
//         ],
//       }),
//     });

//     if (!response.ok) {
//       const errorData = await response.json();
//       throw new Error(`Claude API error: ${errorData.error?.message || response.statusText}`);
//     }

//     const data = await response.json();
//     const content = data.content[0].text;

//     // Parse JSON response
//     let result: DesireResearchResult;
//     try {
//       result = JSON.parse(content);
//     } catch (parseError) {
//       // If JSON parsing fails, try to extract JSON from markdown code blocks
//       const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
//                        content.match(/\{[\s\S]*\}/);
//       if (jsonMatch) {
//         result = JSON.parse(jsonMatch[1] || jsonMatch[0]);
//       } else {
//         throw new Error('Failed to parse Claude response as JSON');
//       }
//     }

//     return result;
//   } catch (error: any) {
//     console.error('Claude API error:', error);
//     throw error;
//   }
// }

// /**
//  * Calculate the impact of a desire on freedom score
//  */
// export function calculateDesireImpact(
//   desireCost: number,
//   currentFreedom: FreedomResult
// ): { newDays: number; change: number } {
//   // Calculate new runway with reduced liquid assets
//   const dailyBurn = currentFreedom.dailyNeeds - currentFreedom.dailyAssetIncome;
  
//   if (dailyBurn <= 0) {
//     // Already kinged, buying something doesn't change that
//     return { newDays: Infinity, change: 0 };
//   }

//   // Estimate liquid assets from current days
//   const currentLiquidAssets = currentFreedom.days * dailyBurn;
//   const newLiquidAssets = Math.max(0, currentLiquidAssets - desireCost);
//   const newDays = Math.floor(newLiquidAssets / dailyBurn);
  
//   return {
//     newDays,
//     change: newDays - currentFreedom.days,
//   };
// }

// /**
//  * Get optimal purchase timing
//  */
// export function getOptimalTiming(
//   desireCost: number,
//   currentFreedom: FreedomResult
// ): {
//   canBuyNow: boolean;
//   monthsToWait: number;
//   reason: string;
// } {
//   const impact = calculateDesireImpact(desireCost, currentFreedom);
  
//   // If change is less than 30 days, probably fine to buy now
//   if (Math.abs(impact.change) < 30) {
//     return {
//       canBuyNow: true,
//       monthsToWait: 0,
//       reason: 'Minimal impact on your freedom score. You can buy now.',
//     };
//   }

//   // If big impact, calculate how long to wait
//   const monthlySavings = (currentFreedom.dailyAssetIncome - currentFreedom.dailyNeeds) * 30;
  
//   if (monthlySavings <= 0) {
//     return {
//       canBuyNow: false,
//       monthsToWait: Infinity,
//       reason: 'You need to increase income or reduce obligations before this purchase.',
//     };
//   }

//   const monthsToWait = Math.ceil(desireCost / monthlySavings);
  
//   return {
//     canBuyNow: false,
//     monthsToWait,
//     reason: `Wait ${monthsToWait} months to save up without impacting your freedom score.`,
//   };
// }
