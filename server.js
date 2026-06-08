const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const projectRoot = __dirname;
const envPath = path.join(projectRoot, ".env");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const env = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    env[key] = rawValue.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }

  return env;
}

const fileEnv = parseEnvFile(envPath);
const appEnv = { ...fileEnv, ...process.env };
const preferredPort = Number(appEnv.PORT) || 3000;
const maxPortAttempts = 10;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function sendFile(response, absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("404 Not Found");
    return;
  }

  const extension = path.extname(absolutePath).toLowerCase();
  const type = contentTypes[extension] || "application/octet-stream";
  response.writeHead(200, { "Content-Type": type });
  fs.createReadStream(absolutePath).pipe(response);
}

function sendConfig(response) {
  const config = {
    newsEndpoint: appEnv.NEWS_ENDPOINT || "",
    refreshIntervalMs: Number(appEnv.REFRESH_INTERVAL_MS) || 60000
  };

  response.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
  response.end(`window.APP_CONFIG = ${JSON.stringify(config, null, 2)};`);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function fetchJson(url, options = {}) {
  const apiResponse = await fetch(url, options);
  if (!apiResponse.ok) {
    const message = await apiResponse.text();
    throw new Error(`Upstream request failed with ${apiResponse.status}: ${message}`);
  }
  return apiResponse.json();
}

function buildApiUrl(endpoint) {
  if (!endpoint) {
    return "";
  }

  if (/^https?:\/\//i.test(endpoint)) {
    return endpoint;
  }

  const baseUrl = appEnv.METAL_API_BASE_URL || "";
  return `${baseUrl.replace(/\/$/, "")}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
}

function ouncesToGrams(value) {
  return Number(value) / 31.1034768;
}

function round(value, digits = 2) {
  return Number(Number(value).toFixed(digits));
}

function mapGoldApiRate(rawData, marketType) {
  const currency = rawData.currency || (marketType.includes("india") ? "INR" : "USD");
  const isGold = rawData.metal === "XAU";
  const isIndia = marketType.startsWith("india");
  const unit = isIndia ? "gram" : "troy_ounce";
  const liveValue = isIndia
    ? isGold
      ? Number(rawData.price_gram_24k)
      : ouncesToGrams(rawData.price)
    : Number(rawData.price);
  const openValue = isIndia
    ? isGold
      ? Number(rawData.open_price) / 31.1034768
      : ouncesToGrams(rawData.open_price)
    : Number(rawData.open_price);
  const highValue = isIndia
    ? isGold
      ? Number(rawData.high_price) / 31.1034768
      : ouncesToGrams(rawData.high_price)
    : Number(rawData.high_price);
  const lowValue = isIndia
    ? isGold
      ? Number(rawData.low_price) / 31.1034768
      : ouncesToGrams(rawData.low_price)
    : Number(rawData.low_price);

  return {
    marketType,
    metal: rawData.metal,
    currency,
    exchange: rawData.exchange || (isIndia ? "India reference" : "FOREXCOM"),
    unit,
    price: round(liveValue, 2),
    openPrice: round(openValue || liveValue * 0.992, 2),
    highPrice: round(highValue || liveValue * 1.008, 2),
    lowPrice: round(lowValue || liveValue * 0.989, 2),
    change: round(Number(rawData.ch) || 0, 2),
    changePercent: round(Number(rawData.chp) || 0, 2),
    priceGram24k: isGold ? round(Number(rawData.price_gram_24k) || liveValue, 2) : null,
    priceGram22k: isGold ? round(Number(rawData.price_gram_22k) || liveValue * 0.916, 2) : null,
    timestamp: rawData.timestamp ? new Date(Number(rawData.timestamp) * 1000).toISOString() : new Date().toISOString(),
    source: "GoldAPI"
  };
}

async function handleMarketData(response) {
  try {
    if (!appEnv.METAL_API_KEY) {
      throw new Error("GoldAPI key is not configured in .env");
    }

    const headers = {
      "x-access-token": appEnv.METAL_API_KEY,
      Accept: "application/json"
    };

    const [indiaGoldRaw, indiaSilverRaw, usGoldRaw, usSilverRaw, usdInrRaw] = await Promise.all([
      fetchJson(buildApiUrl(appEnv.INDIA_GOLD_ENDPOINT), { headers }),
      fetchJson(buildApiUrl(appEnv.INDIA_SILVER_ENDPOINT), { headers }),
      fetchJson(buildApiUrl(appEnv.US_GOLD_ENDPOINT), { headers }),
      fetchJson(buildApiUrl(appEnv.US_SILVER_ENDPOINT), { headers }),
      fetchJson(appEnv.USD_INR_ENDPOINT)
    ]);

    const usdInr = Number(
      usdInrRaw?.rates?.INR ?? usdInrRaw?.conversion_rates?.INR ?? usdInrRaw?.data?.INR ?? 83.45
    );

    const payload = {
      usdInr: round(usdInr, 4),
      indiaGold: mapGoldApiRate(indiaGoldRaw, "india_gold"),
      indiaSilver: mapGoldApiRate(indiaSilverRaw, "india_silver"),
      usGold: mapGoldApiRate(usGoldRaw, "us_gold"),
      usSilver: mapGoldApiRate(usSilverRaw, "us_silver")
    };

    sendJson(response, 200, payload);
  } catch (error) {
    sendJson(response, 502, {
      error: "Unable to fetch live market data",
      details: error.message
    });
  }
}

function getSafeFilePath(urlPath) {
  const normalizedPath = urlPath === "/" ? "/index.html" : urlPath;
  const absolutePath = path.join(projectRoot, normalizedPath);
  return absolutePath.startsWith(projectRoot) ? absolutePath : null;
}

function requestHandler(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (requestUrl.pathname === "/config.js") {
    sendConfig(response);
    return;
  }

  if (requestUrl.pathname === "/api/market-data") {
    handleMarketData(response);
    return;
  }

  const absolutePath = getSafeFilePath(requestUrl.pathname);

  if (!absolutePath) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("403 Forbidden");
    return;
  }

  sendFile(response, absolutePath);
}

function startServer(port, attempt = 0) {
  const server = http.createServer(requestHandler);

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && attempt < maxPortAttempts) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is already in use. Trying http://localhost:${nextPort} instead...`);
      startServer(nextPort, attempt + 1);
      return;
    }

    throw error;
  });

  server.listen(port, () => {
    console.log(`Metal website running at http://localhost:${port}`);
  });
}

startServer(preferredPort);
