/**
 * GameTrends Intelligence — App Engine (AppMagic & Sensor Tower styled)
 * Provides real niche matrix scouting, store market databases, and breakout scanners.
 */

// Global State
let marketData = window.MARKET_DATA || null;
let currentView = 'niches'; // 'niches' | 'platform' | 'breakout'
let currentPlatform = 'google_play';

let nicheFilters = {
    viability: 'all',
    competition: 'all',
    cpi: 'all',
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

const nichesView = document.getElementById('niches-view');
const platformView = document.getElementById('platform-view');
const breakoutView = document.getElementById('breakout-view');

const nichesContainer = document.getElementById('niches-cards-grid');
const gamesTbody = document.getElementById('games-tbody');
const storeGenreFilter = document.getElementById('store-genre-filter');
const storeSearchInput = document.getElementById('store-search-input');
const breakoutContainer = document.getElementById('breakout-cards-container');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await initData();
    setupNavigation();
    setupNicheFilters();
    setupStoreFilters();
    
    // Default render
    renderNiches();
});

async function initData() {
    if (!marketData && window.MARKET_DATA) {
        marketData = window.MARKET_DATA;
    }
    
    // If not loaded through script tag, attempt fetch (for live server)
    if (!marketData) {
        try {
            const res = await fetch('data/google_play.json');
            // If fallback needed
        } catch (e) {
            console.warn('Fallback to bundled data');
        }
    }
}

// Navigation between Niches, Platform Databases, and Breakouts
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
    nichesView.style.display = view === 'niches' ? 'block' : 'none';
    platformView.style.display = view === 'platform' ? 'block' : 'none';
    breakoutView.style.display = view === 'breakout' ? 'block' : 'none';

    document.body.className = `theme-${view === 'platform' ? currentPlatform : view}`;

    if (view === 'niches') renderNiches();
    if (view === 'breakout') renderBreakoutReleases();
}

// =========================================================================
// 1. NICHE SCOUT MODULE (AppMagic style)
// =========================================================================
function setupNicheFilters() {
    // Viability chips
    document.querySelectorAll('#filter-viability .chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#filter-viability .chip-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            nicheFilters.viability = btn.dataset.val;
            renderNiches();
        });
    });

    // Competition chips
    document.querySelectorAll('#filter-competition .chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#filter-competition .chip-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            nicheFilters.competition = btn.dataset.val;
            renderNiches();
        });
    });

    // CPI select
    document.getElementById('niche-cpi-filter').addEventListener('change', (e) => {
        nicheFilters.cpi = e.target.value;
        renderNiches();
    });

    // Sort select
    document.getElementById('niche-sort').addEventListener('change', (e) => {
        nicheFilters.sort = e.target.value;
        renderNiches();
    });

    // Search input
    document.getElementById('niche-search').addEventListener('input', (e) => {
        nicheFilters.search = e.target.value.toLowerCase().trim();
        renderNiches();
    });
}

function renderNiches() {
    if (!marketData || !marketData.niches) return;

    let list = [...marketData.niches];

    // Filter by viability
    if (nicheFilters.viability === 'top') {
        list = list.filter(n => n.viabilityScore >= 85);
    } else if (nicheFilters.viability === 'promising') {
        list = list.filter(n => n.viabilityScore >= 75 && n.viabilityScore < 85);
    }

    // Filter by competition
    if (nicheFilters.competition === 'low') {
        list = list.filter(n => n.competitionLevel === 'low');
    } else if (nicheFilters.competition === 'medium') {
        list = list.filter(n => n.competitionLevel === 'medium');
    }

    // Filter by CPI
    if (nicheFilters.cpi !== 'all') {
        list = list.filter(n => n.cpiTier === nicheFilters.cpi);
    }

    // Search query
    if (nicheFilters.search) {
        const q = nicheFilters.search;
        list = list.filter(n => 
            n.name.toLowerCase().includes(q) ||
            n.nameRu.toLowerCase().includes(q) ||
            n.category.toLowerCase().includes(q) ||
            n.takeaway.toLowerCase().includes(q) ||
            (n.tags && n.tags.some(t => t.toLowerCase().includes(q)))
        );
    }

    // Sort
    list.sort((a, b) => {
        if (nicheFilters.sort === 'viability') return b.viabilityScore - a.viabilityScore;
        if (nicheFilters.sort === 'competition') return a.top3Share - b.top3Share;
        if (nicheFilters.sort === 'growth') {
            const numA = parseFloat(a.growthYoY) || 0;
            const numB = parseFloat(b.growthYoY) || 0;
            return numB - numA;
        }
        if (nicheFilters.sort === 'revenue') {
            return b.viabilityScore - a.viabilityScore;
        }
        return 0;
    });

    if (list.length === 0) {
        nichesContainer.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
                Ниш по выбранным критериям не найдено. Попробуйте сбросить фильтры.
            </div>
        `;
        return;
    }

    nichesContainer.innerHTML = list.map(niche => {
        const scoreBadgeColor = niche.viabilityScore >= 88 ? '#10b981' : niche.viabilityScore >= 80 ? '#38bdf8' : '#f59e0b';
        const competitionColor = niche.competitionLevel === 'low' ? '#10b981' : niche.competitionLevel === 'medium' ? '#f59e0b' : '#f43f5e';
        const tagsHtml = (niche.tags || []).map(t => `<span class="niche-tag">${t}</span>`).join('');
        
        const benchmarksHtml = (niche.benchmarks || []).map(b => `
            <div class="benchmark-pill">
                <strong>${b.name}</strong> • ${b.installs} <span class="bm-rev">${b.estRevenue}</span>
            </div>
        `).join('');

        return `
            <div class="niche-card-pro">
                <div class="niche-card-header">
                    <div class="niche-title-box">
                        <span class="niche-category">${niche.category}</span>
                        <h2 class="niche-main-title">${niche.nameRu}</h2>
                        <div class="niche-sub-title">${niche.name}</div>
                    </div>
                    <div class="viability-badge" style="border-color:${scoreBadgeColor}; color:${scoreBadgeColor}">
                        <div class="vb-score">${niche.viabilityScore}</div>
                        <div class="vb-tier">Tier ${niche.tier}</div>
                    </div>
                </div>

                <!-- Deep Metrics Matrix (Sensor Tower & AppMagic KPIs) -->
                <div class="niche-metrics-grid">
                    <div class="metric-cell">
                        <span class="mc-label"><i class="fa-solid fa-chart-pie"></i> Объем рынка</span>
                        <span class="mc-val">${niche.marketSizeRevenue}</span>
                        <span class="mc-sub">${niche.marketSizeDownloads}</span>
                    </div>

                    <div class="metric-cell">
                        <span class="mc-label"><i class="fa-solid fa-arrow-trend-up"></i> Темп роста</span>
                        <span class="mc-val" style="color:#10b981">${niche.growthYoY}</span>
                        <span class="mc-sub">Динамика YoY</span>
                    </div>

                    <div class="metric-cell">
                        <span class="mc-label"><i class="fa-solid fa-shield-halved"></i> Доля Top-3 (HHI)</span>
                        <span class="mc-val" style="color:${competitionColor}">${niche.top3Share}%</span>
                        <span class="mc-sub">${niche.competitionLabel}</span>
                    </div>

                    <div class="metric-cell">
                        <span class="mc-label"><i class="fa-solid fa-sack-dollar"></i> Стоимость трафика (CPI)</span>
                        <span class="mc-val">${niche.cpiRange}</span>
                        <span class="mc-sub">Окупаемость: ${niche.cpiLtvRatio}</span>
                    </div>

                    <div class="metric-cell">
                        <span class="mc-label"><i class="fa-solid fa-user-check"></i> Удержание (GameAnalytics)</span>
                        <span class="mc-val">D1: ${niche.retentionD1} | D7: ${niche.retentionD7}</span>
                        <span class="mc-sub">D30: ${niche.retentionD30} • LTV: ${niche.estLtvD90}</span>
                    </div>

                    <div class="metric-cell">
                        <span class="mc-label"><i class="fa-solid fa-fire"></i> Органика / Виральность</span>
                        <span class="mc-val" style="font-size:0.85rem">${niche.viralPotential}</span>
                    </div>
                </div>

                <!-- Monetization Split Bar -->
                <div class="monetization-section">
                    <div class="mono-label-row">
                        <span><i class="fa-solid fa-coins"></i> Структура монетизации:</span>
                        <span class="mono-text">${niche.monetizationLabel}</span>
                    </div>
                    <div class="mono-bar">
                        <div class="mb-rewarded" style="width:${niche.monetization.rewarded}%" title="Rewarded Video: ${niche.monetization.rewarded}%"></div>
                        <div class="mb-interstitial" style="width:${niche.monetization.interstitial}%" title="Interstitial: ${niche.monetization.interstitial}%"></div>
                        <div class="mb-iap" style="width:${niche.monetization.iap}%" title="IAP / Sub: ${niche.monetization.iap}%"></div>
                    </div>
                </div>

                <!-- Actionable Takeaway for Indie Devs -->
                <div class="niche-takeaway-box">
                    <div class="ntb-title"><i class="fa-solid fa-bullseye"></i> Тактический вывод для инди:</div>
                    <p class="ntb-text">${niche.takeaway}</p>
                </div>

                <!-- Reference Benchmarks -->
                <div class="benchmarks-row">
                    <span class="bm-title">Игры-ориентиры:</span>
                    <div class="bm-list">${benchmarksHtml}</div>
                </div>

                <div class="niche-tags-row">${tagsHtml}</div>
            </div>
        `;
    }).join('');
}

// =========================================================================
// 2. STORE PLATFORMS MODULE (Sensor Tower Store Explorer)
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

    document.getElementById('stat-total-games').textContent = data.totalTracked || data.games.length;
    document.getElementById('stat-avg-rating').textContent = data.avgRating || '4.5';
    document.getElementById('stat-avg-hype').textContent = data.avgHype || '85';
    document.getElementById('stat-top-genre').textContent = data.topGenre || 'Casual & Action';

    // Populate genres dropdown
    const genres = [...new Set(data.games.map(g => g.genre))].sort();
    storeGenreFilter.innerHTML = '<option value="all">Все жанры</option>';
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
            (g.developer && g.developer.toLowerCase().includes(q)) ||
            (g.engine && g.engine.toLowerCase().includes(q))
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
        return `
            <tr>
                <td>
                    <div class="game-td-name">
                        <a href="${g.url || '#'}" target="_blank" rel="noopener" class="game-link">${g.name}</a>
                        <span class="game-td-dev">${g.developer || 'Unknown Studio'}</span>
                    </div>
                </td>
                <td>
                    <span class="badge-genre">${g.genre}</span>
                    <span class="td-sub">${g.engine || 'Engine'}</span>
                </td>
                <td>
                    <strong>${g.downloads}</strong>
                    <span class="td-sub">${g.monthlyInstalls || ''}</span>
                </td>
                <td>
                    <strong style="color:#10b981">${g.estMonthlyRevenue || 'N/A'}</strong>
                    <span class="td-sub">${g.monetization || ''}</span>
                </td>
                <td>
                    <span class="rating-star">⭐ ${g.rating}</span>
                </td>
                <td>
                    <div style="font-size:0.85rem">D1: <strong>${g.retentionD1 || '-'}</strong></div>
                    <div class="td-sub">D7: ${g.retentionD7 || '-'}</div>
                </td>
                <td>
                    <span class="cpi-pill">${g.cpiEst || '-'}</span>
                </td>
                <td>
                    <div class="hype-meter">
                        <span class="hype-val">${g.hypeIndex}</span>
                        <div class="hype-bar-mini">
                            <div class="hbm-fill" style="width:${g.hypeIndex}%"></div>
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

    let csv = "Name,Developer,Genre,Downloads,EstMonthlyRevenue,Rating,RetentionD1,RetentionD7,CPI,HypeIndex\n";
    data.games.forEach(g => {
        csv += `"${g.name}","${g.developer}","${g.genre}","${g.downloads}","${g.estMonthlyRevenue}","${g.rating}","${g.retentionD1}","${g.retentionD7}","${g.cpiEst}","${g.hypeIndex}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GameTrends_${currentPlatform}_intelligence.csv`;
    a.click();
}

// =========================================================================
// 3. BREAKOUT RELEASES MODULE (< 60 Days Old)
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
                    <div class="bcp-stat">
                        <span class="bs-lbl">Установки</span>
                        <span class="bs-val">${b.installs}</span>
                    </div>
                    <div class="bcp-stat">
                        <span class="bs-lbl">Удержание D1 / D7</span>
                        <span class="bs-val">${b.retentionD1} / ${b.retentionD7}</span>
                    </div>
                    <div class="bcp-stat">
                        <span class="bs-lbl">Оценка CPI</span>
                        <span class="bs-val" style="color:#10b981">${b.cpiEst}</span>
                    </div>
                    <div class="bcp-stat">
                        <span class="bs-lbl">Рейтинг</span>
                        <span class="bs-val">⭐ ${b.rating}</span>
                    </div>
                </div>

                <div class="bcp-factor-box">
                    <div class="bfb-lbl"><i class="fa-solid fa-bolt"></i> Драйвер взрывного роста:</div>
                    <p class="bfb-text">${b.breakoutFactor}</p>
                </div>

                <div class="bcp-insight-box">
                    <div class="bib-lbl"><i class="fa-solid fa-lightbulb"></i> Урок для разработчика:</div>
                    <p class="bib-text">${b.keyInsight}</p>
                </div>
            </div>
        `;
    }).join('');
}
