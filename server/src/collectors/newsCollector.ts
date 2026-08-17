import Parser from 'rss-parser';
import { NewsItem, ContentCategory } from '../types.js';
import { db } from '../db/database.ts';

const parser = new Parser({
  headers: { 'User-Agent': 'SignalAtlasBot/1.0 (+https://signalatlas.org)' },
  timeout: 6000
});

const RSS_FEEDS: { url: string; source: string; category: ContentCategory; baseCredibility: number }[] = [
  // Crypto & DeFi (50% target)
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk', category: 'CRYPTO_DEFI', baseCredibility: 0.90 },
  { url: 'https://cointelegraph.com/rss', source: 'Cointelegraph', category: 'CRYPTO_DEFI', baseCredibility: 0.85 },
  { url: 'https://decrypt.co/feed', source: 'Decrypt', category: 'CRYPTO_DEFI', baseCredibility: 0.88 },
  
  // AI & Web3 (25% target)
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', source: 'TechCrunch AI', category: 'AI_WEB3', baseCredibility: 0.92 },
  { url: 'https://venturebeat.com/category/ai/feed/', source: 'VentureBeat AI', category: 'AI_WEB3', baseCredibility: 0.88 },

  // Stocks & Macroeconomics (25% target)
  { url: 'https://www.federalreserve.gov/feeds/press_all.xml', source: 'US Federal Reserve', category: 'STOCKS_MACRO', baseCredibility: 0.98 },
  { url: 'https://www.sec.gov/news/pressreleases.rss', source: 'US SEC', category: 'STOCKS_MACRO', baseCredibility: 0.96 },
  { url: 'https://search.cnbc.com/rs/search/combinednewsletterpage?id=15839069&transport=rss', source: 'CNBC Finance', category: 'STOCKS_MACRO', baseCredibility: 0.85 }
];

export async function fetchLatestNews(): Promise<NewsItem[]> {
  const allNews: NewsItem[] = [];

  for (const feedConfig of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedConfig.url);
      if (feed && feed.items) {
        for (const item of feed.items.slice(0, 5)) {
          if (!item.title || !item.link) continue;
          allNews.push({
            id: 'news_' + Buffer.from(item.link).toString('base64').substring(0, 16),
            title: item.title.trim(),
            summary: item.contentSnippet?.trim() || item.content?.trim() || item.title.trim(),
            url: item.link,
            source: feedConfig.source,
            category: feedConfig.category,
            publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
            credibilityScore: feedConfig.baseCredibility,
            rawContent: item.content
          });
        }
      }
    } catch (err: any) {
      db.addLog('WARN', 'NEWS_COLLECTOR', `Failed to fetch RSS from ${feedConfig.source}: ${err.message}`);
    }
  }

  // If public RSS network calls failed or returned sparse data, just log a warning instead of injecting fake news.
  if (allNews.length === 0) {
    db.addLog('WARN', 'NEWS_COLLECTOR', 'No news items fetched from RSS feeds. Network might be blocked or feeds empty.');
  } else if (allNews.length < 5) {
    db.addLog('INFO', 'NEWS_COLLECTOR', `Only fetched ${allNews.length} news items. Continuing with available data.`);
  }

  db.addLog('INFO', 'NEWS_COLLECTOR', `Ingested ${allNews.length} verified news items across Crypto, AI/Web3, and Macro categories.`);
  return allNews;
}
