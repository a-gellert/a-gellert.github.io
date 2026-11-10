/**
 * TinyAnalytics dashboard renderer.
 * Reads the local event store through window.TinyAnalytics and renders a
 * GameAnalytics-style overview: KPIs, retention cohorts, funnels, events.
 */
(function () {
    'use strict';

    const A = window.TinyAnalytics;
    const state = {
        range: 30,
        source: 'real',
        chart: null
    };

    const $ = (id) => document.getElementById(id);

    const fmt = (value) => new Intl.NumberFormat('ru-RU').format(value || 0);

    const duration = (seconds) => {
        const value = Math.max(0, Math.round(seconds || 0));
        if (value < 60) return `${value}с`;
        const minutes = Math.floor(value / 60);
        const rest = value % 60;
        if (minutes < 60) return rest ? `${minutes}м ${rest}с` : `${minutes}м`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins ? `${hours}ч ${mins}м` : `${hours}ч`;
    };

    const formatDate = (key) => {
        if (!key) return '—';
        const [year, month, day] = key.split('-');
        return `${day}.${month}`;
    };

    const formatTime = (ts) => new Date(ts).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    const opts = () => ({ demo: state.source === 'demo' });

    const categoryClass = (category) => `cat-${category || 'session'}`;

    /* ------------------------------------------------------------------
       KPI
       ------------------------------------------------------------------ */
    function renderKpis(summary) {
        $('kpi-visitors').textContent = fmt(summary.visitors);
        $('kpi-sessions').textContent = fmt(summary.sessions);
        $('kpi-events').textContent = fmt(summary.events);
        $('kpi-avg-session').textContent = duration(summary.avgSession);
        $('kpi-d1').textContent = `${summary.d1}%`;
        $('kpi-d7').textContent = `${summary.d7}%`;
        $('kpi-d28').textContent = `${summary.d28}%`;
        $('kpi-bounce').textContent = `${summary.bounceRate}%`;

        $('kpi-visitors-hint').textContent = `${fmt(summary.pageViews)} просмотров страниц`;
        $('kpi-sessions-hint').textContent = `средняя ${duration(summary.avgSession)}`;
        $('kpi-events-hint').textContent = `${fmt(summary.articleOpens)} открытий статей`;
    }

    /* ------------------------------------------------------------------
       Activity chart
       ------------------------------------------------------------------ */
    function renderChart(series) {
        const canvas = $('activity-chart');
        const fallback = $('chart-fallback');
        if (!canvas || !fallback) return;

        if (state.chart) {
            state.chart.destroy();
            state.chart = null;
        }

        canvas.style.display = '';

        if (!window.Chart) {
            canvas.style.display = 'none';
            fallback.hidden = false;
            const max = Math.max(1, ...series.map((row) => Math.max(row.visitors, row.sessions)));
            fallback.innerHTML = series.map((row) => {
                const height = Math.max(2, Math.round((row.visitors / max) * 100));
                return `<div class="chart-fallback__bar" style="height:${height}%"><span>${row.label}</span></div>`;
            }).join('');
            return;
        }

        fallback.hidden = true;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const labels = series.map((row) => row.label);
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
        gradient.addColorStop(1, 'rgba(56, 189, 248, 0)');

        state.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Посетители',
                        data: series.map((row) => row.visitors),
                        borderColor: '#38bdf8',
                        backgroundColor: gradient,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.36,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointHoverBackgroundColor: '#38bdf8'
                    },
                    {
                        label: 'Сессии',
                        data: series.map((row) => row.sessions),
                        borderColor: '#a855f7',
                        backgroundColor: 'rgba(168, 85, 247, 0.08)',
                        borderWidth: 2,
                        borderDash: [5, 4],
                        fill: false,
                        tension: 0.36,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(9, 13, 20, 0.96)',
                        borderColor: 'rgba(255,255,255,0.12)',
                        borderWidth: 1,
                        titleColor: '#ffffff',
                        bodyColor: '#b9c4d4',
                        padding: 10,
                        displayColors: true,
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${fmt(context.raw)}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#64748b',
                            font: { family: 'JetBrains Mono, monospace', size: 10 },
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.045)' },
                        border: { display: false },
                        ticks: {
                            color: '#64748b',
                            font: { family: 'JetBrains Mono, monospace', size: 10 },
                            precision: 0
                        }
                    }
                }
            }
        });
    }

    /* ------------------------------------------------------------------
       Retention
       ------------------------------------------------------------------ */
    function renderRetention(retention) {
        const body = $('retention-body');
        const badge = $('retention-cohorts-badge');
        const note = $('retention-note');
        if (!body) return;

        const cohorts = (retention.cohorts || []).slice(0, 12);
        if (badge) badge.textContent = `${retention.cohorts.length} когорт`;

        const offsets = [0, 1, 3, 7, 14, 28];

        if (!cohorts.length) {
            body.innerHTML = '<tr><td colspan="8" class="empty-cell">Пока нет когорт — данных недостаточно.</td></tr>';
            if (note) note.textContent = 'Когорта определяется по первому визиту. Удержание считается по любому событию в соответствующий день.';
            return;
        }

        body.innerHTML = cohorts.map((cohort) => {
            const cells = offsets.map((offset) => {
                const pct = cohort.pct[offset] || 0;
                const alpha = pct ? (0.08 + (pct / 100) * 0.58).toFixed(2) : 0;
                const style = pct ? `background:rgba(56,189,248,${alpha})` : '';
                const cls = pct ? 'retention-cell' : 'retention-cell retention-cell--zero';
                return `<td><span class="${cls}" style="${style}">${pct}%</span></td>`;
            }).join('');
            return `<tr><td>${formatDate(cohort.cohort)}</td><td>${fmt(cohort.size)}</td>${cells}</tr>`;
        }).join('');

        if (note) {
            note.textContent = `Когорты за последние ${state.range} дней. Всего посетителей в когортах: ${fmt(retention.visitors)}. Удержание — доля вернувшихся в соответствующий день.`;
        }
    }

    /* ------------------------------------------------------------------
       Funnel
       ------------------------------------------------------------------ */
    function renderFunnel(funnel) {
        const container = $('funnel');
        const badge = $('funnel-sessions-badge');
        if (!container) return;

        if (badge) badge.textContent = `${fmt(funnel.sessions)} сессий`;

        const top = funnel.steps[0] ? funnel.steps[0].count : 0;
        if (!top) {
            container.innerHTML = '<div class="empty-cell">Пока нет данных для воронки.</div>';
            return;
        }

        container.innerHTML = funnel.steps.map((step, index) => {
            const width = Math.max(2, Math.round((step.count / top) * 100));
            const drop = index > 0 && step.dropoff > 0
                ? `<div class="funnel-drop">−${step.dropoff}% к предыдущему шагу</div>`
                : '';
            return `
                <div class="funnel-step">
                    <div class="funnel-step__head">
                        <div class="funnel-step__label">
                            ${step.label}
                            <small>${step.description}</small>
                        </div>
                        <div class="funnel-step__value">${fmt(step.count)} · ${step.conversion}%</div>
                    </div>
                    <div class="funnel-bar"><div class="funnel-bar__fill" style="width:${width}%"></div></div>
                    ${drop}
                </div>
            `;
        }).join('');
    }

    /* ------------------------------------------------------------------
       Events & pages
       ------------------------------------------------------------------ */
    function renderEvents(events) {
        const body = $('events-body');
        const badge = $('events-badge');
        if (!body) return;

        if (badge) badge.textContent = `${events.length} типов`;

        if (!events.length) {
            body.innerHTML = '<tr><td colspan="4" class="empty-cell">Пока нет событий.</td></tr>';
            return;
        }

        body.innerHTML = events.slice(0, 12).map((row) => `
            <tr>
                <td>${row.event}</td>
                <td><span class="cat-pill ${categoryClass(row.category)}">${row.category}</span></td>
                <td><strong>${fmt(row.count)}</strong></td>
                <td>${fmt(row.visitors)}</td>
            </tr>
        `).join('');
    }

    function renderPages(pages) {
        const body = $('pages-body');
        const badge = $('pages-badge');
        if (!body) return;

        if (badge) badge.textContent = `${pages.length} страниц`;

        if (!pages.length) {
            body.innerHTML = '<tr><td colspan="4" class="empty-cell">Пока нет данных.</td></tr>';
            return;
        }

        body.innerHTML = pages.slice(0, 10).map((row) => `
            <tr>
                <td><span class="page-path" title="${row.path}">${row.path}</span></td>
                <td><strong>${fmt(row.views)}</strong></td>
                <td>${fmt(row.visitors)}</td>
                <td>
                    <span class="share-bar">
                        <span class="share-bar__track"><span class="share-bar__fill" style="width:${Math.max(2, row.share)}%"></span></span>
                        <span>${row.share}%</span>
                    </span>
                </td>
            </tr>
        `).join('');
    }

    /* ------------------------------------------------------------------
       Realtime
       ------------------------------------------------------------------ */
    function renderRealtime(realtime) {
        const sessions = $('rt-sessions');
        const visitors = $('rt-visitors');
        const events = $('rt-events');
        const stream = $('event-stream');
        if (!sessions || !stream) return;

        sessions.textContent = fmt(realtime.activeSessions);
        visitors.textContent = fmt(realtime.activeVisitors);
        events.textContent = fmt(realtime.events.length);

        if (!realtime.events.length) {
            stream.innerHTML = '<li class="empty-cell">Пока тихо. Откройте сайт в другой вкладке.</li>';
            return;
        }

        stream.innerHTML = realtime.events
            .slice()
            .sort((a, b) => b.ts - a.ts)
            .slice(0, 9)
            .map((event) => `
                <li>
                    <span class="stream-time">${formatTime(event.ts)}</span>
                    <span class="cat-pill ${categoryClass(event.category)}">${event.category}</span>
                    <span class="stream-event">${event.event}</span>
                    <span class="stream-path">${event.path || '/'}</span>
                </li>
            `).join('');
    }

    /* ------------------------------------------------------------------
       Source / privacy controls
       ------------------------------------------------------------------ */
    function renderDemoBanner() {
        const banner = $('demo-banner');
        if (!banner) return;
        banner.hidden = state.source !== 'demo';
    }

    function renderPrivacy() {
        const button = $('optout-btn');
        const status = $('privacy-status');
        if (!button || !status) return;

        const optedOut = A.isOptedOut();
        button.textContent = optedOut ? 'Включить аналитику' : 'Отключить аналитику';
        status.textContent = optedOut
            ? 'Аналитика отключена. Новые события не записываются. Нажмите «Включить аналитику», чтобы возобновить сбор.'
            : 'Аналитика включена. DNT / Global Privacy Control учитываются автоматически.';
    }

    function setSource(source) {
        state.source = source;
        document.querySelectorAll('.source-btn').forEach((button) => {
            button.classList.toggle('active', button.dataset.source === source);
        });
        renderAll();
    }

    function setRange(range) {
        state.range = Number(range);
        document.querySelectorAll('.range-btn').forEach((button) => {
            button.classList.toggle('active', Number(button.dataset.range) === state.range);
        });
        renderAll();
    }

    /* ------------------------------------------------------------------
       Full render
       ------------------------------------------------------------------ */
    function renderAll() {
        if (!A) return;
        const options = opts();
        const summary = A.getSummary(state.range, options);
        const daily = A.getDailySeries(state.range, options);
        const retention = A.getRetention(state.range, options);
        const funnel = A.getFunnel(state.range, options);
        const events = A.getEventBreakdown(state.range, options);
        const pages = A.getPages(state.range, options);
        const realtime = A.getRealtime(5, options);

        renderKpis(summary);
        renderChart(daily);
        renderRetention(retention);
        renderFunnel(funnel);
        renderEvents(events);
        renderPages(pages);
        renderRealtime(realtime);
        renderDemoBanner();
        renderPrivacy();

        document.body.classList.toggle('is-empty', summary.events === 0);
    }

    /* ------------------------------------------------------------------
       Actions
       ------------------------------------------------------------------ */
    function downloadExport() {
        const payload = A.exportData();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tinyanalytics-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function bind() {
        document.querySelectorAll('.source-btn').forEach((button) => {
            button.addEventListener('click', () => setSource(button.dataset.source));
        });

        document.querySelectorAll('.range-btn').forEach((button) => {
            button.addEventListener('click', () => setRange(button.dataset.range));
        });

        $('export-btn')?.addEventListener('click', downloadExport);

        $('seed-btn')?.addEventListener('click', () => {
            A.seedDemo(30);
            setSource('demo');
        });

        $('clear-demo-btn')?.addEventListener('click', () => {
            if (!window.confirm('Удалить демо-данные?')) return;
            A.clearDemo();
            setSource('real');
        });

        $('optout-btn')?.addEventListener('click', () => {
            if (A.isOptedOut()) {
                A.optIn();
            } else {
                A.optOut();
            }
            window.location.reload();
        });

        $('clear-all-btn')?.addEventListener('click', () => {
            if (!window.confirm('Удалить все локальные события и идентификатор посетителя? Это действие необратимо.')) return;
            A.clearAll();
            A.clearDemo();
            setSource('real');
        });

        window.addEventListener('storage', (event) => {
            if (event.key === 'tga.events.v1' || event.key === 'tga.demo.v1') renderAll();
        });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) renderAll();
        });
    }

    function boot() {
        if (!A) {
            console.error('TinyAnalytics is not loaded.');
            return;
        }

        const demoRequested = new URLSearchParams(window.location.search).get('demo') === '1';
        if (demoRequested && !A.getDemoEvents().length) A.seedDemo(30);

        bind();
        if (demoRequested) {
            setSource('demo');
        } else {
            renderAll();
        }

        // Keep realtime fresh without hammering the UI.
        setInterval(() => {
            if (document.hidden) return;
            const realtime = A.getRealtime(5, opts());
            renderRealtime(realtime);
        }, 5000);

        setInterval(() => {
            if (!document.hidden) renderAll();
        }, 30000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
