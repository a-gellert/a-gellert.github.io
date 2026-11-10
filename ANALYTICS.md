# TinyAnalytics — site product analytics

TinyAnalytics is a small, privacy-first, GameAnalytics-style analytics layer for the static portfolio. It records product events, computes GameAnalytics-style KPIs and renders them at `/analytics/`.

## What works out of the box

- **Sessions** — `session_start`, `page_view`, `page_hide`, `page_exit`
- **Design events** — scroll depth, search, category filters
- **Progression events** — article open, reading depth, completion, close
- **Business events** — outbound clicks, Google Play clicks, Telegram clicks, email clicks
- **Errors** — JS errors and unhandled promise rejections
- **Performance** — page load time and LCP rating
- **Dashboard** — visitors, sessions, events, average session, D1/D7/D28 retention, bounce rate, retention heatmap, funnel, top pages, event breakdown, realtime feed
- **Demo mode** — `https://a-gellert.github.io/analytics/?demo=1` (or the “Загрузить демо” button)

No cookies. No third-party requests by default. The anonymous visitor/session IDs and events live in `localStorage`.

## Files

| File | Purpose |
| --- | --- |
| `js/analytics-config.js` | Configuration (endpoint, sampling, limits) |
| `js/analytics.js` | Event pipeline, automatic tracking, aggregations, demo generator |
| `analytics/index.html` | Dashboard markup |
| `analytics/app.js` | Dashboard renderer |
| `analytics/style.css` | Dashboard styles |

## Event taxonomy

Events use the GameAnalytics-style shape:

```json
{
  "category": "progression",
  "event": "article_open",
  "severity": "info",
  "page": "/blog/",
  "props": { "article_id": "smash-arena-netcode-defold" },
  "visitor_id": "visitor_...",
  "session_id": "session_...",
  "ts": 1794324094430
}
```

Categories: `session`, `design`, `progression`, `business`, `error`, `performance`.

You can add a custom event from any page:

```js
window.TinyAnalytics.track('business', 'newsletter_click', { placement: 'footer' });
```

## Enable collection from all visitors

The dashboard is local-first. To see events from every visitor, deploy a tiny collector and set its URL in `js/analytics-config.js`:

```js
window.SITE_ANALYTICS_CONFIG = {
    endpoint: 'https://your-collector.example.workers.dev/collect'
};
```

Every event is then sent with `navigator.sendBeacon()` (or `fetch(..., { keepalive: true })` as a fallback). A minimal Cloudflare Worker example:

```js
export default {
    async fetch(request, env) {
        const cors = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        };

        if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
        if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

        const event = await request.json();
        const key = `event:${event.ts}:${event.id}`;
        await env.ANALYTICS_KV.put(key, JSON.stringify(event), { expirationTtl: 60 * 60 * 24 * 90 });

        return new Response(null, { status: 204, headers: cors });
    }
};
```

Create a KV namespace binding named `ANALYTICS_KV` in the Worker settings. For a real dashboard over remote data, add a protected `GET /events` route that lists the KV keys and returns the events; keep the read key in a secret, not in the public config.

## Privacy

- No cookies, no fingerprinting, no precise geolocation, no personal data.
- DNT and Global Privacy Control are respected by default.
- Visitors can opt out from the dashboard or by running `TinyAnalytics.optOut()`.
- `TinyAnalytics.exportData()` returns the local event bundle; `TinyAnalytics.clearAll()` deletes it.
- If you enable a remote endpoint, disclose it in your privacy policy.

## Commands

```bash
npm run build-articles   # regenerate articles.json + per-article JSON from articles-data.js
npm run check-links      # check internal links and legacy .html references
npm run update-trends    # update the market-intelligence data bundle
```
