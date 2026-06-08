# Metal Pulse India Setup Guide

This project is a responsive precious metals dashboard built with plain HTML, CSS, and JavaScript, served through a lightweight Node.js server so API keys stay on the server and are not exposed in the browser.

## 1. Prerequisites

Install the following tools before opening the project in Visual Studio Code:

- Node.js 18 LTS or newer
- npm (included with Node.js)
- Git
- Visual Studio Code

Recommended VS Code extensions:

- Live Server
- Prettier - Code formatter
- ESLint
- EditorConfig for VS Code

## 2. Clone The Project

If the project is hosted in Git, clone it with:

```bash
git clone <your-repository-url>
cd Metalwebsite
```

If you already have the folder locally, open it directly in VS Code:

```bash
code .
```

## 3. Install Dependencies

This project uses only the built-in Node.js runtime for serving files, so package installation is minimal:

```bash
npm install
```

## 4. Configure Environment Variables

Copy the sample environment file:

```bash
cp .env.example .env
```

On Windows PowerShell, you can use:

```powershell
Copy-Item .env.example .env
```

Open `.env` and update the keys and endpoints:

- `PORT`: local server port
- `METAL_API_BASE_URL`: GoldAPI base URL, usually `https://www.goldapi.io`
- `METAL_API_KEY`: your GoldAPI key
- `INDIA_GOLD_ENDPOINT`: endpoint for India gold rates
- `INDIA_SILVER_ENDPOINT`: endpoint for India silver rates
- `US_GOLD_ENDPOINT`: endpoint for US gold market rates
- `US_SILVER_ENDPOINT`: endpoint for US silver market rates
- `USD_INR_ENDPOINT`: exchange rate endpoint for USD to INR conversion
- `COINS_ENDPOINT`: optional endpoint for custom live coin rates
- `NEWS_ENDPOINT`: full URL for a precious metals news feed
- `REFRESH_INTERVAL_MS`: auto refresh interval in milliseconds

### API Notes

- GoldAPI uses the `x-access-token` header. The app now sends this header from `server.js`, not from the browser.
- Default endpoints are configured for:
  - `XAU/INR` for India gold
  - `XAG/INR` for India silver
  - `XAU/USD` for US gold
  - `XAG/USD` for US silver
- If no news API is configured, the news tab still works with built-in sample headlines.

## 5. Run The Project

Start the local development server:

```bash
npm run dev
```

Open the browser at:

```text
http://localhost:3000
```

If you changed `PORT`, use that value instead.

## 6. Run In VS Code

Suggested workflow in Visual Studio Code:

1. Open the folder in VS Code.
2. Open the integrated terminal with `` Ctrl + ` ``.
3. Run:

```bash
npm run dev
```

4. Open `http://localhost:3000` in your browser.
5. Edit `index.html`, `styles.css`, `script.js`, or `.env`.
6. Restart the server after `.env` changes so updated keys are loaded.

## 7. File Overview

- `index.html`: application structure and tab layout
- `styles.css`: responsive styles, theme system, and mobile-first design
- `script.js`: tab logic, theme persistence, auto refresh, fetching, rendering, pagination
- `server.js`: static file server, GoldAPI proxy endpoint, and runtime environment loading
- `.env.example`: sample configuration values

## 8. Debugging Tips

### Browser debugging

- Open DevTools with `F12`
- Check the Console tab for API or JavaScript errors
- Check the Network tab to verify external API responses

### VS Code debugging

To debug the Node server:

1. Open the Run and Debug panel in VS Code.
2. Create a `launch.json` if prompted.
3. Choose `Node.js`.
4. Set the program to `server.js`.
5. Start debugging and inspect logs in the Debug Console.

## 9. Common Issues And Fixes

### `npm run dev` does not start

- Confirm Node.js is installed:

```bash
node -v
```

- Confirm npm is installed:

```bash
npm -v
```

### Port already in use

- Change `PORT` in `.env` to a different value such as `3001`.

### Live prices are not loading

- Verify `METAL_API_KEY` is correct.
- Verify GoldAPI endpoints are valid.
- Confirm the server is running because GoldAPI requests are proxied through `server.js`.
- Inspect the browser console and network responses.
- The app will automatically fall back to demo market values if live data fails.

### News tab is empty or outdated

- Confirm `NEWS_ENDPOINT` includes a valid API key if required.
- Verify the news API returns an `articles` or `data` array.
- If the news API fails, the app will display built-in sample articles.

### Theme setting is not remembered

- Ensure the browser allows `localStorage`.
- Avoid running in private browsing mode if storage is blocked.

## 10. Recommended Production Improvements

- Add a backend proxy for third-party APIs to avoid exposing provider details
- Add rate limiting and caching for external API requests
- Add unit tests for rendering helpers and fetch formatters
- Add analytics and monitoring for API failures
