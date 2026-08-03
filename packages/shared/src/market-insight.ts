export type ProductMarketInsight = {
  productId: string;
  summary: string;
  highlights: string[];
  generatedAt: string;
  /** Stage-1 generator; replaceable with a live market/LLM provider later. */
  source: 'heuristic';
};
