/**
 * TinyAnalytics — a privacy-first, GameAnalytics-style event pipeline for the
 * static portfolio. No cookies, no fingerprints, no third-party requests by
 * default. Events are stored locally in localStorage and can optionally be
 * mirrored to your own collector endpoint via sendBeacon/fetch.
 *
 * Public API: window.TinyAnalytics
 */
(function () {
    'use strict';

    if (window.__TINY_ANALYTICS_BOOTED__) return;
    window.__TINY_ANALYTICS_BOOTED__ = true;

    const CONFIG = Object.assign({
        endpoint: '',
        site: 'a-gellert.github.io',
        sessionTimeout: 30 * 60 * 1000,
        maxEvents: 6000,
        respectDoNotTrack: true,
        debug: false
    }, window.SITE_ANALYTICS_CONFIG || {});

    const KEYS = {
        events: 'tga.events.v1',
        demo: 'tga.demo.v1',
        visitor: 'tga.visitor.v1',
        session: 'tga.session.v1',
        optOut: 'tga.optout.v1'
    };

    const DAY = 24 * 60 * 60 * 1000;

    /* ------------------------------------------------------------------
       Storage helpers
       ------------------------------------------------------------------ */
    function readJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const value = JSON.parse(raw);
            return value == null ? fallback : value;
        } catch (error) {
            return fallback;
        }
    }

    function writeJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            // Quota exceeded: keep the newest half and retry once.
            if (Array.isArray(value)) {
                try {
                    const trimmed = value.slice(-Math.floor(value.length / 2));
                    localStorage.setItem(key, JSON.stringify(trimmed));
                    return true;
                } catch (inner) {
                    return false;
                }
            }
            return false;
        }
    }

    function uid(prefix) {
        const random = (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
            : Math.random().toString(36).slice(2, 14);
        return `${prefix}_${Date.now().toString(36)}_${random}`;
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function dayKey(timestamp) {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function startOfDay(timestamp) {
        const date = new Date(timestamp);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    }

    function formatDay(timestamp) {
        return new Date(timestamp).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    }

    function isOptedOut() {
        if (localStorage.getItem(KEYS.optOut) === '1') return true;
        if (!CONFIG.respectDoNotTrack) return false;
        const dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
        return dnt === '1' || dnt === 'yes' || navigator.globalPrivacyControl === true;
    }

    /* ------------------------------------------------------------------
       Visitor & session
       ------------------------------------------------------------------ */
    function getVisitor() {
        let visitor = readJSON(KEYS.visitor, null);
        if (!visitor || !visitor.id) {
            visitor = {
                id: uid('visitor'),
                firstSeen: Date.now(),
                lastSeen: Date.now()
            };
            writeJSON(KEYS.visitor, visitor);
        }
        return visitor;
    }

    function touchVisitor(visitor) {
        visitor.lastSeen = Date.now();
        writeJSON(KEYS.visitor, visitor);
    }

    // sessionStorage can throw in some privacy modes; fall back to memory.
    let memorySession = null;

    function readSessionStore() {
        try {
            const raw = sessionStorage.getItem(KEYS.session);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return memorySession;
        }
    }

    function writeSessionStore(session) {
        memorySession = session;
        try { sessionStorage.setItem(KEYS.session, JSON.stringify(session)); } catch (error) { /* ignore */ }
    }

    function clearSessionStore() {
        memorySession = null;
        try { sessionStorage.removeItem(KEYS.session); } catch (error) { /* ignore */ }
    }

    function getSession() {
        const now = Date.now();
        const session = readSessionStore();
        if (!session || !session.id) return null;
        if (now - session.lastActivity > CONFIG.sessionTimeout) return null;
        return session;
    }

    function ensureSession() {
        const now = Date.now();
        let session = getSession();

        if (!session) {
            session = {
                id: uid('session'),
                start: now,
                lastActivity: now,
                pages: 0,
                landing: location.pathname || '/'
            };
            writeSessionStore(session);
            track('session', 'session_start', {
                landing: session.landing,
                referrer: externalReferrer()
            }, { silent: true });
        } else {
            session.lastActivity = now;
            session.pages += 1;
            writeSessionStore(session);
        }
        return session;
    }

    function externalReferrer() {
        if (!document.referrer) return '';
        try {
            const url = new URL(document.referrer);
            return url.origin === location.origin ? '' : url.hostname;
        } catch (error) {
            return '';
        }
    }

    /* ------------------------------------------------------------------
       Event writing
       ------------------------------------------------------------------ */
    function track(category, event, props, options) {
        if (isOptedOut() || isDashboardPage()) return null;
        if (!category || !event) return null;

        const session = getSession() || ensureSession();
        const visitor = getVisitor();
        touchVisitor(visitor);

        const payload = {
            id: uid('evt'),
            ts: Date.now(),
            visitor_id: visitor.id,
            session_id: session.id,
            category,
            event,
            severity: (options && options.severity) || 'info',
            page: location.pathname || '/',
            path: location.pathname || '/',
            title: (document.title || '').slice(0, 180),
            referrer: externalReferrer(),
            props: props || {},
            demo: false
        };

        if (CONFIG.debug) console.debug('[TinyAnalytics]', payload);

        const events = readJSON(KEYS.events, []);
        events.push(payload);
        if (events.length > CONFIG.maxEvents) events.splice(0, events.length - CONFIG.maxEvents);
        writeJSON(KEYS.events, events);
        mirror(payload);
        return payload;
    }

    function mirror(event) {
        if (!CONFIG.endpoint) return;
        try {
            const body = JSON.stringify(event);
            if (navigator.sendBeacon) {
                navigator.sendBeacon(CONFIG.endpoint, new Blob([body], { type: 'application/json' }));
            } else {
                fetch(CONFIG.endpoint, {
                    method: 'POST',
                    keepalive: true,
                    headers: { 'Content-Type': 'application/json' },
                    body
                }).catch(() => {});
            }
        } catch (error) {
            // Analytics must never break the page.
        }
    }

    /* ------------------------------------------------------------------
       Automatic tracking
       ------------------------------------------------------------------ */
    const scrollMilestones = new Set();
    let pageEnteredAt = Date.now();
    let activeSeconds = 0;
    let lastActiveTick = Date.now();
    let articleState = null;
    let articleScrollHandler = null;

    function pageView() {
        ensureSession();

        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        track('session', 'page_view', {
            title: (document.title || '').slice(0, 180),
            referrer: externalReferrer(),
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            screen: `${screen.width}x${screen.height}`,
            language: navigator.language || '',
            platform: navigator.platform || '',
            connection: connection ? connection.effectiveType || '' : ''
        });
    }

    function initScrollDepth() {
        const onScroll = () => {
            const scrollable = document.documentElement.scrollHeight - window.innerHeight;
            if (scrollable <= 0) return;
            const depth = clamp(Math.round((window.scrollY / scrollable) * 100), 0, 100);
            [25, 50, 75, 100].forEach((milestone) => {
                if (depth >= milestone && !scrollMilestones.has(milestone)) {
                    scrollMilestones.add(milestone);
                    track('design', 'scroll_depth', { depth: milestone });
                }
            });
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    function initOutboundTracking() {
        document.addEventListener('click', (event) => {
            const link = event.target.closest('a[href]');
            if (!link) return;
            const href = link.getAttribute('href') || '';
            if (href.startsWith('#') || href.startsWith('mailto:')) {
                if (href.startsWith('mailto:')) {
                    track('business', 'email_click', { label: 'email' });
                }
                return;
            }

            let url;
            try {
                url = new URL(link.href, location.href);
            } catch (error) {
                return;
            }

            if (url.origin === location.origin) return;

            const host = url.hostname.replace(/^www\./, '');
            let type = 'external';
            if (host === 't.me' || host === 'telegram.me') type = 'telegram';
            else if (host.includes('play.google.com') || host.includes('apps.apple.com')) type = 'store';
            else if (host.includes('github.com')) type = 'github';
            else if (host.includes('youtube.com') || host.includes('youtu.be')) type = 'video';

            track('business', 'outbound_click', {
                host,
                type,
                label: (link.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 70),
                target: url.pathname
            });

            if (type === 'store') track('business', 'store_click', { host, label: (link.textContent || '').trim().slice(0, 70) });
            if (type === 'telegram') track('business', 'social_click', { host, network: 'telegram' });
        }, true);
    }

    function initErrorTracking() {
        window.addEventListener('error', (event) => {
            track('error', 'js_error', {
                message: String(event.message || 'unknown').slice(0, 220),
                source: String(event.filename || '').slice(-140),
                line: event.lineno || 0,
                column: event.colno || 0
            }, { severity: 'error' });
        });

        window.addEventListener('unhandledrejection', (event) => {
            const reason = event.reason && event.reason.message
                ? event.reason.message
                : String(event.reason || 'unhandled rejection');
            track('error', 'promise_rejection', { message: reason.slice(0, 220) }, { severity: 'error' });
        });
    }

    function initEngagement() {
        const tick = () => {
            const now = Date.now();
            if (document.visibilityState === 'visible') {
                const delta = Math.min(now - lastActiveTick, 5000);
                activeSeconds += Math.max(0, delta) / 1000;
            }
            lastActiveTick = now;
        };

        setInterval(tick, 1000);

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                track('session', 'page_hide', {
                    time_on_page: Math.round((Date.now() - pageEnteredAt) / 1000),
                    active_seconds: Math.round(activeSeconds)
                });
            } else {
                lastActiveTick = Date.now();
                track('session', 'page_show', {});
            }
        });

        window.addEventListener('pagehide', () => {
            track('session', 'page_exit', {
                time_on_page: Math.round((Date.now() - pageEnteredAt) / 1000),
                active_seconds: Math.round(activeSeconds)
            });
        });
    }

    function initPerformance() {
        window.addEventListener('load', () => {
            const nav = performance.getEntriesByType('navigation')[0];
            const loadMs = nav ? Math.round(nav.loadEventEnd || nav.duration || 0) : 0;
            track('performance', 'page_load', { duration_ms: loadMs }, { severity: loadMs > 3000 ? 'warning' : 'info' });
        }, { once: true });

        if ('PerformanceObserver' in window) {
            try {
                const lcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const last = entries[entries.length - 1];
                    if (!last) return;
                    track('performance', 'web_vital', {
                        metric: 'LCP',
                        value: Math.round(last.startTime),
                        rating: last.startTime < 2500 ? 'good' : last.startTime < 4000 ? 'needs-improvement' : 'poor'
                    });
                    lcpObserver.disconnect();
                });
                lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
            } catch (error) { /* ignore */ }
        }
    }

    function articleOpen(id, meta) {
        if (articleState && articleState.id === id) return;
        if (articleState) articleClose();
        articleState = {
            id: String(id || 'unknown'),
            openedAt: Date.now(),
            maxDepth: 0,
            meta: meta || {}
        };
        scrollMilestones.clear();

        track('progression', 'article_open', {
            article_id: articleState.id,
            category: meta && meta.category ? meta.category : '',
            title: meta && meta.title ? String(meta.title).slice(0, 160) : ''
        });

        const modal = document.getElementById('article-modal');
        const content = modal && modal.querySelector('.modal-content');
        if (!content) return;

        const readDepth = new Set();
        articleScrollHandler = () => {
            const scrollable = content.scrollHeight - content.clientHeight;
            const depth = scrollable > 0 ? clamp(Math.round((content.scrollTop / scrollable) * 100), 0, 100) : 100;
            articleState.maxDepth = Math.max(articleState.maxDepth, depth);
            [25, 50, 75, 100].forEach((milestone) => {
                if (depth >= milestone && !readDepth.has(milestone)) {
                    readDepth.add(milestone);
                    track('progression', 'article_depth', {
                        article_id: articleState.id,
                        depth: milestone
                    });
                }
            });
        };
        content.addEventListener('scroll', articleScrollHandler, { passive: true });
        articleScrollHandler();
    }

    function articleClose() {
        if (!articleState) return;
        const state = articleState;
        const duration = Math.round((Date.now() - state.openedAt) / 1000);

        if (articleScrollHandler) {
            const modal = document.getElementById('article-modal');
            const content = modal && modal.querySelector('.modal-content');
            if (content) content.removeEventListener('scroll', articleScrollHandler);
            articleScrollHandler = null;
        }

        track('progression', 'article_close', {
            article_id: state.id,
            duration_seconds: duration,
            max_depth: state.maxDepth
        });

        if (state.maxDepth >= 75 || duration >= 45) {
            track('progression', 'article_complete', {
                article_id: state.id,
                duration_seconds: duration,
                max_depth: state.maxDepth
            });
        }

        articleState = null;
    }

    function isDashboardPage() {
        return /^\/analytics(\/|$)/.test(location.pathname);
    }

    function start() {
        if (isOptedOut() || isDashboardPage()) return;
        pageView();
        initScrollDepth();
        initOutboundTracking();
        initErrorTracking();
        initEngagement();
        initPerformance();
    }

    /* ------------------------------------------------------------------
       Aggregations for the dashboard
       ------------------------------------------------------------------ */
    function getEvents(options) {
        const source = options && options.demo ? KEYS.demo : KEYS.events;
        const events = readJSON(source, []);
        if (!Array.isArray(events)) return [];
        return events.slice().sort((a, b) => a.ts - b.ts);
    }

    function getDemoEvents() {
        return getEvents({ demo: true });
    }

    function withinDays(events, days) {
        const cutoff = startOfDay(Date.now()) - (days - 1) * DAY;
        return events.filter((event) => event.ts >= cutoff);
    }

    function uniqueVisitors(events) {
        return new Set(events.map((event) => event.visitor_id)).size;
    }

    function getSessions(options) {
        const events = getEvents(options);
        const map = new Map();

        events.forEach((event) => {
            let session = map.get(event.session_id);
            if (!session) {
                session = {
                    id: event.session_id,
                    visitor_id: event.visitor_id,
                    start: event.ts,
                    end: event.ts,
                    pages: new Set(),
                    events: 0,
                    pageSeconds: 0,
                    articleOpens: 0,
                    outbound: 0
                };
                map.set(event.session_id, session);
            }
            session.start = Math.min(session.start, event.ts);
            session.end = Math.max(session.end, event.ts);
            session.events += 1;
            if (event.event === 'page_view') session.pages.add(event.path);
            if (event.event === 'page_exit' && event.props && event.props.time_on_page) {
                session.pageSeconds += Number(event.props.time_on_page) || 0;
            }
            if (event.event === 'article_open') session.articleOpens += 1;
            if (event.event === 'outbound_click' || event.event === 'store_click') session.outbound += 1;
        });

        return Array.from(map.values()).map((session) => ({
            ...session,
            pages: session.pages.size,
            duration: session.pageSeconds > 0 ? session.pageSeconds : Math.round((session.end - session.start) / 1000)
        }));
    }

    function getRetention(days, options) {
        const events = withinDays(getEvents(options), days);
        const cutoff = startOfDay(Date.now()) - (days - 1) * DAY;
        const visitors = new Map();

        events.forEach((event) => {
            let visitor = visitors.get(event.visitor_id);
            if (!visitor) {
                visitor = { first: event.ts, days: new Set() };
                visitors.set(event.visitor_id, visitor);
            }
            visitor.first = Math.min(visitor.first, event.ts);
            visitor.days.add(dayKey(event.ts));
        });

        const cohortVisitors = Array.from(visitors.values())
            .filter((visitor) => visitor.first >= cutoff);

        const offsets = [0, 1, 3, 7, 14, 28];

        const curve = offsets.map((offset) => {
            let retained = 0;
            cohortVisitors.forEach((visitor) => {
                const day = dayKey(visitor.first + offset * DAY);
                if (visitor.days.has(day)) retained += 1;
            });
            return {
                offset,
                users: retained,
                total: cohortVisitors.length,
                pct: cohortVisitors.length ? Math.round((retained / cohortVisitors.length) * 100) : 0
            };
        });

        const cohortMap = new Map();
        cohortVisitors.forEach((visitor) => {
            const key = dayKey(visitor.first);
            let cohort = cohortMap.get(key);
            if (!cohort) {
                cohort = { cohort: key, size: 0, retained: {} };
                cohortMap.set(key, cohort);
            }
            cohort.size += 1;
            offsets.forEach((offset) => {
                if (visitor.days.has(dayKey(visitor.first + offset * DAY))) {
                    cohort.retained[offset] = (cohort.retained[offset] || 0) + 1;
                }
            });
        });

        const cohorts = Array.from(cohortMap.values())
            .sort((a, b) => b.cohort.localeCompare(a.cohort))
            .map((cohort) => {
                const pct = {};
                offsets.forEach((offset) => {
                    const value = cohort.retained[offset] || 0;
                    pct[offset] = cohort.size ? Math.round((value / cohort.size) * 100) : 0;
                });
                return { ...cohort, pct };
            });

        return { curve, cohorts, visitors: cohortVisitors.length };
    }

    function getDailySeries(days, options) {
        const events = withinDays(getEvents(options), days);
        const map = new Map();
        const today = startOfDay(Date.now());

        for (let i = days - 1; i >= 0; i -= 1) {
            const ts = today - i * DAY;
            map.set(dayKey(ts), {
                key: dayKey(ts),
                label: formatDay(ts),
                visitors: new Set(),
                sessions: new Set(),
                events: 0,
                articleOpens: 0,
                outbound: 0
            });
        }

        events.forEach((event) => {
            const key = dayKey(event.ts);
            const bucket = map.get(key);
            if (!bucket) return;
            bucket.visitors.add(event.visitor_id);
            bucket.sessions.add(event.session_id);
            bucket.events += 1;
            if (event.event === 'article_open') bucket.articleOpens += 1;
            if (event.event === 'outbound_click' || event.event === 'store_click') bucket.outbound += 1;
        });

        return Array.from(map.values()).map((bucket) => ({
            label: bucket.label,
            key: bucket.key,
            visitors: bucket.visitors.size,
            sessions: bucket.sessions.size,
            events: bucket.events,
            articleOpens: bucket.articleOpens,
            outbound: bucket.outbound
        }));
    }

    function getEventBreakdown(days, options) {
        const events = withinDays(getEvents(options), days);
        const map = new Map();

        events.forEach((event) => {
            const key = `${event.category}:${event.event}`;
            let row = map.get(key);
            if (!row) {
                row = {
                    key,
                    category: event.category,
                    event: event.event,
                    count: 0,
                    visitors: new Set(),
                    severity: event.severity || 'info'
                };
                map.set(key, row);
            }
            row.count += 1;
            row.visitors.add(event.visitor_id);
        });

        return Array.from(map.values())
            .map((row) => ({ ...row, visitors: row.visitors.size }))
            .sort((a, b) => b.count - a.count);
    }

    function getPages(days, options) {
        const events = withinDays(getEvents(options), days);
        const map = new Map();

        events.forEach((event) => {
            if (event.event !== 'page_view') return;
            const path = event.path || '/';
            let row = map.get(path);
            if (!row) {
                row = { path, views: 0, visitors: new Set(), sessions: new Set() };
                map.set(path, row);
            }
            row.views += 1;
            row.visitors.add(event.visitor_id);
            row.sessions.add(event.session_id);
        });

        const totalViews = Array.from(map.values()).reduce((sum, row) => sum + row.views, 0);

        return Array.from(map.values())
            .map((row) => ({
                path: row.path,
                views: row.views,
                visitors: row.visitors.size,
                sessions: row.sessions.size,
                share: totalViews ? Math.round((row.views / totalViews) * 100) : 0
            }))
            .sort((a, b) => b.views - a.views);
    }

    function getFunnel(days, options) {
        const events = withinDays(getEvents(options), days);
        const bySession = new Map();

        events.forEach((event) => {
            if (!bySession.has(event.session_id)) bySession.set(event.session_id, []);
            bySession.get(event.session_id).push(event);
        });

        const steps = [
            {
                key: 'visit',
                label: 'Визит на сайт',
                description: 'Любой page_view',
                match: (event) => event.event === 'page_view'
            },
            {
                key: 'article',
                label: 'Открытие статьи',
                description: 'article_open',
                match: (event) => event.event === 'article_open'
            },
            {
                key: 'depth',
                label: 'Глубокое чтение',
                description: 'article_depth ≥ 75%',
                match: (event) => event.event === 'article_depth' && Number(event.props && event.props.depth) >= 75
            },
            {
                key: 'outbound',
                label: 'Переход в Telegram / стор',
                description: 'outbound_click / store_click',
                match: (event) => event.event === 'outbound_click' || event.event === 'store_click'
            }
        ];

        const sessions = Array.from(bySession.values());
        const counts = steps.map(() => 0);

        sessions.forEach((sessionEvents) => {
            let stepIndex = 0;
            sessionEvents
                .slice()
                .sort((a, b) => a.ts - b.ts)
                .forEach((event) => {
                    if (stepIndex >= steps.length) return;
                    if (steps[stepIndex].match(event)) {
                        counts[stepIndex] += 1;
                        stepIndex += 1;
                    }
                });
        });

        return {
            steps: steps.map((step, index) => {
                const previous = index === 0 ? counts[0] : counts[index - 1];
                return {
                    ...step,
                    count: counts[index],
                    conversion: counts[0] ? Math.round((counts[index] / counts[0]) * 100) : 0,
                    dropoff: previous ? Math.round(((previous - counts[index]) / previous) * 100) : 0
                };
            }),
            sessions: sessions.length
        };
    }

    function getSummary(days, options) {
        const events = withinDays(getEvents(options), days);
        const sessions = getSessions(options).filter((session) => session.start >= startOfDay(Date.now()) - (days - 1) * DAY);
        const retention = getRetention(days, options);
        const pageViews = events.filter((event) => event.event === 'page_view').length;
        const articleOpens = events.filter((event) => event.event === 'article_open').length;
        const outbound = events.filter((event) => event.event === 'outbound_click' || event.event === 'store_click').length;
        const errors = events.filter((event) => event.category === 'error').length;
        const totalSessionSeconds = sessions.reduce((sum, session) => sum + session.duration, 0);
        const avgSession = sessions.length ? Math.round(totalSessionSeconds / sessions.length) : 0;
        const bounceSessions = sessions.filter((session) => session.pages <= 1).length;
        const d1 = retention.curve.find((point) => point.offset === 1)?.pct || 0;
        const d7 = retention.curve.find((point) => point.offset === 7)?.pct || 0;
        const d28 = retention.curve.find((point) => point.offset === 28)?.pct || 0;

        return {
            visitors: uniqueVisitors(events),
            sessions: sessions.length,
            events: events.length,
            pageViews,
            articleOpens,
            outbound,
            errors,
            avgSession,
            bounceRate: sessions.length ? Math.round((bounceSessions / sessions.length) * 100) : 0,
            d1,
            d7,
            d28,
            retentionVisitors: retention.visitors
        };
    }

    function getRealtime(minutes, options) {
        const cutoff = Date.now() - (minutes || 5) * 60 * 1000;
        const events = getEvents(options).filter((event) => event.ts >= cutoff);
        return {
            events,
            activeSessions: new Set(events.map((event) => event.session_id)).size,
            activeVisitors: new Set(events.map((event) => event.visitor_id)).size
        };
    }

    function getCategoryTotals(days, options) {
        const events = withinDays(getEvents(options), days);
        const map = new Map();
        events.forEach((event) => {
            map.set(event.category, (map.get(event.category) || 0) + 1);
        });
        return Array.from(map.entries())
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count);
    }

    /* ------------------------------------------------------------------
       Demo data
       ------------------------------------------------------------------ */
    function seedDemo(days) {
        const span = days || 30;
        const now = Date.now();
        const events = [];
        const categories = ['devlog', 'how-to', 'assets', 'analytics'];
        const articles = [
            'game-trends-analytics-q4',
            'smash-arena-netcode-defold',
            'godot4-mobile-optimization',
            'free-vfx-and-shaders-mobile',
            'numbert-math-puzzle-architecture',
            'ragdoll-physics-sandbox-breakdown'
        ];
        const paths = ['/', '/blog/', '/trends/', '/analytics/', '/privacy/perimeter/', '/privacy/numbert/'];
        const visitorCount = 110;

        const push = (ts, visitor, session, category, event, props, severity) => {
            events.push({
                id: uid('evt'),
                ts,
                visitor_id: visitor,
                session_id: session,
                category,
                event,
                severity: severity || 'info',
                page: props && props.path ? props.path : '/',
                path: props && props.path ? props.path : '/',
                title: props && props.title ? props.title : 'Demo',
                referrer: props && props.referrer ? props.referrer : '',
                props: props || {},
                demo: true
            });
        };

        for (let v = 0; v < visitorCount; v += 1) {
            const visitor = `demo_visitor_${v}`;
            const firstOffset = Math.floor(Math.random() * span);
            const firstDay = startOfDay(now) - firstOffset * DAY;
            const hour = 8 + Math.floor(Math.random() * 14);
            const rawFirstTs = firstDay + hour * 60 * 60 * 1000 + Math.floor(Math.random() * 50 * 60 * 1000);
            const firstTs = Math.min(rawFirstTs, now - 5 * 60 * 1000);

            const device = Math.random() < 0.62 ? 'mobile' : Math.random() < 0.82 ? 'desktop' : 'tablet';
            const viewport = device === 'mobile' ? '390x844' : device === 'tablet' ? '820x1180' : '1440x900';

            for (let dayOffset = 0; dayOffset < span - firstOffset; dayOffset += 1) {
                const probability = dayOffset === 0 ? 0.95 : Math.max(0.04, 0.30 * Math.pow(0.84, dayOffset));
                if (Math.random() > probability) continue;

                const session = `demo_session_${v}_${dayOffset}`;
                const dayStart = startOfDay(firstTs) + dayOffset * DAY;
                let ts = dayStart + (8 + Math.floor(Math.random() * 14)) * 60 * 60 * 1000 + Math.floor(Math.random() * 50 * 60 * 1000);
                const sessionLength = 1 + Math.floor(Math.random() * 4);

                for (let step = 0; step < sessionLength; step += 1) {
                    const path = step === 0 ? '/' : paths[Math.floor(Math.random() * paths.length)];
                    const title = path === '/' ? 'Alexander Gellert — Portfolio' : `Page ${path}`;
                    push(ts, visitor, session, 'session', 'page_view', {
                        path,
                        title,
                        viewport,
                        screen: viewport,
                        language: 'ru-RU',
                        platform: device,
                        connection: Math.random() < 0.7 ? '4g' : 'wifi'
                    });
                    ts += 20 * 1000 + Math.floor(Math.random() * 90 * 1000);

                    if (Math.random() < 0.62) {
                        const articleIndex = Math.floor(Math.random() * articles.length);
                        const articleId = articles[articleIndex];
                        const articleCategory = categories[articleIndex % categories.length];
                        push(ts, visitor, session, 'progression', 'article_open', {
                            path: '/blog/',
                            article_id: articleId,
                            category: articleCategory,
                            title: articleId
                        });
                        ts += 15 * 1000;

                        const depthRoll = Math.random();
                        if (depthRoll < 0.82) {
                            [25, 50, 75, 100].forEach((depth) => {
                                if (Math.random() < 0.82) {
                                    push(ts, visitor, session, 'progression', 'article_depth', {
                                        path: '/blog/',
                                        article_id: articleId,
                                        depth
                                    });
                                }
                            });
                        }

                        ts += 60 * 1000 + Math.floor(Math.random() * 180 * 1000);
                        if (Math.random() < 0.30) {
                            push(ts, visitor, session, 'business', 'outbound_click', {
                                path: '/blog/',
                                host: Math.random() < 0.55 ? 't.me' : 'play.google.com',
                                type: Math.random() < 0.55 ? 'telegram' : 'store',
                                label: Math.random() < 0.55 ? 'Telegram @tiny_game' : 'Google Play'
                            });
                            if (Math.random() < 0.55) {
                                push(ts + 500, visitor, session, 'business', 'social_click', { host: 't.me', network: 'telegram' });
                            } else {
                                push(ts + 500, visitor, session, 'business', 'store_click', { host: 'play.google.com' });
                            }
                        }
                    }

                    if (Math.random() < 0.12) {
                        push(ts, visitor, session, 'design', 'search', { path: '/blog/', query_length: 3 + Math.floor(Math.random() * 8) });
                    }

                    if (Math.random() < 0.04) {
                        push(ts, visitor, session, 'error', 'js_error', {
                            path,
                            message: 'Demo: simulated script error',
                            source: 'app.js'
                        }, 'error');
                    }

                    ts += 30 * 1000 + Math.floor(Math.random() * 120 * 1000);
                }

                push(ts, visitor, session, 'session', 'page_exit', {
                    path: '/',
                    time_on_page: 40 + Math.floor(Math.random() * 260),
                    active_seconds: 30 + Math.floor(Math.random() * 200)
                });
            }
        }

        events.sort((a, b) => a.ts - b.ts);
        writeJSON(KEYS.demo, events);
        return events.length;
    }

    function clearDemo() {
        try { localStorage.removeItem(KEYS.demo); } catch (error) { /* ignore */ }
    }

    function clearAll() {
        try {
            localStorage.removeItem(KEYS.events);
            localStorage.removeItem(KEYS.visitor);
            sessionStorage.removeItem(KEYS.session);
        } catch (error) { /* ignore */ }
    }

    function exportData() {
        return {
            exported_at: new Date().toISOString(),
            site: CONFIG.site,
            visitor: readJSON(KEYS.visitor, null),
            events: getEvents({ demo: false }),
            demo: getDemoEvents()
        };
    }

    function optOut() {
        try { localStorage.setItem(KEYS.optOut, '1'); } catch (error) { /* ignore */ }
    }

    function optIn() {
        try { localStorage.removeItem(KEYS.optOut); } catch (error) { /* ignore */ }
    }

    /* ------------------------------------------------------------------
       Public API
       ------------------------------------------------------------------ */
    window.TinyAnalytics = {
        version: '1.0.0',
        config: CONFIG,
        track,
        start,
        articleOpen,
        articleClose,
        getEvents,
        getDemoEvents,
        getSessions,
        getSummary,
        getRetention,
        getDailySeries,
        getEventBreakdown,
        getPages,
        getFunnel,
        getRealtime,
        getCategoryTotals,
        seedDemo,
        clearDemo,
        clearAll,
        exportData,
        optOut,
        optIn,
        isOptedOut
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
