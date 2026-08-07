import { VisualDecisionType, ContentCategory, ContentSeriesType } from '../types.js';

export interface ChartGeneratorOptions {
  assetType: VisualDecisionType;
  seriesType?: ContentSeriesType;
  title: string;
  category: ContentCategory;
  timestamp: string;
  sourceName?: string;
  sourceUrl?: string;
  keyDataPoints?: string[];
  tickers?: { symbol: string; price: number; change24h: number }[];
  scenarios?: { base: string; upside: string; downside: string };
  timelineMilestones?: { time: string; text: string; source: string }[];
  correctionInfo?: { original: string; corrected: string; explanation: string };
}

export function generateBrandedGraphicSvg(options: ChartGeneratorOptions): string {
  const width = 1200;
  const height = 675;
  const dateStr = new Date(options.timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  const categoryColor = options.category === 'CRYPTO_DEFI' ? '#00F2FE' :
                        options.category === 'AI_WEB3' ? '#C084FC' : '#10B981';

  const categoryLabel = options.category === 'CRYPTO_DEFI' ? 'CRYPTO & DEFI' :
                        options.category === 'AI_WEB3' ? 'AI & WEB3' : 'STOCKS & MACRO';

  // Sanitize text for SVG
  const escapeSvg = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safeTitle = escapeSvg(options.title.substring(0, 90));
  const safeSource = escapeSvg(options.sourceName || 'Signal Atlas Feeds');

  let contentBlock = '';

  // 1. Market Chart
  if (options.assetType === 'ATTACH_ORIGINAL_CHART' && options.tickers && options.tickers.length > 0) {
    const t = options.tickers[0];
    const isPos = t.change24h >= 0;
    const changeColor = isPos ? '#10B981' : '#EF4444';
    const changeSign = isPos ? '+' : '';

    contentBlock = `
      <!-- Market Chart Block -->
      <g transform="translate(80, 220)">
        <rect x="0" y="0" width="1040" height="320" rx="16" fill="rgba(15, 23, 42, 0.7)" stroke="rgba(255, 255, 255, 0.1)" stroke-width="1" />
        
        <text x="40" y="70" font-family="Inter, system-ui, sans-serif" font-size="36" font-weight="800" fill="#FFFFFF">${escapeSvg(t.symbol)} / USD</text>
        <text x="40" y="125" font-family="Inter, system-ui, sans-serif" font-size="48" font-weight="900" fill="#FFFFFF">$${t.price.toLocaleString()}</text>
        <text x="320" y="125" font-family="Inter, system-ui, sans-serif" font-size="32" font-weight="700" fill="${changeColor}">${changeSign}${t.change24h.toFixed(2)}% (24h)</text>
        
        <!-- Axis & Polyline Chart Representation -->
        <line x1="40" y1="260" x2="1000" y2="260" stroke="rgba(255, 255, 255, 0.15)" stroke-width="2" />
        <polyline points="40,240 180,210 320,230 460,180 600,195 740,150 880,165 1000,${isPos ? 120 : 250}" fill="none" stroke="${changeColor}" stroke-width="5" stroke-linecap="round" />
        <circle cx="1000" cy="${isPos ? 120 : 250}" r="8" fill="${changeColor}" />

        <text x="40" y="290" font-family="Inter, system-ui, sans-serif" font-size="14" fill="#94A3B8">00:00 UTC</text>
        <text x="500" y="290" font-family="Inter, system-ui, sans-serif" font-size="14" fill="#94A3B8">12:00 UTC</text>
        <text x="940" y="290" font-family="Inter, system-ui, sans-serif" font-size="14" fill="#94A3B8">24:00 UTC</text>
      </g>
    `;
  }
  // 2. Developing Timeline
  else if (options.assetType === 'ATTACH_TIMELINE' && options.timelineMilestones && options.timelineMilestones.length > 0) {
    const items = options.timelineMilestones.slice(0, 3);
    let yOffset = 230;
    const timelineSvg = items.map((m, idx) => {
      const g = `
        <g transform="translate(80, ${yOffset})">
          <circle cx="20" cy="20" r="10" fill="${categoryColor}" />
          <line x1="20" y1="30" x2="20" y2="90" stroke="rgba(255, 255, 255, 0.2)" stroke-width="2" />
          <text x="50" y="25" font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="700" fill="${categoryColor}">${escapeSvg(m.time)} — ${escapeSvg(m.source)}</text>
          <text x="50" y="55" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="600" fill="#F8FAFC">${escapeSvg(m.text.substring(0, 85))}</text>
        </g>
      `;
      yOffset += 95;
      return g;
    }).join('\n');

    contentBlock = timelineSvg;
  }
  // 3. Risk Map / Scenario Card
  else if (options.assetType === 'ATTACH_RISK_MAP' && options.scenarios) {
    contentBlock = `
      <g transform="translate(80, 220)">
        <!-- Base Case -->
        <rect x="0" y="0" width="320" height="300" rx="16" fill="rgba(30, 41, 59, 0.8)" stroke="rgba(255, 255, 255, 0.1)" stroke-width="1" />
        <text x="24" y="45" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="800" fill="#38BDF8">🎯 BASE CASE</text>
        <text x="24" y="90" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#CBD5E1" width="270">${escapeSvg(options.scenarios.base.substring(0, 140))}</text>

        <!-- Upside Scenario -->
        <rect x="360" y="0" width="320" height="300" rx="16" fill="rgba(16, 185, 129, 0.1)" stroke="rgba(16, 185, 129, 0.3)" stroke-width="1" />
        <text x="384" y="45" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="800" fill="#34D399">📈 UPSIDE SCENARIO</text>
        <text x="384" y="90" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#CBD5E1" width="270">${escapeSvg(options.scenarios.upside.substring(0, 140))}</text>

        <!-- Downside Risk -->
        <rect x="720" y="0" width="320" height="300" rx="16" fill="rgba(239, 68, 68, 0.1)" stroke="rgba(239, 68, 68, 0.3)" stroke-width="1" />
        <text x="744" y="45" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="800" fill="#F87171">⚠️ DOWNSIDE RISK</text>
        <text x="744" y="90" font-family="Inter, system-ui, sans-serif" font-size="16" fill="#CBD5E1" width="270">${escapeSvg(options.scenarios.downside.substring(0, 140))}</text>
      </g>
    `;
  }
  // 4. Correction Card
  else if (options.assetType === 'ATTACH_CORRECTION_CARD') {
    const c = options.correctionInfo || { original: 'Previous report', corrected: safeTitle, explanation: 'Updated based on verified source filings.' };
    contentBlock = `
      <g transform="translate(80, 220)">
        <rect x="0" y="0" width="1040" height="300" rx="16" fill="rgba(239, 68, 68, 0.12)" stroke="#EF4444" stroke-width="2" />
        <text x="40" y="55" font-family="Inter, system-ui, sans-serif" font-size="24" font-weight="900" fill="#EF4444">🚨 OFFICIAL CORRECTION & UPDATE NOTICE</text>
        
        <text x="40" y="110" font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="700" fill="#94A3B8">CORRECTED ITEM:</text>
        <text x="40" y="140" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="700" fill="#F8FAFC">${escapeSvg(c.corrected.substring(0, 100))}</text>

        <text x="40" y="195" font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="700" fill="#94A3B8">VERIFICATION EXPLANATION:</text>
        <text x="40" y="225" font-family="Inter, system-ui, sans-serif" font-size="18" fill="#CBD5E1">${escapeSvg(c.explanation.substring(0, 140))}</text>
      </g>
    `;
  }
  // 5. Default News Context Card / Briefing Card
  else {
    const bullets = (options.keyDataPoints && options.keyDataPoints.length > 0)
      ? options.keyDataPoints.slice(0, 3)
      : ['Primary verified source feeds ingested.', 'Market metrics updated across on-chain orderbooks.', 'Structural trend monitoring active.'];

    const bulletsSvg = bullets.map((b, idx) => `
      <g transform="translate(0, ${idx * 75})">
        <circle cx="16" cy="16" r="6" fill="${categoryColor}" />
        <text x="40" y="22" font-family="Inter, system-ui, sans-serif" font-size="20" font-weight="600" fill="#E2E8F0">${escapeSvg(b.substring(0, 85))}</text>
      </g>
    `).join('\n');

    contentBlock = `
      <g transform="translate(80, 230)">
        <rect x="0" y="0" width="1040" height="280" rx="16" fill="rgba(15, 23, 42, 0.75)" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1" />
        <g transform="translate(40, 40)">
          ${bulletsSvg}
        </g>
      </g>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <!-- Background Gradient -->
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F172A" />
      <stop offset="50%" stop-color="#090D16" />
      <stop offset="100%" stop-color="#030712" />
    </linearGradient>
    <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00F2FE" />
      <stop offset="100%" stop-color="#4FACFE" />
    </linearGradient>
  </defs>

  <!-- Base Rectangle -->
  <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

  <!-- Top Accent Bar -->
  <rect x="0" y="0" width="${width}" height="6" fill="${categoryColor}" />

  <!-- Header Section -->
  <g transform="translate(80, 70)">
    <!-- Brand Mark -->
    <rect x="0" y="0" width="44" height="44" rx="10" fill="url(#brandGrad)" />
    <path d="M12 28 L22 14 L32 28 Z" fill="#0F172A" />
    
    <text x="60" y="30" font-family="Inter, system-ui, sans-serif" font-size="24" font-weight="900" fill="#FFFFFF" letter-spacing="1">SIGNAL ATLAS</text>
    
    <!-- Category Badge -->
    <rect x="900" y="4" width="140" height="32" rx="6" fill="${categoryColor}" opacity="0.18" />
    <text x="970" y="25" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="800" fill="${categoryColor}" text-anchor="middle">${categoryLabel}</text>
  </g>

  <!-- Title Section -->
  <g transform="translate(80, 145)">
    <text x="0" y="30" font-family="Inter, system-ui, sans-serif" font-size="30" font-weight="800" fill="#F8FAFC">${safeTitle}</text>
  </g>

  <!-- Main Content Block -->
  ${contentBlock}

  <!-- Footer Attribution Bar -->
  <g transform="translate(80, 620)">
    <line x1="0" y1="0" x2="1040" y2="0" stroke="rgba(255, 255, 255, 0.1)" stroke-width="1" />
    <text x="0" y="30" font-family="Inter, system-ui, sans-serif" font-size="14" fill="#64748B">Data: ${safeSource} | Timestamp: ${dateStr}</text>
    <text x="1040" y="30" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="700" fill="#64748B" text-anchor="end">SignalAtlas.org — Evidence First</text>
  </g>
</svg>`;
}

export function generateBrandedGraphicBuffer(options: ChartGeneratorOptions): Buffer {
  const svgString = generateBrandedGraphicSvg(options);
  return Buffer.from(svgString, 'utf-8');
}
