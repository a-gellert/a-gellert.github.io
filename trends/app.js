/**
 * WebGameAnalytics (game-analytics.ru) & Market Intelligence Engine
 * Powers live charts, breakthroughs, developer statistics, benchmarks, and KPI diagnostics.
 */

// Global State
let marketData = window.MARKET_INTELLIGENCE_DATA || window.MARKET_DATA || null;
let currentPlatform = 'yandex_games'; // 'yandex_games' | 'poki' | 'crazygames' | 'google_play' | 'steam'
let currentSection = 'breakthroughs'; // 'breakthroughs' | 'popular' | 'new' | 'ratings' | 'developers' | 'benchmarks' | 'checker'
let activeFilter = 'all'; // 'all' | 'x15' | 'x2' | 'x5'
let searchQuery = '';
let currentGenreKey = 'puzzle';
let chartInstance = null;

// DOM Elements
const platformTabs = document.querySelectorAll('#platform-tabs li');
const sectionTabs = document.querySelectorAll('#section-tabs li');
const searchInput = document.getElementById('global-search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const multiplierChips = document.querySelectorAll('#multiplier-chips .chip-filter');
const countBadge = document.getElementById('items-count-badge');

const viewTitle = document.getElementById('view-title');
const platformIcon = document.getElementById('platform-icon');
const platformName = document.getElementById('platform-name');
const sectionTitle = document.getElementById('section-title');
const viewSubtitle = document.getElementById('view-subtitle');

// View containers
const containers = {
    breakthroughs: document.getElementById('breakthroughs-container'),
    popular: document.getElementById('popular-container'),
    new: document.getElementById('new-container'),
    ratings: document.getElementById('ratings-container'),
    developers: document.getElementById('developers-container'),
    store: document.getElementById('store-table-container'),
    benchmarks: document.getElementById('benchmarks-container'),
    checker: document.getElementById('checker-container')
};

const platformInfo = {
    yandex_games: { name: 'Яндекс Игры', icon: '<i class="fa-brands fa-yandex" style="color:#FC3F1D"></i>', theme: 'theme-yandex_games' },
    poki: { name: 'Poki Web', icon: '<i class="fa-solid fa-gamepad" style="color:#00C2FF"></i>', theme: 'theme-poki' },
    crazygames: { name: 'CrazyGames', icon: '<i class="fa-solid fa-ghost" style="color:#FF4C4C"></i>', theme: 'theme-crazygames' },
    google_play: { name: 'Google Play', icon: '<i class="fa-brands fa-google-play" style="color:#34A853"></i>', theme: 'theme-google_play' },
    steam: { name: 'Steam', icon: '<i class="fa-brands fa-steam" style="color:#66C0F4"></i>', theme: 'theme-steam' }
};

const sectionTitles = {
    breakthroughs: { title: 'Прорывы за 30 дней', sub: 'Игры с максимальным множителем прироста оценок за последние 30 дней по данным game-analytics.ru' },
    popular: { title: 'Популярные игры', sub: 'Самые востребованные проекты каталога с разбивкой оценок по RU и EN сегментам' },
    new: { title: 'Новинки каталога', sub: 'Свежие релизы инди-студий и разработчиков с превью и временем публикации' },
    ratings: { title: 'Рейтинг игр', sub: 'Топ каталога по общему числу отзывов и темпу прироста за 30 дней' },
    developers: { title: 'Топ разработчиков', sub: 'Рейтинг студий и соло-разработчиков: число проектов, удалений и средние оценки' },
    benchmarks: { title: 'Отраслевые бенчмарки GameAnalytics', sub: 'Официальные перцентили удержания D1/D7/D28 и монетизации по 100 000+ игр' },
    checker: { title: 'Диагностика KPI игры', sub: 'Сравнение метрик вашего проекта с перцентилями GameAnalytics для выявления узких мест' }
};

// =========================================================================
// INITIALIZATION
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    if (!marketData && window.MARKET_INTELLIGENCE_DATA) {
        marketData = window.MARKET_INTELLIGENCE_DATA;
    }

    setupPlatformTabs();
    setupSectionTabs();
    setupSearchAndFilters();
    setupBenchmarks();

    // Default view
    renderCurrentState();
});

// =========================================================================
// NAVIGATION HANDLERS
// =========================================================================
function setupPlatformTabs() {
    platformTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            platformTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentPlatform = tab.dataset.platform;

            // Update body theme
            document.body.className = platformInfo[currentPlatform]?.theme || 'theme-yandex_games';

            // Adapt section tabs availability
            updateAvailableSections();
            renderCurrentState();
        });
    });
}

function updateAvailableSections() {
    const isWebStore = ['yandex_games', 'poki', 'crazygames'].includes(currentPlatform);
    sectionTabs.forEach(tab => {
        const sec = tab.dataset.section;
        if (currentPlatform === 'google_play' || currentPlatform === 'steam') {
            if (['breakthroughs', 'popular', 'new', 'ratings', 'developers'].includes(sec)) {
                tab.style.display = 'none';
            } else {
                tab.style.display = 'flex';
            }
        } else {
            tab.style.display = 'flex';
        }
    });

    if (currentPlatform === 'google_play' || currentPlatform === 'steam') {
        currentSection = 'store';
    } else if (currentSection === 'store') {
        currentSection = 'breakthroughs';
    }
}

function setupSectionTabs() {
    sectionTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            sectionTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentSection = tab.dataset.section;
            renderCurrentState();
        });
    });
}

function setupSearchAndFilters() {
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
        renderCurrentState();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        renderCurrentState();
    });

    multiplierChips.forEach(chip => {
        chip.addEventListener('click', () => {
            multiplierChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeFilter = chip.dataset.filter;
            renderCurrentState();
        });
    });
}

// =========================================================================
// RENDER DISPATCHER
// =========================================================================
function renderCurrentState() {
    // 1. Update Header
    const pInfo = platformInfo[currentPlatform] || platformInfo.yandex_games;
    const sInfo = sectionTitles[currentSection] || sectionTitles.breakthroughs;

    platformIcon.innerHTML = pInfo.icon;
    platformName.textContent = pInfo.name;
    sectionTitle.textContent = currentPlatform === 'google_play' || currentPlatform === 'steam' ? 'Каталог и бенчмарки' : sInfo.title;
    viewSubtitle.innerHTML = `${sInfo.sub} • <span class="badge-live">● Live Парсер game-analytics.ru</span>`;

    // 2. Hide all view containers
    Object.values(containers).forEach(c => { if (c) c.style.display = 'none'; });

    // Show/hide filter bar
    const filterArea = document.getElementById('filter-controls-area');
    const multiplierChipsBox = document.getElementById('multiplier-chips');

    if (currentSection === 'benchmarks' || currentSection === 'checker') {
        filterArea.style.display = 'none';
    } else {
        filterArea.style.display = 'block';
        multiplierChipsBox.style.display = currentSection === 'breakthroughs' ? 'flex' : 'none';
    }

    // 3. Render specific section
    if (currentPlatform === 'google_play' || currentPlatform === 'steam') {
        if (currentSection === 'benchmarks') {
            containers.benchmarks.style.display = 'block';
            renderBenchmarks(currentGenreKey);
        } else if (currentSection === 'checker') {
            containers.checker.style.display = 'block';
            runKPIChecker();
        } else {
            containers.store.style.display = 'block';
            renderStoreTable(currentPlatform);
        }
        return;
    }

    switch (currentSection) {
        case 'breakthroughs':
            containers.breakthroughs.style.display = 'block';
            renderBreakthroughs();
            break;
        case 'popular':
            containers.popular.style.display = 'block';
            renderPopular();
            break;
        case 'new':
            containers.new.style.display = 'block';
            renderNew();
            break;
        case 'ratings':
            containers.ratings.style.display = 'block';
            renderRatings();
            break;
        case 'developers':
            containers.developers.style.display = 'block';
            renderDevelopers();
            break;
        case 'benchmarks':
            containers.benchmarks.style.display = 'block';
            renderBenchmarks(currentGenreKey);
            break;
        case 'checker':
            containers.checker.style.display = 'block';
            runKPIChecker();
            break;
        default:
            containers.breakthroughs.style.display = 'block';
            renderBreakthroughs();
    }
}

// =========================================================================
// 1. BREAKTHROUGHS RENDERER (game-analytics.ru core)
// =========================================================================
function renderBreakthroughs() {
    const tbody = document.getElementById('breakthroughs-tbody');
    tbody.innerHTML = '';

    const list = marketData?.breakthroughs?.[currentPlatform] || [];
    
    // Filter
    let filtered = list.filter(item => {
        const matchesSearch = !searchQuery || 
            item.name.toLowerCase().includes(searchQuery) || 
            item.developer.toLowerCase().includes(searchQuery);

        let matchesMult = true;
        if (activeFilter === 'x15') matchesMult = (item.multiplier >= 1.5);
        if (activeFilter === 'x2') matchesMult = (item.multiplier >= 2.0);
        if (activeFilter === 'x5') matchesMult = (item.multiplier >= 5.0);

        return matchesSearch && matchesMult;
    });

    countBadge.textContent = filtered.length;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--text-muted);">Игры не найдены по заданным фильтрам</td></tr>`;
        return;
    }

    filtered.forEach(item => {
        const tr = document.createElement('tr');
        
        // Multiplier badge color
        let multClass = 'badge-mult-norm';
        if (item.multiplier >= 5.0) multClass = 'badge-mult-ultra';
        else if (item.multiplier >= 2.0) multClass = 'badge-mult-high';

        tr.innerHTML = `
            <td class="col-rank">${item.rank}</td>
            <td>
                <div class="game-meta-cell">
                    <span class="game-cell-title">${item.name}</span>
                    <span class="game-cell-dev"><i class="fa-solid fa-code"></i> ${item.developer}</span>
                </div>
            </td>
            <td>
                <span class="ba-pill">${item.beforeAfter || `${item.beforeCount} → ${item.afterCount}`}</span>
            </td>
            <td>
                <span class="multiplier-badge ${multClass}">×${item.multiplier.toFixed(1).replace('.', ',')}</span>
            </td>
            <td>
                <span class="delta-badge">+${item.delta ? item.delta.toLocaleString('ru-RU') : '0'}</span>
            </td>
            <td style="text-align: center;">
                <div class="actions-cell">
                    <a href="${item.directUrl || item.gaUrl}" target="_blank" rel="noopener" class="tbl-btn tbl-play" title="Играть на площадке">
                        <i class="fa-solid fa-play"></i> Играть
                    </a>
                    <a href="${item.gaUrl}" target="_blank" rel="noopener" class="tbl-btn tbl-ga" title="Статистика на game-analytics.ru">
                        <i class="fa-solid fa-chart-simple"></i>
                    </a>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// =========================================================================
// 2. POPULAR GAMES RENDERER
// =========================================================================
function renderPopular() {
    const tbody = document.getElementById('popular-tbody');
    tbody.innerHTML = '';

    const list = marketData?.yandex_games?.popular || [];
    let filtered = list.filter(item => {
        return !searchQuery || 
            item.name.toLowerCase().includes(searchQuery) || 
            item.developer.toLowerCase().includes(searchQuery);
    });

    countBadge.textContent = filtered.length;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 40px; color: var(--text-muted);">Игры не найдены</td></tr>`;
        return;
    }

    filtered.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="col-rank">${item.rank}</td>
            <td><strong style="color:#fff">${item.name}</strong></td>
            <td style="color:var(--text-secondary)">${item.developer}</td>
            <td><span class="badge-status-pop">${item.status || 'Популярная'}</span></td>
            <td><span class="score-pill ru">${item.scoreRu}%</span></td>
            <td><span class="score-pill en">${item.scoreEn}%</span></td>
            <td><strong>${item.totalRatings}</strong></td>
            <td><span class="delta-badge">+${item.plus30Days}</span></td>
            <td style="color:var(--text-muted); font-size:0.82rem">${item.published}</td>
            <td style="text-align:center">
                <a href="${item.directUrl || item.gaUrl}" target="_blank" rel="noopener" class="tbl-btn tbl-play">
                    <i class="fa-solid fa-play"></i>
                </a>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// =========================================================================
// 3. NEW RELEASES RENDERER
// =========================================================================
function renderNew() {
    const grid = document.getElementById('new-games-grid');
    grid.innerHTML = '';

    const list = marketData?.yandex_games?.newReleases || [];
    let filtered = list.filter(item => {
        return !searchQuery || 
            item.name.toLowerCase().includes(searchQuery) || 
            item.developer.toLowerCase().includes(searchQuery);
    });

    countBadge.textContent = filtered.length;

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color: var(--text-muted);">Новинки не найдены</div>`;
        return;
    }

    filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = 'new-game-card';
        card.innerHTML = `
            <div class="ngc-img-box">
                ${item.img ? `<img src="${item.img}" alt="${item.name}" loading="lazy">` : `<div class="ngc-img-placeholder"><i class="fa-solid fa-gamepad"></i></div>`}
                <span class="ngc-badge">Новая</span>
            </div>
            <div class="ngc-info">
                <h4 class="ngc-title">${item.name}</h4>
                <div class="ngc-dev"><i class="fa-solid fa-user-ninja"></i> ${item.developer}</div>
                <div class="ngc-time"><i class="fa-regular fa-clock"></i> ${item.timeAgo}</div>
                <div class="ngc-actions">
                    <a href="${item.directUrl || item.gaUrl}" target="_blank" rel="noopener" class="btn-primary" style="padding: 6px 12px; font-size: 0.8rem; width: 100%; justify-content: center;">
                        <i class="fa-solid fa-play"></i> Играть на Яндекс
                    </a>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// =========================================================================
// 4. TOP RATINGS RENDERER
// =========================================================================
function renderRatings() {
    const tbody = document.getElementById('ratings-tbody');
    tbody.innerHTML = '';

    const list = marketData?.yandex_games?.ratings || [];
    let filtered = list.filter(item => {
        return !searchQuery || 
            item.name.toLowerCase().includes(searchQuery) || 
            item.developer.toLowerCase().includes(searchQuery);
    });

    countBadge.textContent = filtered.length;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 40px; color: var(--text-muted);">Игры не найдены</td></tr>`;
        return;
    }

    filtered.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="col-rank">${item.rank}</td>
            <td><strong style="color:#fff">${item.name}</strong></td>
            <td style="color:var(--text-secondary)">${item.developer}</td>
            <td><span class="score-pill ru">${item.scoreRu}%</span></td>
            <td><span class="score-pill en">${item.scoreEn}%</span></td>
            <td><strong>${item.totalRatings}</strong></td>
            <td><span class="delta-badge">+${item.plus30Days}</span></td>
            <td style="color:var(--text-muted); font-size:0.82rem">${item.published}</td>
            <td style="text-align:center">
                <a href="${item.directUrl || item.gaUrl}" target="_blank" rel="noopener" class="tbl-btn tbl-play">
                    <i class="fa-solid fa-play"></i>
                </a>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// =========================================================================
// 5. DEVELOPERS RENDERER
// =========================================================================
function renderDevelopers() {
    const tbody = document.getElementById('developers-tbody');
    tbody.innerHTML = '';

    const list = marketData?.yandex_games?.developers || [];
    let filtered = list.filter(item => {
        return !searchQuery || item.name.toLowerCase().includes(searchQuery);
    });

    countBadge.textContent = filtered.length;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 40px; color: var(--text-muted);">Студии не найдены</td></tr>`;
        return;
    }

    filtered.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="col-rank">${item.rank}</td>
            <td>
                <a href="${item.url}" target="_blank" rel="noopener" class="dev-name-link">
                    <strong>${item.name}</strong>
                </a>
            </td>
            <td><strong>${item.totalGames}</strong></td>
            <td><span style="color:#34d399">${item.published}</span></td>
            <td><span style="color:#60a5fa">${item.newGames}</span></td>
            <td><span style="color:#fb7185">${item.deleted}</span></td>
            <td><strong>${item.ratings}</strong></td>
            <td><span class="score-pill ru">${item.scoreRu}</span></td>
            <td><span class="score-pill en">${item.scoreEn}</span></td>
            <td style="color:var(--text-muted); font-size:0.82rem">${item.lastPub}</td>
        `;
        tbody.appendChild(tr);
    });
}

// =========================================================================
// 6. STORES TABLE RENDERER (Google Play & Steam)
// =========================================================================
function renderStoreTable(platformKey) {
    const tbody = document.getElementById('store-tbody');
    tbody.innerHTML = '';

    const list = marketData?.[platformKey] || [];
    let filtered = list.filter(item => {
        return !searchQuery || 
            item.name.toLowerCase().includes(searchQuery) || 
            item.developer.toLowerCase().includes(searchQuery);
    });

    countBadge.textContent = filtered.length;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 40px; color: var(--text-muted);">Игры не найдены</td></tr>`;
        return;
    }

    filtered.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="game-meta-cell">
                    <span class="game-cell-title">${item.name}</span>
                    <span class="game-cell-sub">${item.engine || 'Engine'}</span>
                </div>
            </td>
            <td style="color:var(--text-secondary)">${item.developer}</td>
            <td><span class="tag">${item.genre}</span></td>
            <td><span style="color:#fbbf24">⭐ ${item.rating}</span></td>
            <td><strong>${item.downloads}</strong></td>
            <td><span style="color:#34d399; font-weight:700">${item.retentionD1}</span></td>
            <td><span style="color:#60a5fa; font-weight:700">${item.retentionD7}</span></td>
            <td><span style="color:var(--text-muted)">${item.cpiEst}</span></td>
            <td><span class="ga-percentile-pill top">${item.gaPercentile}</span></td>
            <td style="text-align:center">
                <a href="${item.url}" target="_blank" rel="noopener" class="tbl-btn tbl-play">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </a>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// =========================================================================
// 7. GAMEANALYTICS BENCHMARKS & RETENTION CHART
// =========================================================================
function setupBenchmarks() {
    const chips = document.querySelectorAll('#ga-genre-chips .chip-btn');
    chips.forEach(btn => {
        btn.addEventListener('click', () => {
            chips.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentGenreKey = btn.dataset.genre;
            renderBenchmarks(currentGenreKey);
        });
    });
}

function renderBenchmarks(genreKey) {
    const container = document.getElementById('ga-percentiles-container');
    const insightBox = document.getElementById('ga-genre-insight');
    const bm = marketData?.gameAnalyticsBenchmarks?.[genreKey];
    if (!bm) return;

    container.innerHTML = `
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
                <div class="gtc-m-row"><span>ARPDAU:</span><strong style="color:#34d399">$${bm.arpdau.top2.toFixed(2)}</strong></div>
            </div>
        </div>

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
                <div class="gtc-m-row"><span>ARPDAU:</span><strong style="color:#34d399">$${bm.arpdau.top25.toFixed(2)}</strong></div>
            </div>
        </div>

        <div class="ga-tier-card tier-median">
            <div class="gtc-header">
                <span class="gtc-badge">🟡 Median (50th)</span>
                <span class="gtc-sub">Среднее по рынку</span>
            </div>
            <div class="gtc-metrics">
                <div class="gtc-m-row"><span>Day 1 Retention:</span><strong>${bm.d1.median}%</strong></div>
                <div class="gtc-m-row"><span>Day 7 Retention:</span><strong>${bm.d7.median}%</strong></div>
                <div class="gtc-m-row"><span>Day 28 Retention:</span><strong>${bm.d28.median}%</strong></div>
                <div class="gtc-m-row"><span>Ср. сессия (ASL):</span><strong>${bm.aslMinutes.median} мин</strong></div>
                <div class="gtc-m-row"><span>ARPDAU:</span><strong style="color:#fbbf24">$${bm.arpdau.median.toFixed(2)}</strong></div>
            </div>
        </div>

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
                <div class="gtc-m-row"><span>ARPDAU:</span><strong style="color:#fb7185">$${bm.arpdau.bottom25.toFixed(2)}</strong></div>
            </div>
        </div>
    `;

    insightBox.innerHTML = `
        <div class="gic-header">
            <i class="fa-solid fa-lightbulb"></i> Тактический анализ: ${bm.nameRu}
        </div>
        <p class="gic-body">${bm.insight}</p>
        <div class="gic-bullets">
            <div class="gic-bullet"><i class="fa-solid fa-circle-check" style="color:#34d399"></i> Проходной порог окупаемости UA: D1 &ge; ${bm.d1.top25}%, D7 &ge; ${bm.d7.top25}%</div>
            <div class="gic-bullet"><i class="fa-solid fa-triangle-exclamation" style="color:#fbbf24"></i> Если D1 &lt; ${bm.d1.median}%, масштабирование рекламой приведет к сливу бюджета.</div>
        </div>
    `;

    renderRetentionChart(bm);
}

function renderRetentionChart(bm) {
    const canvas = document.getElementById('gaRetentionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Day 1', 'Day 7', 'Day 28'],
            datasets: [
                {
                    label: '🦄 Top 2% (Unicorn)',
                    data: [bm.d1.top2, bm.d7.top2, bm.d28.top2],
                    borderColor: '#c084fc',
                    backgroundColor: 'rgba(192, 132, 252, 0.1)',
                    borderWidth: 3,
                    tension: 0.35,
                    fill: false
                },
                {
                    label: '🟢 Top 25% (Scalable)',
                    data: [bm.d1.top25, bm.d7.top25, bm.d28.top25],
                    borderColor: '#34d399',
                    backgroundColor: 'rgba(52, 211, 153, 0.1)',
                    borderWidth: 2.5,
                    tension: 0.35,
                    fill: false
                },
                {
                    label: '🟡 Median (50th)',
                    data: [bm.d1.median, bm.d7.median, bm.d28.median],
                    borderColor: '#fbbf24',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    tension: 0.35,
                    fill: false
                },
                {
                    label: '🔴 Bottom 25%',
                    data: [bm.d1.bottom25, bm.d7.bottom25, bm.d28.bottom25],
                    borderColor: '#fb7185',
                    borderWidth: 1.5,
                    tension: 0.35,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#9ca3af', boxWidth: 12, font: { size: 11 } }
                },
                tooltip: {
                    callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}%` }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 60,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9ca3af', callback: val => `${val}%` }
                },
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9ca3af' }
                }
            }
        }
    });
}

// =========================================================================
// 8. KPI DIAGNOSTIC CHECKER
// =========================================================================
window.applyPreset = function(type) {
    const d1El = document.getElementById('ch-d1');
    const d7El = document.getElementById('ch-d7');
    const aslEl = document.getElementById('ch-asl');

    if (type === 'hit') {
        d1El.value = 52; d7El.value = 26; aslEl.value = 18;
    } else if (type === 'good') {
        d1El.value = 40; d7El.value = 16; aslEl.value = 11;
    } else if (type === 'leak') {
        d1El.value = 42; d7El.value = 6; aslEl.value = 5;
    }
    runKPIChecker();
};

window.runKPIChecker = function() {
    const genre = document.getElementById('ch-genre')?.value || 'puzzle';
    const d1 = parseFloat(document.getElementById('ch-d1')?.value || 40);
    const d7 = parseFloat(document.getElementById('ch-d7')?.value || 16);
    const asl = parseFloat(document.getElementById('ch-asl')?.value || 10);

    const bm = marketData?.gameAnalyticsBenchmarks?.[genre] || marketData?.gameAnalyticsBenchmarks?.puzzle;
    const resBox = document.getElementById('checker-result-card');
    if (!resBox || !bm) return;

    let tier = 'Top 25% (Здоровый проект)';
    let tierPillClass = 'tier-top';
    let verdictTitle = 'Проект готов к платному масштабированию!';
    let verdictText = 'Ваши показатели удержания D1 и D7 находятся в верхнем квартиле индустрии. Игра окупает закупку трафика при нормальном CPI.';

    if (d1 >= bm.d1.top2 && d7 >= bm.d7.top2) {
        tier = 'Top 2% (Unicorn Hit)';
        tierPillClass = 'tier-top';
        verdictTitle = 'Редкий суперхит уровня мировых лидеров!';
        verdictText = 'Метрики соответствуют флагманам рынка. Немедленно привлекайте издателя или масштабируйте каналы закупки.';
    } else if (d7 < bm.d7.bottom25) {
        tier = 'Критическая утечка на D7 (Bottom 25%)';
        tierPillClass = 'tier-crit';
        verdictTitle = 'Игроки отваливаются после 1-го дня: нет мидкор-целей';
        verdictText = 'D1 достаточен, но к 7 дню пользователи уходят. Проблема в мета-прогрессии, нехватке контента или повторяемости кор-цикла.';
    } else if (d1 < bm.d1.median) {
        tier = 'Слабый D1 (Ниже медианы)';
        tierPillClass = 'tier-warn';
        verdictTitle = 'Проблема первого впечатления (FTUE / First Session)';
        verdictText = 'Пользователи не понимают ценность игры в первые 3 минуты. Проверьте туториал, сложность первых уровней и скорость загрузки.';
    }

    resBox.innerHTML = `
        <div class="checker-diag-card">
            <div class="cd-header">
                <span class="cd-verdict-pill ${tierPillClass}">${tier}</span>
                <span style="font-size:0.8rem; color:var(--text-muted)">Сравнение с ${bm.nameRu}</span>
            </div>
            <h3 class="cd-verdict-title">${verdictTitle}</h3>
            <p class="cd-verdict-desc">${verdictText}</p>
        </div>

        <table class="checker-comp-table">
            <thead>
                <tr>
                    <th>Метрика</th>
                    <th>Ваш ввод</th>
                    <th>Медиана рынка</th>
                    <th>Top 25% цель</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Day 1 Retention</td>
                    <td><strong>${d1}%</strong></td>
                    <td>${bm.d1.median}%</td>
                    <td><span class="ga-percentile-pill top">${bm.d1.top25}%</span></td>
                </tr>
                <tr>
                    <td>Day 7 Retention</td>
                    <td><strong>${d7}%</strong></td>
                    <td>${bm.d7.median}%</td>
                    <td><span class="ga-percentile-pill top">${bm.d7.top25}%</span></td>
                </tr>
                <tr>
                    <td>Ср. сессия (ASL)</td>
                    <td><strong>${asl} мин</strong></td>
                    <td>${bm.aslMinutes.median} мин</td>
                    <td><span class="ga-percentile-pill top">${bm.aslMinutes.top25} мин</span></td>
                </tr>
            </tbody>
        </table>
    `;
};
