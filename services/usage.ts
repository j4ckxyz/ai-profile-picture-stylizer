export type Usage = {
  tokensIn: number;
  tokensOut: number;
  costUSD: number;
};

// Pricing provided by user
const PRICE_IN_PER_MILLION = 0.30;   // $0.30 / 1M tokens in
const PRICE_OUT_PER_MILLION = 2.50;  // $2.50 / 1M tokens out

export function estimateTokensFromText(text: string): number {
  // Very rough heuristic: ~4 chars per token
  const t = Math.ceil((text || '').length / 4);
  return t > 0 ? t : 0;
}

export function computeCostUSD(tokensIn: number, tokensOut: number): number {
  const inCost = (tokensIn / 1_000_000) * PRICE_IN_PER_MILLION;
  const outCost = (tokensOut / 1_000_000) * PRICE_OUT_PER_MILLION;
  return +(inCost + outCost).toFixed(6);
}

export function addUsage(prev: Usage, addIn: number, addOut: number): Usage {
  const tokensIn = prev.tokensIn + addIn;
  const tokensOut = prev.tokensOut + addOut;
  const costUSD = computeCostUSD(tokensIn, tokensOut);
  return { tokensIn, tokensOut, costUSD };
}

export const DEFAULT_USAGE: Usage = { tokensIn: 0, tokensOut: 0, costUSD: 0 };

