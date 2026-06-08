(function () {
  const config = window.APP_CONFIG || {};
  const refreshIntervalMs = Math.max(Number(config.refreshIntervalMs) || 60000, 15000);
  const indiaDisplayWeightGrams = 10;
  const newsPerPage = 4;
  const state = {
    activeTab: "home",
    newsPage: 1,
    usDisplayCurrency: "USD",
    theme: localStorage.getItem("metal-theme") || "system",
    lastUpdated: null,
    nextRefreshSeconds: Math.round(refreshIntervalMs / 1000),
    statusMessage: "Loading market data...",
    errors: [],
    data: {
      indiaRates: [],
      coinRates: [],
      usRates: [],
      news: []
    }
  };

  const elements = {
    heroHeadline: document.getElementById("heroHeadline"),
    heroSummary: document.getElementById("heroSummary"),
    indiaCurrentTime: document.getElementById("indiaCurrentTime"),
    indiaCurrentDate: document.getElementById("indiaCurrentDate"),
    usCurrentTime: document.getElementById("usCurrentTime"),
    usMarketStatus: document.getElementById("usMarketStatus"),
    refreshRateLabel: document.getElementById("refreshRateLabel"),
    nextRefreshLabel: document.getElementById("nextRefreshLabel"),
    lastUpdatedLabel: document.getElementById("lastUpdatedLabel"),
    statusStrip: document.getElementById("statusStrip"),
    indiaRatesGrid: document.getElementById("indiaRatesGrid"),
    coinsGrid: document.getElementById("coinsGrid"),
    usRatesGrid: document.getElementById("usRatesGrid"),
    newsList: document.getElementById("newsList"),
    newsPageIndicator: document.getElementById("newsPageIndicator"),
    prevNewsButton: document.getElementById("prevNewsButton"),
    nextNewsButton: document.getElementById("nextNewsButton"),
    manualRefreshButton: document.getElementById("manualRefreshButton"),
    menuButton: document.getElementById("menuButton"),
    themeMenu: document.getElementById("themeMenu"),
    usCurrencyButtons: Array.from(document.querySelectorAll("[data-us-currency]")),
    navItems: Array.from(document.querySelectorAll("[data-tab-target]")),
    tabPanels: Array.from(document.querySelectorAll("[data-tab-panel]")),
    themeButtons: Array.from(document.querySelectorAll("[data-theme-value]"))
  };

  const fallbackNews = [
    {
      title: "India retail gold demand stays firm ahead of festive buying season",
      summary:
        "Jewellers report steady footfall as households accumulate on dips, while traders watch rupee movement and import duty commentary.",
      source: "Market Desk",
      publishedAt: "2026-06-03T09:00:00Z",
      url: "https://www.moneycontrol.com/"
    },
    {
      title: "Silver gains support from industrial demand and solar manufacturing orders",
      summary:
        "Analysts expect silver volatility to remain elevated as industrial demand offsets profit-booking in global bullion markets.",
      source: "Commodities Wire",
      publishedAt: "2026-06-03T08:10:00Z",
      url: "https://www.reuters.com/markets/commodities/"
    },
    {
      title: "COMEX gold steadies as traders await fresh inflation guidance from the US",
      summary:
        "US precious metals futures trade in a tight range while investors assess rate path signals and dollar strength.",
      source: "Global Metals Report",
      publishedAt: "2026-06-03T07:30:00Z",
      url: "https://www.cnbc.com/commodities/"
    },
    {
      title: "Import policy discussion keeps Indian bullion dealers alert on domestic premiums",
      summary:
        "Domestic premiums remain sensitive to customs policy and logistics costs, influencing dealer spreads in major cities.",
      source: "Bullion Brief",
      publishedAt: "2026-06-02T17:45:00Z",
      url: "https://www.thehindubusinessline.com/markets/"
    },
    {
      title: "Experts see gold allocation as a defensive hedge in diversified portfolios",
      summary:
        "Wealth advisors continue to recommend measured gold exposure to cushion volatility across equities and currencies.",
      source: "Advisory Outlook",
      publishedAt: "2026-06-02T12:00:00Z",
      url: "https://www.livemint.com/market"
    },
    {
      title: "Silver coin demand rises in regional markets amid gifting and savings purchases",
      summary:
        "Smaller denomination coins and bars see higher movement as buyers prefer flexible entry points during volatile sessions.",
      source: "Retail Metals Watch",
      publishedAt: "2026-06-01T10:20:00Z",
      url: "https://www.businesstoday.in/markets"
    }
  ];

  function formatCurrency(value, currency, digits = 2) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: digits,
      minimumFractionDigits: digits
    }).format(value);
  }

  function formatPercent(value) {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  }

  function formatTime(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function formatLiveClock(timeZone) {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    }).format(new Date());
  }

  function formatLiveDate(timeZone) {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(new Date());
  }

  function getNewYorkTimeParts() {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

    const parts = formatter.formatToParts(new Date());
    const weekday = parts.find((part) => part.type === "weekday")?.value || "Mon";
    const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
    const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);

    return { weekday, hour, minute };
  }

  function getUsMarketStatus() {
    const { weekday, hour, minute } = getNewYorkTimeParts();
    const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dayNumber = weekdayMap[weekday] ?? 1;
    const totalMinutes = hour * 60 + minute;
    const marketOpenMinutes = 8 * 60 + 20;
    const marketCloseMinutes = 17 * 60;
    const isWeekday = dayNumber >= 1 && dayNumber <= 5;
    const isOpen = isWeekday && totalMinutes >= marketOpenMinutes && totalMinutes <= marketCloseMinutes;

    return isOpen
      ? "US market is open now in New York"
      : "US market is closed now in New York";
  }

  function renderLiveTimes() {
    elements.indiaCurrentTime.textContent = formatLiveClock("Asia/Kolkata");
    elements.indiaCurrentDate.textContent = formatLiveDate("Asia/Kolkata");
    elements.usCurrentTime.textContent = formatLiveClock("America/New_York");
    elements.usMarketStatus.textContent = getUsMarketStatus();
  }

  function clampNumber(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function perGramToDisplayWeight(valuePerGram) {
    return clampNumber(valuePerGram, 0) * indiaDisplayWeightGrams;
  }

  function troyOunceToDisplayWeight(valuePerTroyOunce) {
    return (clampNumber(valuePerTroyOunce, 0) / 31.1034768) * indiaDisplayWeightGrams;
  }

  function getSystemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(themeValue) {
    state.theme = themeValue;
    localStorage.setItem("metal-theme", themeValue);
    const resolvedTheme = themeValue === "system" ? getSystemTheme() : themeValue;
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }

  function updateThemeSelectionUI() {
    elements.themeButtons.forEach((button) => {
      const selected = button.dataset.themeValue === state.theme;
      button.setAttribute("aria-checked", String(selected));
      button.style.background = selected ? "var(--accent-soft)" : "var(--surface)";
    });
  }

  function toggleMenu(forceOpen) {
    const shouldOpen =
      typeof forceOpen === "boolean"
        ? forceOpen
        : elements.themeMenu.classList.contains("hidden");
    elements.themeMenu.classList.toggle("hidden", !shouldOpen);
    elements.menuButton.setAttribute("aria-expanded", String(shouldOpen));
  }

  function setStatus(message, isError) {
    state.statusMessage = message;
    elements.statusStrip.textContent = message;
    elements.statusStrip.classList.toggle("error-banner", Boolean(isError));
  }

  function getFallbackMetals() {
    const now = Date.now();
    const drift = (seed) => {
      const cycle = Math.sin(now / 240000 + seed) * 0.0045;
      return 1 + cycle;
    };

    const gold24k = 7425 * drift(0.3);
    const gold22k = gold24k * 0.916;
    const silver1g = 92.5 * drift(1.1);
    const usGold = 2368 * drift(0.5);
    const usSilver = 31.2 * drift(1.9);
    const usdInr = 83.45 * drift(0.1);

    return {
      gold24k,
      gold22k,
      silver1g,
      usGold,
      usSilver,
      usdInr
    };
  }

  async function safeFetchJson(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return response.json();
  }

  async function fetchNewsItems() {
    if (!config.newsEndpoint || !/^https?:\/\//i.test(config.newsEndpoint)) {
      return fallbackNews;
    }

    const data = await safeFetchJson(config.newsEndpoint);
    const articles = data?.articles || data?.data || [];
    if (!Array.isArray(articles) || !articles.length) {
      return fallbackNews;
    }

    return articles.map((article) => ({
      title: article.title || "Untitled market update",
      summary: article.description || article.content || "No summary available.",
      source: article.source?.name || article.source || "News Feed",
      publishedAt: article.publishedAt || article.pubDate || new Date().toISOString(),
      url: article.url || "#"
    }));
  }

  async function fetchCoinRates(baseRates) {
    if (config.coinsEndpoint && /^https?:\/\//i.test(config.coinsEndpoint)) {
      const payload = await safeFetchJson(config.coinsEndpoint);
      if (Array.isArray(payload)) {
        return payload;
      }
      if (Array.isArray(payload?.data)) {
        return payload.data;
      }
    }

    return [
      {
        name: "Sovereign Gold Coin",
        purity: "24K / 999",
        weight: "8 g",
        marketValue: baseRates.gold24k * 8,
        premium: 2.15,
        region: "Pan India",
        image: "./assets/coin.svg"
      },
      {
        name: "Temple Gold Coin",
        purity: "22K / 916",
        weight: "10 g",
        marketValue: baseRates.gold22k * 10,
        premium: 1.72,
        region: "South India",
        image: "./assets/coin.svg"
      },
      {
        name: "Silver Buffalo Coin",
        purity: "999 Fine Silver",
        weight: "31.1 g",
        marketValue: baseRates.silver1g * 31.1,
        premium: 1.35,
        region: "Collector Market",
        image: "./assets/silver.svg"
      },
      {
        name: "Maharashtra Lakshmi Coin",
        purity: "24K / 999",
        weight: "5 g",
        marketValue: baseRates.gold24k * 5,
        premium: 1.95,
        region: "West India",
        image: "./assets/coin.svg"
      },
      {
        name: "Gujarati Silver Coin",
        purity: "999 Fine Silver",
        weight: "20 g",
        marketValue: baseRates.silver1g * 20,
        premium: 1.1,
        region: "West India",
        image: "./assets/silver.svg"
      },
      {
        name: "Bengal Festive Coin",
        purity: "22K / 916",
        weight: "4 g",
        marketValue: baseRates.gold22k * 4,
        premium: 1.58,
        region: "East India",
        image: "./assets/coin.svg"
      }
    ];
  }

  function createRateCard(item, options = {}) {
    const deltaClass = item.changePercent >= 0 ? "delta-positive" : "delta-negative";
    const compactClass = options.compact ? "compact" : "";
    const cardImage = item.image
      ? `<img class="metal-visual" src="${item.image}" alt="${item.title}" />`
      : `<span class="exchange-chip">${item.exchange || item.unit}</span>`;

    return `
      <article class="market-card ${compactClass}">
        <div class="market-card-header">
          <div>
            <p class="section-label">${item.category}</p>
            <h3>${item.title}</h3>
          </div>
          ${cardImage}
        </div>
        <div class="rate-line">
          <span class="rate-value">${item.displayValue}</span>
          <span class="delta-chip ${deltaClass}">${formatPercent(item.changePercent)}</span>
        </div>
        <div class="stats-list">
          <div class="stat-row"><span>Open</span><strong>${item.openDisplay}</strong></div>
          <div class="stat-row"><span>High</span><strong>${item.highDisplay}</strong></div>
          <div class="stat-row"><span>Low</span><strong>${item.lowDisplay}</strong></div>
          <div class="stat-row"><span>Updated</span><strong>${item.updatedDisplay}</strong></div>
        </div>
        <p class="source-label">Source: ${item.source}</p>
      </article>
    `;
  }

  function createCoinCard(item) {
    return `
      <article class="market-card compact">
        <div class="market-card-header">
          <div>
            <p class="section-label">${item.region}</p>
            <h3>${item.name}</h3>
          </div>
          <img class="metal-visual" src="${item.image}" alt="${item.name}" />
        </div>
        <div class="rate-line">
          <span class="rate-value">${formatCurrency(item.marketValue, "INR")}</span>
          <span class="delta-chip delta-positive">Premium ${item.premium.toFixed(2)}%</span>
          <span class="category-chip">${item.weight}</span>
        </div>
        <div class="stats-list">
          <div class="stat-row"><span>Purity</span><strong>${item.purity}</strong></div>
          <div class="stat-row"><span>Indicative value</span><strong>${formatCurrency(item.marketValue, "INR")}</strong></div>
          <div class="stat-row"><span>Market type</span><strong>Live retail estimate</strong></div>
        </div>
      </article>
    `;
  }

  function createNewsCard(item) {
    return `
      <article class="news-card">
        <div class="news-card-header">
          <div>
            <p class="section-label">${item.source}</p>
            <h3>${item.title}</h3>
          </div>
          <span class="category-chip">${formatTime(item.publishedAt)}</span>
        </div>
        <p>${item.summary}</p>
        <p><a href="${item.url}" target="_blank" rel="noreferrer">Read article</a></p>
      </article>
    `;
  }

  function renderIndiaRates() {
    elements.indiaRatesGrid.innerHTML = state.data.indiaRates.map((item) => createRateCard(item)).join("");
  }

  function renderCoinRates() {
    elements.coinsGrid.innerHTML = state.data.coinRates.map((item) => createCoinCard(item)).join("");
  }

  function createUsRateCard(item) {
    const mode = state.usDisplayCurrency;
    const display = item.prices[mode];
    const deltaClass = display.changePercent >= 0 ? "delta-positive" : "delta-negative";

    return `
      <article class="market-card">
        <div class="market-card-header">
          <div>
            <p class="section-label">${item.market}</p>
            <h3>${item.title}</h3>
          </div>
          <img class="metal-visual" src="${item.image}" alt="${item.title}" />
        </div>
        <div class="rate-line">
          <span class="rate-value">${display.displayValue}</span>
          <span class="delta-chip ${deltaClass}">${formatPercent(display.changePercent)}</span>
        </div>
        <div class="stats-list">
          <div class="stat-row"><span>Display mode</span><strong>${mode}</strong></div>
          <div class="stat-row"><span>Unit</span><strong>${display.unit}</strong></div>
          <div class="stat-row"><span>Open</span><strong>${display.openDisplay}</strong></div>
          <div class="stat-row"><span>High</span><strong>${display.highDisplay}</strong></div>
          <div class="stat-row"><span>Low</span><strong>${display.lowDisplay}</strong></div>
          <div class="stat-row"><span>Updated</span><strong>${display.updatedDisplay}</strong></div>
        </div>
        <p class="source-label">Source: ${item.source}</p>
      </article>
    `;
  }

  function renderUsRates() {
    elements.usRatesGrid.innerHTML = state.data.usRates.map((item) => createUsRateCard(item)).join("");
  }

  function renderNews() {
    const totalPages = Math.max(Math.ceil(state.data.news.length / newsPerPage), 1);
    state.newsPage = Math.min(state.newsPage, totalPages);
    const start = (state.newsPage - 1) * newsPerPage;
    const items = state.data.news.slice(start, start + newsPerPage);
    elements.newsList.innerHTML = items.map((item) => createNewsCard(item)).join("");
    elements.newsPageIndicator.textContent = `Page ${state.newsPage} of ${totalPages}`;
    elements.prevNewsButton.disabled = state.newsPage <= 1;
    elements.nextNewsButton.disabled = state.newsPage >= totalPages;
  }

  function renderHero() {
    const primaryGold = state.data.indiaRates[0];
    const primarySilver = state.data.indiaRates[2];

    if (!primaryGold || !primarySilver) {
      elements.heroHeadline.textContent = "Waiting for market data...";
      elements.heroSummary.textContent =
        "The dashboard will show live India and US precious metals pricing once data is available.";
      return;
    }

    elements.heroHeadline.textContent = `${primaryGold.displayValue} gold and ${primarySilver.displayValue} silver for ${indiaDisplayWeightGrams} grams`;
    elements.heroSummary.textContent = `24K gold is moving ${formatPercent(primaryGold.changePercent)} while silver is moving ${formatPercent(primarySilver.changePercent)}. Auto refresh keeps India and US comparison rates updated every ${Math.round(refreshIntervalMs / 1000)} seconds.`;
  }

  function renderLastUpdated() {
    elements.refreshRateLabel.textContent = `${Math.round(refreshIntervalMs / 1000)} sec`;
    elements.nextRefreshLabel.textContent = `Next update in ${state.nextRefreshSeconds} sec`;
    elements.lastUpdatedLabel.textContent = state.lastUpdated ? formatTime(state.lastUpdated) : "Waiting...";
  }

  function render() {
    renderHero();
    renderLiveTimes();
    renderLastUpdated();
    renderIndiaRates();
    renderCoinRates();
    renderUsRates();
    renderNews();
    elements.usCurrencyButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.usCurrency === state.usDisplayCurrency);
    });
    updateThemeSelectionUI();
  }

  function switchTab(tabName) {
    state.activeTab = tabName;
    elements.navItems.forEach((item) => {
      const isActive = item.dataset.tabTarget === tabName;
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-current", isActive ? "page" : "false");
    });
    elements.tabPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.tabPanel === tabName);
    });
  }

  function buildRateObject({
    title,
    category,
    currency,
    unit,
    value,
    source,
    exchange,
    openValue,
    highValue,
    lowValue,
    changePercent,
    updatedAt
  }) {
    const open = clampNumber(openValue, value * 0.992);
    const high = clampNumber(highValue, value * 1.008);
    const low = clampNumber(lowValue, value * 0.989);
    const safeChangePercent = clampNumber(
      changePercent,
      open ? ((value - open) / open) * 100 : 0
    );
    return {
      title,
      category,
      unit,
      source,
      exchange: exchange || unit,
      changePercent: safeChangePercent,
      displayValue: formatCurrency(value, currency),
      openDisplay: formatCurrency(open, currency),
      highDisplay: formatCurrency(high, currency),
      lowDisplay: formatCurrency(low, currency),
      updatedDisplay: updatedAt ? formatTime(updatedAt) : state.lastUpdated ? formatTime(state.lastUpdated) : "Live",
      value
    };
  }

  function buildUsRateDisplay({
    title,
    market,
    image,
    source,
    updatedAt,
    usdValue,
    usdOpenValue,
    usdHighValue,
    usdLowValue,
    inrValue,
    inrOpenValue,
    inrHighValue,
    inrLowValue,
    changePercent
  }) {
    return {
      title,
      market,
      image,
      source,
      prices: {
        USD: {
          changePercent: clampNumber(changePercent, 0),
          displayValue: formatCurrency(usdValue, "USD"),
          openDisplay: formatCurrency(clampNumber(usdOpenValue, usdValue * 0.992), "USD"),
          highDisplay: formatCurrency(clampNumber(usdHighValue, usdValue * 1.008), "USD"),
          lowDisplay: formatCurrency(clampNumber(usdLowValue, usdValue * 0.989), "USD"),
          updatedDisplay: updatedAt ? formatTime(updatedAt) : "Live",
          unit: "Per troy ounce"
        },
        INR: {
          changePercent: clampNumber(changePercent, 0),
          displayValue: formatCurrency(inrValue, "INR"),
          openDisplay: formatCurrency(clampNumber(inrOpenValue, inrValue * 0.992), "INR"),
          highDisplay: formatCurrency(clampNumber(inrHighValue, inrValue * 1.008), "INR"),
          lowDisplay: formatCurrency(clampNumber(inrLowValue, inrValue * 0.989), "INR"),
          updatedDisplay: updatedAt ? formatTime(updatedAt) : "Live",
          unit: `Per ${indiaDisplayWeightGrams} grams`
        }
      }
    };
  }

  async function loadDashboardData() {
    setStatus("Refreshing live market data...", false);
    state.errors = [];

    try {
      const fallback = getFallbackMetals();
      const [marketData, newsItems] = await Promise.all([
        safeFetchJson("/api/market-data"),
        fetchNewsItems().catch(() => fallbackNews)
      ]);

      const gold24kPerGram = clampNumber(marketData?.indiaGold?.priceGram24k, fallback.gold24k);
      const gold22kPerGram = clampNumber(marketData?.indiaGold?.priceGram22k, fallback.gold22k);
      const silverPerGram = clampNumber(marketData?.indiaSilver?.price, fallback.silver1g);
      const usGold = clampNumber(marketData?.usGold?.price, fallback.usGold);
      const usSilver = clampNumber(marketData?.usSilver?.price, fallback.usSilver);
      const usdInr = clampNumber(marketData?.usdInr, fallback.usdInr);

      state.lastUpdated = new Date().toISOString();

      state.data.indiaRates = [
        buildRateObject({
          title: "Gold 24K",
          category: "India Spot",
          currency: "INR",
          unit: `Per ${indiaDisplayWeightGrams} grams`,
          value: perGramToDisplayWeight(gold24kPerGram),
          source: marketData?.indiaGold?.source || "GoldAPI",
          exchange: `${marketData?.indiaGold?.exchange || "India reference"} | ${indiaDisplayWeightGrams}g`,
          openValue: perGramToDisplayWeight(marketData?.indiaGold?.openPrice),
          highValue: perGramToDisplayWeight(marketData?.indiaGold?.highPrice),
          lowValue: perGramToDisplayWeight(marketData?.indiaGold?.lowPrice),
          changePercent: marketData?.indiaGold?.changePercent,
          updatedAt: marketData?.indiaGold?.timestamp,
          image: "./assets/gold.svg"
        }),
        buildRateObject({
          title: "Gold 22K",
          category: "India Spot",
          currency: "INR",
          unit: `Per ${indiaDisplayWeightGrams} grams`,
          value: perGramToDisplayWeight(gold22kPerGram),
          source: marketData?.indiaGold?.source
            ? `${marketData.indiaGold.source} derived 22K`
            : "GoldAPI derived 22K",
          exchange: `${marketData?.indiaGold?.exchange || "India reference"} | ${indiaDisplayWeightGrams}g`,
          openValue: marketData?.indiaGold?.openPrice
            ? perGramToDisplayWeight(marketData.indiaGold.openPrice * 0.916)
            : null,
          highValue: marketData?.indiaGold?.highPrice
            ? perGramToDisplayWeight(marketData.indiaGold.highPrice * 0.916)
            : null,
          lowValue: marketData?.indiaGold?.lowPrice
            ? perGramToDisplayWeight(marketData.indiaGold.lowPrice * 0.916)
            : null,
          changePercent: marketData?.indiaGold?.changePercent,
          updatedAt: marketData?.indiaGold?.timestamp,
          image: "./assets/gold.svg"
        }),
        buildRateObject({
          title: "Silver",
          category: "India Spot",
          currency: "INR",
          unit: `Per ${indiaDisplayWeightGrams} grams`,
          value: perGramToDisplayWeight(silverPerGram),
          source: marketData?.indiaSilver?.source || "GoldAPI",
          exchange: `${marketData?.indiaSilver?.exchange || "India reference"} | ${indiaDisplayWeightGrams}g`,
          openValue: perGramToDisplayWeight(marketData?.indiaSilver?.openPrice),
          highValue: perGramToDisplayWeight(marketData?.indiaSilver?.highPrice),
          lowValue: perGramToDisplayWeight(marketData?.indiaSilver?.lowPrice),
          changePercent: marketData?.indiaSilver?.changePercent,
          updatedAt: marketData?.indiaSilver?.timestamp,
          image: "./assets/silver.svg"
        })
      ];

      state.data.coinRates = await fetchCoinRates({
        gold24k: gold24kPerGram,
        gold22k: gold22kPerGram,
        silver1g: silverPerGram
      });

      state.data.usRates = [
        buildUsRateDisplay({
          title: "US Gold",
          market: marketData?.usGold?.exchange || "COMEX",
          image: "./assets/gold.svg",
          source: marketData?.usGold?.source || "GoldAPI",
          updatedAt: marketData?.usGold?.timestamp,
          usdValue: usGold,
          usdOpenValue: marketData?.usGold?.openPrice,
          usdHighValue: marketData?.usGold?.highPrice,
          usdLowValue: marketData?.usGold?.lowPrice,
          inrValue: troyOunceToDisplayWeight(usGold) * usdInr,
          inrOpenValue: marketData?.usGold?.openPrice
            ? troyOunceToDisplayWeight(marketData.usGold.openPrice) * usdInr
            : null,
          inrHighValue: marketData?.usGold?.highPrice
            ? troyOunceToDisplayWeight(marketData.usGold.highPrice) * usdInr
            : null,
          inrLowValue: marketData?.usGold?.lowPrice
            ? troyOunceToDisplayWeight(marketData.usGold.lowPrice) * usdInr
            : null,
          changePercent: marketData?.usGold?.changePercent
        }),
        buildUsRateDisplay({
          title: "US Silver",
          market: marketData?.usSilver?.exchange || "NYMEX",
          image: "./assets/silver.svg",
          source: marketData?.usSilver?.source || "GoldAPI",
          updatedAt: marketData?.usSilver?.timestamp,
          usdValue: usSilver,
          usdOpenValue: marketData?.usSilver?.openPrice,
          usdHighValue: marketData?.usSilver?.highPrice,
          usdLowValue: marketData?.usSilver?.lowPrice,
          inrValue: troyOunceToDisplayWeight(usSilver) * usdInr,
          inrOpenValue: marketData?.usSilver?.openPrice
            ? troyOunceToDisplayWeight(marketData.usSilver.openPrice) * usdInr
            : null,
          inrHighValue: marketData?.usSilver?.highPrice
            ? troyOunceToDisplayWeight(marketData.usSilver.highPrice) * usdInr
            : null,
          inrLowValue: marketData?.usSilver?.lowPrice
            ? troyOunceToDisplayWeight(marketData.usSilver.lowPrice) * usdInr
            : null,
          changePercent: marketData?.usSilver?.changePercent
        })
      ];

      state.data.news = newsItems;
      state.newsPage = 1;
      const usingFallbackNews = !config.newsEndpoint || !/^https?:\/\//i.test(config.newsEndpoint);
      const statusParts = [
        `Updated ${state.data.indiaRates.length} India rates`,
        `${state.data.coinRates.length} coin prices`,
        `${state.data.usRates.length} US market cards`,
        `${state.data.news.length} news items`
      ];

      if (usingFallbackNews) {
        statusParts.push("News feed is running in demo mode until a news API is configured");
      }

      setStatus(`${statusParts.join(" | ")}`, false);
      render();
    } catch (error) {
      state.errors.push(error.message);
      state.lastUpdated = new Date().toISOString();
      setStatus(
        "Live data could not be loaded from the configured service. Showing the most recent fallback market estimates.",
        true
      );

      const fallback = getFallbackMetals();
      state.data.indiaRates = [
        buildRateObject({
          title: "Gold 24K",
          category: "India Spot",
          currency: "INR",
          unit: `Per ${indiaDisplayWeightGrams} grams`,
          value: perGramToDisplayWeight(fallback.gold24k),
          source: "Fallback market estimate",
          image: "./assets/gold.svg"
        }),
        buildRateObject({
          title: "Gold 22K",
          category: "India Spot",
          currency: "INR",
          unit: `Per ${indiaDisplayWeightGrams} grams`,
          value: perGramToDisplayWeight(fallback.gold22k),
          source: "Fallback market estimate",
          image: "./assets/gold.svg"
        }),
        buildRateObject({
          title: "Silver",
          category: "India Spot",
          currency: "INR",
          unit: `Per ${indiaDisplayWeightGrams} grams`,
          value: perGramToDisplayWeight(fallback.silver1g),
          source: "Fallback market estimate",
          image: "./assets/silver.svg"
        })
      ];
      state.data.coinRates = await fetchCoinRates(fallback);
      state.data.usRates = [
        buildUsRateDisplay({
          title: "US Gold",
          market: "COMEX",
          image: "./assets/gold.svg",
          source: "Fallback market estimate",
          usdValue: fallback.usGold,
          inrValue: troyOunceToDisplayWeight(fallback.usGold) * fallback.usdInr
        }),
        buildUsRateDisplay({
          title: "US Silver",
          market: "NYMEX",
          image: "./assets/silver.svg",
          source: "Fallback market estimate",
          usdValue: fallback.usSilver,
          inrValue: troyOunceToDisplayWeight(fallback.usSilver) * fallback.usdInr
        })
      ];
      state.data.news = fallbackNews;
      render();
    } finally {
      state.nextRefreshSeconds = Math.round(refreshIntervalMs / 1000);
      renderLastUpdated();
    }
  }

  function bindEvents() {
    elements.navItems.forEach((item) => {
      item.addEventListener("click", () => switchTab(item.dataset.tabTarget));
    });

    elements.usCurrencyButtons.forEach((button) => {
      button.addEventListener("click", () => {
        state.usDisplayCurrency = button.dataset.usCurrency;
        renderUsRates();
        elements.usCurrencyButtons.forEach((item) => {
          item.classList.toggle("active", item.dataset.usCurrency === state.usDisplayCurrency);
        });
      });
    });

    elements.menuButton.addEventListener("click", () => toggleMenu());

    elements.themeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        applyTheme(button.dataset.themeValue);
        updateThemeSelectionUI();
        toggleMenu(false);
      });
    });

    elements.manualRefreshButton.addEventListener("click", loadDashboardData);

    elements.prevNewsButton.addEventListener("click", () => {
      if (state.newsPage > 1) {
        state.newsPage -= 1;
        renderNews();
      }
    });

    elements.nextNewsButton.addEventListener("click", () => {
      const totalPages = Math.max(Math.ceil(state.data.news.length / newsPerPage), 1);
      if (state.newsPage < totalPages) {
        state.newsPage += 1;
        renderNews();
      }
    });

    document.addEventListener("click", (event) => {
      if (!elements.themeMenu.contains(event.target) && !elements.menuButton.contains(event.target)) {
        toggleMenu(false);
      }
    });

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (state.theme === "system") {
        applyTheme("system");
        updateThemeSelectionUI();
      }
    });
  }

  function init() {
    applyTheme(state.theme);
    updateThemeSelectionUI();
    switchTab(state.activeTab);
    renderLiveTimes();
    renderLastUpdated();
    bindEvents();
    loadDashboardData();
    window.setInterval(() => {
      state.nextRefreshSeconds = Math.max(state.nextRefreshSeconds - 1, 0);
      renderLiveTimes();
      renderLastUpdated();
    }, 1000);
    window.setInterval(loadDashboardData, refreshIntervalMs);
  }

  init();
})();
