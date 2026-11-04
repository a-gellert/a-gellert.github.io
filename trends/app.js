/**
 * GameAnalytics & Market Intelligence Engine
 * Handles GameAnalytics Benchmark Matrix, KPI Diagnostic Checker,
 * Live Scraped Store Explorer, and AppMagic Niche Scout.
 */

// Global State
let marketData = window.MARKET_DATA || null;
let currentView = 'gameanalytics'; // 'gameanalytics' | 'checker' | 'niches' | 'platform' | 'breakout'
let currentGenreKey = 'puzzle';
let currentPlatform = 'google_play';
let chartInstance = null;

let nicheFilters = {
    sort: 'viability',
    search: ''
};

let storeFilters = {
    genre: 'all',
    search: '',
    sortCol: 'downloadsNum',
    sortDesc: true
};

// DOM Elements
const mainNavTabs = document.querySelectorAll('#main-nav-tabs li');
const platformTabs = document.querySelectorAll('#platform-tabs li');

const gameanalyticsView = document.getElementById('gameanalytics-view');
const checkerView = document.getElementById('checker-view');
const nichesView = document.getElementById('niches-view');
const platformView = document.getElementById('platform-view');
const breakoutView = document.getElementById('breakout-view');

const gaPercentilesContainer = document.getElementById('ga-percentiles-container');
const gaGenreInsight = document.getElementById('ga-genre-insight');
const nichesContainer = document.getElementById('niches-cards-grid');
const gamesTbody = document.getElementById('games-tbody');
const storeGenreFilter = document.getElementById('store-genre-filter');
const storeSearchInput = document.getElementById('store-search-input');
const breakoutContainer = document.getElementById('breakout-cards-container');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    if (!marketData && window.MARKET_DATA) {
        marketData = window.MARKET_DATA;
    }

    setupNavigation();
    setupGameAnalyticsView();
    setupStoreFilters();
    setupNicheFilters();

    // Default view: GameAnalytics Benchmarks
    renderGameAnalytics(currentGenreKey);
});

// =========================================================================
// 1. NAVIGATION
// =========================================================================
function setupNavigation() {
    mainNavTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            mainNavTabs.forEach(t => t.classList.remove('active'));
            platformTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const view = tab.dataset.view;
            switchView(view);
        });
    });

    platformTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            platformTabs.forEach(t => t.classList.remove('active'));
            mainNavTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            currentPlatform = tab.dataset.platform;
            switchView('platform');
            renderStorePlatform(currentPlatform);
        });
    });
}

function switchView(view) {
    currentView = view;
    
    // Update active tab styling if switched programmatically
    mainNavTabs.forEach(t => {
        if (t.dataset.view === view) t.classList.add('active');
        else t.classList.remove('active');
    });

    gameanalyticsView.style.display = view === 'gameanalytics' ? 'block' : 'none';
    checkerView.style.display = view === 'checker' ? 'block' : 'none';
    nichesView.style.display = view === 'niches' ? 'block' : 'none';
    platformView.style.display = view === 'platform' ? 'block' : 'none';
    breakoutView.style.display = view === 'breakout' ? 'block' : 'none';

    document.body.className = `theme-${view === 'platform' ? currentPlatform : view}`;

    if (view === 'gameanalytics') renderGameAnalytics(currentGenreKey);
    if (view === 'checker') calculateGameHealth();
    if (view === 'niches') renderNiches();
    if (view === 'breakout') renderBreakoutReleases();
}

// =========================================================================
// 2. GAMEANALYTICS BENCHMARKS MODULE
// =========================================================================
function setupGameAnalyticsView() {
    const chips = document.querySelectorAll('#ga-genre-chips .chip-btn');
    chips.forEach(btn => {
        btn.addEventListener('click', () => {
            chips.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentGenreKey = btn.dataset.genre;
            renderGameAnalytics(currentGenreKey);
        });
    });
}

function renderGameAnalytics(genreKey) {
    if (!marketData || !marketData.gameAnalyticsBenchmarks) return;
    const bm = marketData.gameAnalyticsBenchmarks[genreKey];
    if (!bm) return;

    // 4-Tier Percentiles Cards
    gaPercentilesContainer.innerHTML = `
        <!-- Top 2% Unicorn -->
        <div class="ga-tier-card tier-top2">
            <div class="gtc-header">
                <span class="gtc-badge">🦄 Top 2% (Unicorns)</span>
                <span class="gtc-sub">Лучшие хиты индустрии</span>
            </div>
            <div class="gtc-metrics">
                <div class="gtc-m-row"><span>Day 1 Retention:</span><strong>${bm.d1.top2}%</strong></div>
                <div class="gtc-m-row"><span>Day 7 Retention:</span><strong>${bm.d7.top2}%</strong></div>
                <div class="gtc-m-row"><span>Day 28 Retention:</span><strong>${bm.d28.top2}%</strong></div>
                <div class="gtc-m-row"><span>Ср. сессия (ASL):</span><strong>${bm.aslMinutes.top2} мин</strong></div>
                <div class="gtc-m-row"><span>Сессий в день:</span><strong>${bm.dailySessions.top2}</strong></div>
                <div class="gtc-m-row"><span>ARPDAU:</span><strong style="color:#34d399">$${bm.arpdau.top2.toFixed(2)}</strong></div>
                <div class="gtc-m-row"><span>Stickiness (DAU/MAU):</span><strong>${bm.stickiness.top2}%</strong></div>
            </div>
        </div>

        <!-- Top 25% Good / Scalable -->
        <div class="ga-tier-card tier-top25">
            <div class="gtc-header">
                <span class="gtc-badge">🟢 Top 25% (Scalable)</span>
                <span class="gtc-sub">Окупаемый платный трафик</span>
            </div>
            <div class="gtc-metrics">
                <div class="gtc-m-row"><span>Day 1 Retention:</span><strong>${bm.d1.top25}%</strong></div>
                <div class="gtc-m-row"><span>Day 7 Retention:</span><strong>${bm.d7.top25}%</strong></div>
                <div class="gtc-m-row"><span>Day 28 Retention:</span><strong>${bm.d28.top25}%</strong></div>
                <div class="gtc-m-row"><span>Ср. сессия (ASL):</span><strong>${bm.aslMinutes.top25} мин</strong></div>
                <div class="gtc-m-row"><span>Сессий в день:</span><strong>${bm.dailySessions.top25}</strong></div>
                <div class="gtc-m-row"><span>ARPDAU:</span><strong style="color:#34d399">$${bm.arpdau.top25.toFixed(2)}</strong></div>
                <div class="gtc-m-row"><span>Stickiness (DAU/MAU):</span><strong>${bm.stickiness.top25}%</strong></div>
            </div>
        </div>

        <!-- Median -->
        <div class="ga-tier-card tier-median">
            <div class="gtc-header">
                <span class="gtc-badge">🟡 Median (50th Percentile)</span>
                <span class="gtc-sub">Среднее по индустрии</span>
            </div>
            <div class="gtc-metrics">
                <div class="gtc-m-row"><span>Day 1 Retention:</span><strong>${bm.d1.median}%</strong></div>
                <div class="gtc-m-row"><span>Day 7 Retention:</span><strong>${bm.d7.median}%</strong></div>
                <div class="gtc-m-row"><span>Day 28 Retention:</span><strong>${bm.d28.median}%</strong></div>
                <div class="gtc-m-row"><span>Ср. сессия (ASL):</span><strong>${bm.aslMinutes.median} мин</strong></div>
                <div class="gtc-m-row"><span>Сессий в день:</span><strong>${bm.dailySessions.median}</strong></div>
                <div class="gtc-m-row"><span>ARPDAU:</span><strong style="color:#fbbf24">$${bm.arpdau.median.toFixed(2)}</strong></div>
                <div class="gtc-m-row"><span>Stickiness (DAU/MAU):</span><strong>${bm.stickiness.median}%</strong></div>
            </div>
        </div>

        <!-- Bottom 25% -->
        <div class="ga-tier-card tier-bottom25">
            <div class="gtc-header">
                <span class="gtc-badge">🔴 Bottom 25% (Risk)</span>
                <span class="gtc-sub">Требует доработки кора</span>
            </div>
            <div class="gtc-metrics">
                <div class="gtc-m-row"><span>Day 1 Retention:</span><strong>${bm.d1.bottom25}%</strong></div>
                <div class="gtc-m-row"><span>Day 7 Retention:</span><strong>${bm.d7.bottom25}%</strong></div>
                <div class="gtc-m-row"><span>Day 28 Retention:</span><strong>${bm.d28.bottom25}%</strong></div>
                <div class="gtc-m-row"><span>Ср. сессия (ASL):</span><strong>${bm.aslMinutes.bottom25} мин</strong></div>
                <div class="gtc-m-row"><span>Сессий в день:</span><strong>${bm.dailySessions.bottom25}</strong></div>
                <div class="gtc-m-row"><span>ARPDAU:</span><strong style="color:#f87171">$${bm.arpdau.bottom25.toFixed(2)}</strong></div>
                <div class="gtc-m-row"><span>Stickiness (DAU/MAU):</span><strong>${bm.stickiness.bottom25}%</strong></div>
            </div>
        </div>
    `;

    // Insight Box
    gaGenreInsight.innerHTML = `
        <div class="gai-header"><i class="fa-solid fa-lightbulb"></i> Экспертный вывод GameAnalytics для жанра ${bm.nameRu}:</div>
        <p class="gai-text">${bm.insight}</p>
        <div class="gai-footer">
            <span>Конверсия в платящих (Top 25%): <strong>${bm.conversionRate.top25}%</strong></span>
            <span>Медианная конверсия: <strong>${bm.conversionRate.median}%</strong></span>
        </div>
    `;

    // Retention Curve Chart (Chart.js)
    renderRetentionChart(bm);
}

function renderRetentionChart(bm) {
    const ctx = document.getElementById('gaRetentionChart');
    if (!ctx) return;

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Day 1 (D1)', 'Day 7 (D7)', 'Day 28 (D28)'],
            datasets: [
                {
                    label: 'Top 2% (Unicorns)',
                    data: [bm.d1.top2, bm.d7.top2, bm.d28.top2],
                    borderColor: '#a855f7',
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    borderWidth: 3,
                    tension: 0.35,
                    fill: false
                },
                {
                    label: 'Top 25% (Good)',
                    data: [bm.d1.top25, bm.d7.top25, bm.d28.top25],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2.5,
                    tension: 0.35,
                    fill: false
                },
                {
                    label: 'Median (Average)',
                    data: [bm.d1.median, bm.d7.median, bm.d28.median],
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    tension: 0.35,
                    borderDash: [5, 5],
                    fill: false
                },
                {
                    label: 'Bottom 25% (Poor)',
                    data: [bm.d1.bottom25, bm.d7.bottom25, bm.d28.bottom25],
                    borderColor: '#f43f5e',
                    borderWidth: 1.5,
                    tension: 0.35,
                    borderDash: [3, 3],
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#9ca3af', font: { size: 12 } }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}%`
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.06)' },
                    ticks: { color: '#9ca3af', callback: (v) => v + '%' },
                    min: 0,
                    max: 60
                },
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.06)' },
                    ticks: { color: '#9ca3af' }
                }
            }
        }
    });
}

// =========================================================================
// 3. GAME HEALTH / KPI CHECKER MODULE
// =========================================================================
function applyCheckerPreset(preset) {
    if (preset === 'top') {
        document.getElementById('ch-d1').value = 52;
        document.getElementById('ch-d7').value = 26;
        document.getElementById('ch-asl').value = 16;
        document.getElementById('ch-arpdau').value = 0.22;
    } else if (preset === 'good') {
        document.getElementById('ch-d1').value = 39;
        document.getElementById('ch-d7').value = 16;
        document.getElementById('ch-asl').value = 9.5;
        document.getElementById('ch-arpdau').value = 0.08;
    } else if (preset === 'leak') {
        document.getElementById('ch-d1').value = 44;
        document.getElementById('ch-d7').value = 6;
        document.getElementById('ch-asl').value = 4.5;
        document.getElementById('ch-arpdau').value = 0.02;
    }
    calculateGameHealth();
}

function calculateGameHealth() {
    const genre = document.getElementById('ch-genre').value;
    const d1 = parseFloat(document.getElementById('ch-d1').value) || 0;
    const d7 = parseFloat(document.getElementById('ch-d7').value) || 0;
    const asl = parseFloat(document.getElementById('ch-asl').value) || 0;
    const arpdau = parseFloat(document.getElementById('ch-arpdau').value) || 0;

    const bm = (marketData && marketData.gameAnalyticsBenchmarks) ? marketData.gameAnalyticsBenchmarks[genre] : null;
    if (!bm) return;

    // Score calculation (0-100)
    let d1Score = Math.min(100, (d1 / bm.d1.top2) * 100);
    let d7Score = Math.min(100, (d7 / bm.d7.top2) * 100);
    let aslScore = Math.min(100, (asl / bm.aslMinutes.top2) * 100);
    let arpdauScore = Math.min(100, (arpdau / bm.arpdau.top2) * 100);

    let totalScore = Math.round((d1Score * 0.35) + (d7Score * 0.35) + (aslScore * 0.15) + (arpdauScore * 0.15));
    totalScore = Math.max(10, Math.min(99, totalScore));

    // Determine Grade
    let gradeTitle = "";
    let gradeColor = "";
    if (totalScore >= 90) {
        gradeTitle = "Top 2% (Unicorn / Мировой хит)";
        gradeColor = "#a855f7";
    } else if (totalScore >= 72) {
        gradeTitle = "Top 25% (Здоровый и масштабируемый проект)";
        gradeColor = "#10b981";
    } else if (totalScore >= 50) {
        gradeTitle = "Median (Средний проект, требуется доработка)";
        gradeColor = "#f59e0b";
    } else {
        gradeTitle = "Bottom 25% (Критическая утечка игроков)";
        gradeColor = "#f43f5e";
    }

    document.getElementById('cr-score').textContent = `${totalScore} / 100`;
    document.getElementById('cr-score').style.color = gradeColor;
    document.getElementById('cr-grade').textContent = gradeTitle;
    document.getElementById('cr-grade').style.color = gradeColor;

    // Comparisons
    const d1Diff = d1 - bm.d1.median;
    const d7Diff = d7 - bm.d7.median;
    const d1Tier = d1 >= bm.d1.top2 ? 'Top 2%' : d1 >= bm.d1.top25 ? 'Top 25%' : d1 >= bm.d1.median ? 'Median' : 'Bottom 25%';
    const d7Tier = d7 >= bm.d7.top2 ? 'Top 2%' : d7 >= bm.d7.top25 ? 'Top 25%' : d7 >= bm.d7.median ? 'Median' : 'Bottom 25%';

    document.getElementById('cr-comparison-list').innerHTML = `
        <div class="crc-item">
            <span class="crc-lbl">Day 1 Retention:</span>
            <strong class="crc-val">${d1}%</strong>
            <span class="crc-benchmark">Медиана жанра: ${bm.d1.median}% (${d1Diff >= 0 ? '+' : ''}${d1Diff.toFixed(1)}%) • <strong>${d1Tier}</strong></span>
        </div>
        <div class="crc-item">
            <span class="crc-lbl">Day 7 Retention:</span>
            <strong class="crc-val">${d7}%</strong>
            <span class="crc-benchmark">Медиана жанра: ${bm.d7.median}% (${d7Diff >= 0 ? '+' : ''}${d7Diff.toFixed(1)}%) • <strong>${d7Tier}</strong></span>
        </div>
        <div class="crc-item">
            <span class="crc-lbl">Длина сессии (ASL):</span>
            <strong class="crc-val">${asl} мин</strong>
            <span class="crc-benchmark">Top 25%: ${bm.aslMinutes.top25} мин</span>
        </div>
        <div class="crc-item">
            <span class="crc-lbl">ARPDAU:</span>
            <strong class="crc-val" style="color:#10b981">$${arpdau}</strong>
            <span class="crc-benchmark">Top 25%: $${bm.arpdau.top25}</span>
        </div>
    `;

    // Diagnostic leak detection
    let diagnosis = "";
    if (d1 >= bm.d1.top25 && d7 < bm.d7.median) {
        diagnosis = `
            <div class="cdb-warn"><i class="fa-solid fa-triangle-exclamation"></i> <strong>Обнаружена критическая 'воронка распада' между D1 и D7:</strong></div>
            <p>Ваш первоначальный вход (D1 = ${d1}%) отличный, но D7 (${d7}%) проседает ниже медианы. Это классический признак нехватки контента на 3–5 день или слишком резкого скачка сложности. 
            <strong>Рекомендация:</strong> внедрите цепочку наград за вход (7-Day Login Calendar), push-уведомления на 3-й день и ослабьте баланс уровней после начального туториала.</p>
        `;
    } else if (d1 < bm.d1.median) {
        diagnosis = `
            <div class="cdb-warn" style="color:#f43f5e"><i class="fa-solid fa-circle-xmark"></i> <strong>Слабый First Time User Experience (FTUE):</strong></div>
            <p>D1 (${d1}%) ниже медианы жанра. Игрок не успевает влюбиться в кор-механику за первые 3 минуты. 
            <strong>Рекомендация:</strong> сократите туториал, уберите показ рекламы в первые 2 сессии и увеличьте частоту первых побед (Instant Gratification).</p>
        `;
    } else if (totalScore >= 80) {
        diagnosis = `
            <div class="cdb-success" style="color:#10b981"><i class="fa-solid fa-circle-check"></i> <strong>Метрики готовы к агрессивному масштабированию (User Acquisition):</strong></div>
            <p>Проект находится в лиге лидеров GameAnalytics (Top 25%). Текущее удержание и монетизация позволяют выдерживать CPI до $0.50-$0.70 при гарантированной окупаемости на 30-й день. Время подключать UA-кампании.</p>
        `;
    } else {
        diagnosis = `
            <div class="cdb-info"><i class="fa-solid fa-circle-info"></i> <strong>Проект на среднем уровне (Median):</strong></div>
            <p>Метрики соответствуют средней температуре по рынку. Для выхода в зеленую зону масштабирования требуется подтянуть удержание D7 хотя бы до ${bm.d7.top25}%.</p>
        `;
    }

    document.getElementById('cr-diagnostic-text').innerHTML = diagnosis;
}

// =========================================================================
// 4. LIVE STORE PLATFORMS (Scraped Data Explorer)
// =========================================================================
function setupStoreFilters() {
    storeGenreFilter.addEventListener('change', (e) => {
        storeFilters.genre = e.target.value;
        renderStoreTable();
    });

    storeSearchInput.addEventListener('input', (e) => {
        storeFilters.search = e.target.value.toLowerCase().trim();
        renderStoreTable();
    });

    document.querySelectorAll('#games-table th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (storeFilters.sortCol === col) {
                storeFilters.sortDesc = !storeFilters.sortDesc;
            } else {
                storeFilters.sortCol = col;
                storeFilters.sortDesc = true;
            }
            renderStoreTable();
        });
    });

    document.getElementById('export-btn').addEventListener('click', exportStoreCSV);
}

function renderStorePlatform(platformKey) {
    if (!marketData || !marketData.platforms || !marketData.platforms[platformKey]) return;

    const data = marketData.platforms[platformKey];
    document.getElementById('current-platform-title').textContent = data.title;
    document.getElementById('last-updated').textContent = marketData.lastUpdated;

    document.getElementById('stat-total-games').textContent = `${data.totalTracked || data.games.length} игр`;
    document.getElementById('stat-avg-rating').textContent = data.avgRating || '4.6';
    document.getElementById('stat-avg-hype').textContent = data.avgHype || '92';
    document.getElementById('stat-top-genre').textContent = data.topIndieShare || 'Высокая активность';

    // Populate genres
    const genres = [...new Set(data.games.map(g => g.genre))].sort();
    storeGenreFilter.innerHTML = '<option value="all">Все категории</option>';
    genres.forEach(g => {
        storeGenreFilter.innerHTML += `<option value="${g}">${g}</option>`;
    });

    storeFilters.genre = 'all';
    storeFilters.search = '';
    storeSearchInput.value = '';

    renderStoreTable();
}

function renderStoreTable() {
    const data = marketData.platforms[currentPlatform];
    if (!data || !data.games) return;

    let list = [...data.games];

    if (storeFilters.genre !== 'all') {
        list = list.filter(g => g.genre === storeFilters.genre);
    }

    if (storeFilters.search) {
        const q = storeFilters.search;
        list = list.filter(g => 
            g.name.toLowerCase().includes(q) || 
            (g.developer && g.developer.toLowerCase().includes(q))
        );
    }

    // Sort
    list.sort((a, b) => {
        let valA = a[storeFilters.sortCol];
        let valB = b[storeFilters.sortCol];

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return storeFilters.sortDesc ? 1 : -1;
        if (valA > valB) return storeFilters.sortDesc ? -1 : 1;
        return 0;
    });

    gamesTbody.innerHTML = list.map(g => {
        const gaBadgeClass = (g.gaPercentile && g.gaPercentile.includes('Top 2%')) ? 'gap-top2' : 'gap-top25';

        return `
            <tr>
                <td>
                    <div class="game-td-name">
                        <a href="${g.url || '#'}" target="_blank" rel="noopener" class="game-link">${g.name}</a>
                        <span class="game-td-dev">${g.developer || 'Top Publisher'}</span>
                    </div>
                </td>
                <td>
                    <span class="badge-genre">${g.genre}</span>
                </td>
                <td>
                    <span class="ga-percentile-pill ${gaBadgeClass}">${g.gaPercentile || 'Top 25% (Benchmark)'}</span>
                </td>
                <td>
                    <strong>${g.downloads}</strong>
                    <span class="td-sub">${g.monthlyInstalls || ''}</span>
                </td>
                <td>
                    <strong style="color:#10b981">${g.estMonthlyRevenue || '$450,000'}</strong>
                </td>
                <td>
                    <span class="rating-star">⭐ ${g.rating}</span>
                </td>
                <td>
                    <div style="font-size:0.85rem">D1: <strong>${g.retentionD1 || '48%'}</strong></div>
                    <div class="td-sub">D7: ${g.retentionD7 || '22%'}</div>
                </td>
                <td>
                    <div class="hype-meter">
                        <span class="hype-val">${g.hypeIndex || 90}</span>
                        <div class="hype-bar-mini">
                            <div class="hbm-fill" style="width:${g.hypeIndex || 90}%"></div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function exportStoreCSV() {
    const data = marketData.platforms[currentPlatform];
    if (!data || !data.games) return;

    let csv = "Name,Developer,Genre,GAPercentile,Downloads,EstMonthlyRevenue,Rating,RetentionD1,RetentionD7,HypeIndex\n";
    data.games.forEach(g => {
        csv += `"${g.name}","${g.developer}","${g.genre}","${g.gaPercentile}","${g.downloads}","${g.estMonthlyRevenue}","${g.rating}","${g.retentionD1}","${g.retentionD7}","${g.hypeIndex}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GameAnalytics_${currentPlatform}_Live_Scraped.csv`;
    a.click();
}

// =========================================================================
// 5. APPMAGIC NICHE SCOUT MODULE
// =========================================================================
function setupNicheFilters() {
    document.getElementById('niche-sort').addEventListener('change', (e) => {
        nicheFilters.sort = e.target.value;
        renderNiches();
    });

    document.getElementById('niche-search').addEventListener('input', (e) => {
        nicheFilters.search = e.target.value.toLowerCase().trim();
        renderNiches();
    });
}

function renderNiches() {
    if (!marketData || !marketData.niches) return;

    let list = [...marketData.niches];

    if (nicheFilters.search) {
        const q = nicheFilters.search;
        list = list.filter(n => 
            n.name.toLowerCase().includes(q) ||
            n.nameRu.toLowerCase().includes(q) ||
            n.takeaway.toLowerCase().includes(q) ||
            (n.tags && n.tags.some(t => t.toLowerCase().includes(q)))
        );
    }

    list.sort((a, b) => {
        if (nicheFilters.sort === 'viability') return b.viabilityScore - a.viabilityScore;
        if (nicheFilters.sort === 'competition') return a.top3Share - b.top3Share;
        return 0;
    });

    nichesContainer.innerHTML = list.map(niche => {
        const tagsHtml = (niche.tags || []).map(t => `<span class="niche-tag">${t}</span>`).join('');
        const benchmarksHtml = (niche.benchmarks || []).map(b => `
            <div class="benchmark-pill">
                <strong>${b.name}</strong> • ${b.installs} <span class="bm-rev">${b.estRevenue}</span>
            </div>
        `).join('');

        return `
            <div class="niche-card-pro">
                <div class="niche-card-header">
                    <div>
                        <span class="niche-category">${niche.category}</span>
                        <h2 class="niche-main-title">${niche.nameRu}</h2>
                        <div class="niche-sub-title">${niche.name}</div>
                    </div>
                    <div class="viability-badge" style="border-color:#10b981; color:#10b981">
                        <div class="vb-score">${niche.viabilityScore}</div>
                        <div class="vb-tier">Tier ${niche.tier}</div>
                    </div>
                </div>

                <div class="niche-metrics-grid">
                    <div class="metric-cell">
                        <span class="mc-label"><i class="fa-solid fa-chart-pie"></i> Объем рынка</span>
                        <span class="mc-val">${niche.marketSizeRevenue}</span>
                        <span class="mc-sub">${niche.marketSizeDownloads}</span>
                    </div>
                    <div class="metric-cell">
                        <span class="mc-label"><i class="fa-solid fa-arrow-trend-up"></i> Темп роста</span>
                        <span class="mc-val" style="color:#10b981">${niche.growthYoY}</span>
                    </div>
                    <div class="metric-cell">
                        <span class="mc-label"><i class="fa-solid fa-shield-halved"></i> Доля Top-3</span>
                        <span class="mc-val">${niche.top3Share}%</span>
                        <span class="mc-sub">${niche.competitionLabel}</span>
                    </div>
                    <div class="metric-cell">
                        <span class="mc-label"><i class="fa-solid fa-user-check"></i> Удержание (GA)</span>
                        <span class="mc-val">D1: ${niche.retentionD1} | D7: ${niche.retentionD7}</span>
                    </div>
                </div>

                <div class="niche-takeaway-box">
                    <div class="ntb-title"><i class="fa-solid fa-bullseye"></i> Тактический инсайт для инди:</div>
                    <p class="ntb-text">${niche.takeaway}</p>
                </div>

                <div class="benchmarks-row">
                    <span class="bm-title">Мировые бенчмарки:</span>
                    <div class="bm-list">${benchmarksHtml}</div>
                </div>

                <div class="niche-tags-row">${tagsHtml}</div>
            </div>
        `;
    }).join('');
}

// =========================================================================
// 6. BREAKOUT RELEASES MODULE
// =========================================================================
function renderBreakoutReleases() {
    if (!marketData || !marketData.breakoutReleases) return;

    breakoutContainer.innerHTML = marketData.breakoutReleases.map(b => {
        return `
            <div class="breakout-card-pro">
                <div class="bcp-header">
                    <div>
                        <div class="bcp-platform-pill">${b.platform} • ${b.daysAgo} дней назад</div>
                        <h3 class="bcp-title">${b.name}</h3>
                        <span class="bcp-genre">${b.genre}</span>
                    </div>
                    <div class="bcp-growth-badge">
                        <div class="bcp-growth-val">${b.monthlyGrowth}</div>
                        <div class="bcp-growth-lbl">Прирост/мес</div>
                    </div>
                </div>

                <div class="bcp-stats-grid">
                    <div class="bcp-stat"><span class="bs-lbl">Установки</span><span class="bs-val">${b.installs}</span></div>
                    <div class="bcp-stat"><span class="bs-lbl">D1 / D7</span><span class="bs-val">${b.retentionD1} / ${b.retentionD7}</span></div>
                    <div class="bcp-stat"><span class="bs-lbl">CPI</span><span class="bs-val" style="color:#10b981">${b.cpiEst}</span></div>
                    <div class="bcp-stat"><span class="bs-lbl">Рейтинг</span><span class="bs-val">⭐ ${b.rating}</span></div>
                </div>

                <div class="bcp-factor-box">
                    <div class="bfb-lbl"><i class="fa-solid fa-bolt"></i> Драйвер взрывного роста:</div>
                    <p class="bfb-text">${b.breakoutFactor}</p>
                </div>

                <div class="bcp-insight-box">
                    <div class="bib-lbl"><i class="fa-solid fa-lightbulb"></i> Урок для инди:</div>
                    <p class="bib-text">${b.keyInsight}</p>
                </div>
            </div>
        `;
    }).join('');
}
