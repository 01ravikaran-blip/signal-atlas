import { ContentCategory, PlatformTarget } from '../types.js';

export const CATEGORY_HASHTAGS: Record<ContentCategory, { broad: string[]; niche: Record<string, string[]> }> = {
  CRYPTO_DEFI: {
    broad: ['#crypto', '#defi', '#web3finance', '#digitalassets'],
    niche: {
      bitcoin: ['#bitcoin', '#btc', '#etf', '#lightning'],
      ethereum: ['#ethereum', '#eth', '#layer2', '#staking'],
      solana: ['#solana', '#sol', '#spltoken'],
      defi_yield: ['#dex', '#tvl', '#yield', '#liquidity', '#uniswap']
    }
  },
  AI_WEB3: {
    broad: ['#ai', '#web3', '#tech', '#aiagent'],
    niche: {
      llm: ['#llm', '#generativeai', '#opensourceai', '#agents'],
      compute: ['#gpu', '#decentralizedai', '#zkproof'],
      infrastructure: ['#interoperability', '#oracles', '#smartcontracts']
    }
  },
  STOCKS_MACRO: {
    broad: ['#macro', '#markets', '#economy', '#finance'],
    niche: {
      central_bank: ['#fed', '#interestrates', '#inflation', '#cpi'],
      stocks: ['#sp500', '#nasdaq', '#equities', '#earnings'],
      commodities: ['#gold', '#oil', '#dxy', '#currencies'],
      geopolitics: ['#brics', '#globaltrade', '#emergingmarkets']
    }
  }
};

export const HASHTAG_BLACKLIST = new Set([
  '#pump', '#moon', '#100x', '#giveaway', '#airdrop', '#viral',
  '#urgent', '#breakingnews', '#buynow', '#sellnow', '#guaranteed',
  '#scam', '#100xgains', '#shib', '#pepe', '#memecoin', '#free',
  '#follow4follow', '#like4like', '#trending'
]);

export const PLATFORM_HASHTAG_LIMITS: Record<PlatformTarget, { min: number; max: number; target: number; preferLowercase: boolean }> = {
  BLUESKY: { min: 0, max: 3, target: 2, preferLowercase: true },
  FARCASTER: { min: 0, max: 3, target: 1, preferLowercase: true },
  TELEGRAM: { min: 2, max: 5, target: 3, preferLowercase: true },
  DISCORD: { min: 0, max: 2, target: 1, preferLowercase: true }
};
