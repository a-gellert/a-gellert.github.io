/**
 * TinyAnalytics configuration.
 * Loaded before js/analytics.js on every page.
 *
 * The default is fully local: no network requests, no cookies.
 * To collect events from all visitors, deploy your own collector and set:
 *
 *   endpoint: 'https://your-collector.example.workers.dev/collect'
 *
 * The collector receives a JSON event with a random visitor_id and session_id.
 * Do not put secrets or personal data in this file.
 */
window.SITE_ANALYTICS_CONFIG = {
    site: 'a-gellert.github.io',
    endpoint: '',
    sessionTimeout: 30 * 60 * 1000,
    maxEvents: 6000,
    respectDoNotTrack: true,
    debug: false
};
