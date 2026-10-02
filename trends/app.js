// Global State
let currentPlatform = 'google_play';
let gameData = null;
let filteredData = [];
let sortCol = 'hypeIndex';
let sortDesc = true;
let chartInstances = {};

// Platform configurations
const platforms = {
    google_play: { title: 'Google Play', file: 'google_play.json' },
    steam: { title: 'Steam', file: 'steam.json' },
    poki: { title: 'Poki', file: 'poki.json' },
    crazygames: { title: 'CrazyGames', file: 'crazygames.json' },
    yandex_games: { title: 'Yandex Games', file: 'yandex_games.json' }
};

// DOM Elements
const platformTabs = document.querySelectorAll('#platform-tabs li');
const currentPlatformTitle = document.getElementById('current-platform-title');
const lastUpdatedEl = document.getElementById('last-updated');
const tbody = document.getElementById('games-tbody');
const genreFilter = document.getElementById('genre-filter');
const hypeFilter = document.getElementById('hype-filter');
const hypeFilterVal = document.getElementById('hype-filter-val');
const searchInput = document.getElementById('search-input');
const headers = document.querySelectorAll('th[data-sort]');
const exportBtn = document.getElementById('export-btn');

// Hype Index Formula Implementation (Dynamic recalculation if needed, or just standardizer)
// Formula: hypeIndex = (ratingScore * 0.3) + (growthRate * 0.3) + (recencyBonus * 0.2) + (competitionFactor * 0.2)
function calculateDynamicHype(game, totalGamesInGenre) {
    // ratingScore 0-100
    const ratingScore = (game.rating / 5) * 100;
    
    // growthRate normalized (assume -20 to 100 scale maps to 0-100)
    let growthScore = ((game.growthRate + 20) / 120) * 100;
    growthScore = Math.max(0, Math.min(100, growthScore));
    
    // recencyBonus (decay over days)
    const daysSinceUpdate = (new Date() - new Date(game.lastUpdate)) / (1000 * 3600 * 24);
    const recencyBonus = Math.max(0, 100 - (daysSinceUpdate / 3));
    
    // competitionFactor (less games = higher score)
    const competitionFactor = Math.max(0, 100 - (totalGamesInGenre * 2));
    
    return Math.round((ratingScore * 0.3) + (growthScore * 0.3) + (recencyBonus * 0.2) + (competitionFactor * 0.2));
}

// Initialization is done in the New Releases module section below
// Event Listeners
function setupEventListeners() {
    platformTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            platformTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const platform = tab.dataset.platform;
            changePlatform(platform);
        });
    });

    genreFilter.addEventListener('change', applyFilters);
    hypeFilter.addEventListener('input', (e) => {
        hypeFilterVal.textContent = e.target.value;
        applyFilters();
    });
    searchInput.addEventListener('input', applyFilters);

    headers.forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (sortCol === col) {
                sortDesc = !sortDesc;
            } else {
                sortCol = col;
                sortDesc = true;
            }
            renderTable();
        });
    });

    exportBtn.addEventListener('click', exportToCSV);
}

async function changePlatform(platform) {
    currentPlatform = platform;
    document.body.className = `theme-${platform}`;
    currentPlatformTitle.textContent = `${platforms[platform].title} Тренд Аналитика`;
    await loadData(platform);
}

async function loadData(platform) {
    try {
        const response = await fetch(`data/${platforms[platform].file}`);
        if (!response.ok) throw new Error('Data file not found');
        gameData = await response.json();
        
        // Recalculate Hype Index dynamically for demonstration
        const genreCounts = gameData.genreDistribution;
        gameData.games.forEach(g => {
            // Uncomment to use dynamic formula instead of JSON static value
            // g.hypeIndex = calculateDynamicHype(g, genreCounts[g.genre] || 10);
        });
        
        filteredData = [...gameData.games];
        lastUpdatedEl.textContent = gameData.lastUpdated;
        
        updateFilters();
        updateOverview();
        updateNiches();
        renderCharts();
        renderTable();
    } catch (error) {
        console.error('Error loading data:', error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Ошибка загрузки данных. Проверьте папку data/.</td></tr>';
    }
}

function updateFilters() {
    const genres = [...new Set(gameData.games.map(g => g.genre))].sort();
    genreFilter.innerHTML = '<option value="all">Все жанры</option>';
    genres.forEach(g => {
        genreFilter.innerHTML += `<option value="${g}">${g}</option>`;
    });
    
    // Reset filters
    genreFilter.value = 'all';
    hypeFilter.value = 0;
    hypeFilterVal.textContent = '0';
    searchInput.value = '';
}

function updateOverview() {
    document.getElementById('stat-total-games').textContent = gameData.games.length;
    
    const avgRating = gameData.games.reduce((acc, g) => acc + g.rating, 0) / gameData.games.length;
    document.getElementById('stat-avg-rating').textContent = avgRating.toFixed(1);
    
    const avgHype = gameData.games.reduce((acc, g) => acc + g.hypeIndex, 0) / gameData.games.length;
    document.getElementById('stat-avg-hype').textContent = Math.round(avgHype);
    
    const topGenre = Object.entries(gameData.genreDistribution).sort((a,b) => b[1] - a[1])[0];
    document.getElementById('stat-top-genre').textContent = topGenre ? topGenre[0] : '-';
}

function updateNiches() {
    const container = document.getElementById('niches-container');
    container.innerHTML = '';
    
    gameData.niches.forEach(niche => {
        const html = `
            <div class="niche-card">
                <div class="niche-title">${niche.genre}</div>
                <div class="niche-stats">
                    <span>Спрос: <strong>${niche.demand}</strong></span>
                    <span>Предложение: <strong>${niche.supply}</strong></span>
                </div>
                <div class="niche-opp">
                    <span style="font-size:0.8rem; white-space:nowrap;">Возможность</span>
                    <div class="opp-bar">
                        <div class="opp-fill" style="width: ${niche.opportunity}%"></div>
                    </div>
                    <span style="font-weight:bold">${niche.opportunity}</span>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

function applyFilters() {
    const genre = genreFilter.value;
    const minHype = parseInt(hypeFilter.value);
    const search = searchInput.value.toLowerCase();
    
    filteredData = gameData.games.filter(g => {
        const matchGenre = genre === 'all' || g.genre === genre;
        const matchHype = g.hypeIndex >= minHype;
        const matchSearch = g.name.toLowerCase().includes(search) || g.developer.toLowerCase().includes(search);
        return matchGenre && matchHype && matchSearch;
    });
    
    renderTable();
}

function renderTable() {
    // Sort
    filteredData.sort((a, b) => {
        let valA = a[sortCol];
        let valB = b[sortCol];
        
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        
        if (valA < valB) return sortDesc ? 1 : -1;
        if (valA > valB) return sortDesc ? -1 : 1;
        return 0;
    });

    tbody.innerHTML = '';
    
    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Игры не найдены</td></tr>';
        return;
    }

    filteredData.forEach(game => {
        const hypeClass = game.hypeIndex >= 80 ? 'hype-high' : (game.hypeIndex >= 60 ? 'hype-med' : 'hype-low');
        
        let trendIcon = '';
        if(game.trend === 'up') trendIcon = '<i class="fa-solid fa-arrow-trend-up trend-up trend-icon"></i>';
        else if(game.trend === 'down') trendIcon = '<i class="fa-solid fa-arrow-trend-down trend-down trend-icon"></i>';
        else trendIcon = '<i class="fa-solid fa-minus trend-stable trend-icon"></i>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="game-name-cell">
                    <span class="game-name">${game.name}</span>
                    <span class="game-dev">${game.developer}</span>
                </div>
            </td>
            <td>
                <div>${game.genre}</div>
                <div style="font-size:0.8rem; color:var(--text-muted)">${game.subGenre}</div>
            </td>
            <td><strong>${game.rating}</strong> <span style="font-size:0.8rem; color:var(--text-muted)">(${formatNumber(game.ratingsCount)})</span></td>
            <td>${game.downloads}</td>
            <td class="${hypeClass}" style="font-weight:bold; font-size:1.1rem">${game.hypeIndex}</td>
            <td>${trendIcon} <span style="font-size:0.8rem; margin-left:5px">${game.growthRate > 0 ? '+'+game.growthRate : game.growthRate}%</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderCharts() {
    const accentColor = getComputedStyle(document.body).getPropertyValue('--accent').trim();
    
    // Chart.js defaults for dark theme
    Chart.defaults.color = '#a0a0b0';
    Chart.defaults.borderColor = '#3a3a48';

    // 1. Genre Pie Chart
    const ctxGenre = document.getElementById('genreChart').getContext('2d');
    if (chartInstances.genre) chartInstances.genre.destroy();
    
    const genreLabels = Object.keys(gameData.genreDistribution);
    const genreData = Object.values(gameData.genreDistribution);
    
    // Generate palette for all genres
    const bgColors = [
        accentColor,
        '#9C27B0', '#00BCD4', '#FFEB3B', '#FF9800', '#795548', '#E91E63',
        '#2196F3', '#8BC34A', '#FF5722', '#607D8B', '#CDDC39', '#00E676',
        '#AA00FF', '#FF6D00', '#76FF03', '#F50057', '#448AFF', '#69F0AE'
    ];

    chartInstances.genre = new Chart(ctxGenre, {
        type: 'doughnut',
        data: {
            labels: genreLabels,
            datasets: [{
                data: genreData,
                backgroundColor: bgColors.slice(0, genreLabels.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });

    // 2. Trend Line Chart
    const ctxTrend = document.getElementById('trendChart').getContext('2d');
    if (chartInstances.trend) chartInstances.trend.destroy();
    
    const trendLabels = gameData.trendHistory.map(t => t.date);
    const trendData = gameData.trendHistory.map(t => t.hypeAvg);

    chartInstances.trend = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: trendLabels,
            datasets: [{
                label: 'Средний Индекс Хайпа',
                data: trendData,
                borderColor: accentColor,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { min: 40, max: 100 }
            }
        }
    });
}

function exportToCSV() {
    if (filteredData.length === 0) return;
    
    const headers = ['Название', 'Разработчик', 'Жанр', 'Поджанр', 'Рейтинг', 'Оценки', 'Скачивания', 'Индекс Хайпа', 'Рост %', 'Тренд'];
    let csv = headers.join(',') + '\n';
    
    filteredData.forEach(g => {
        const row = [
            `"${g.name}"`,
            `"${g.developer}"`,
            g.genre,
            g.subGenre,
            g.rating,
            g.ratingsCount,
            `"${g.downloads}"`,
            g.hypeIndex,
            g.growthRate,
            g.trend
        ];
        csv += row.join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `gametrends_${currentPlatform}_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num;
}

// ============================================
// NEW RELEASES MODULE
// ============================================
let nrData = null;
let nrFilteredData = [];
let nrSortCol = 'hypeIndex';
let nrSortDesc = true;
let isNewReleasesView = false;

// DOM refs for new releases
const newReleasesTab = document.getElementById('new-releases-tab');
const platformView = document.getElementById('platform-view') || document.querySelector('.main-content:not(#new-releases-view)');
const nrView = document.getElementById('new-releases-view');

// Modify init to set up new releases
async function init() {
    setupEventListeners();
    setupNewReleasesListeners();
    await loadData(currentPlatform);
}

function setupNewReleasesListeners() {
    // New releases tab click
    newReleasesTab.addEventListener('click', () => {
        switchToNewReleases();
    });
    
    // New releases table sorting
    document.querySelectorAll('th[data-sort-nr]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sortNr;
            if (nrSortCol === col) {
                nrSortDesc = !nrSortDesc;
            } else {
                nrSortCol = col;
                nrSortDesc = true;
            }
            renderNrTable();
        });
    });
    
    // New releases CSV export
    document.getElementById('nr-export-btn').addEventListener('click', exportNrCSV);
}

function switchToNewReleases() {
    isNewReleasesView = true;
    
    // Update nav highlights
    platformTabs.forEach(t => t.classList.remove('active'));
    newReleasesTab.classList.add('active');
    
    // Switch views
    platformView.style.display = 'none';
    nrView.style.display = 'block';
    
    // Set theme
    document.body.className = 'theme-new_releases';
    
    // Load data
    loadNewReleasesData();
}

function switchToPlatformView() {
    isNewReleasesView = false;
    newReleasesTab.classList.remove('active');
    platformView.style.display = 'block';
    nrView.style.display = 'none';
}

// Override changePlatform to also handle view switching
const _origChangePlatform = changePlatform;
changePlatform = async function(platform) {
    if (isNewReleasesView) {
        switchToPlatformView();
    }
    await _origChangePlatform(platform);
};

async function loadNewReleasesData() {
    try {
        const response = await fetch('data/new_releases.json');
        if (!response.ok) throw new Error('File not found');
        nrData = await response.json();
        nrFilteredData = [...nrData.games];
        
        document.getElementById('nr-last-updated').textContent = nrData.lastUpdated;
        
        updateNrOverview();
        renderNrCharts();
        renderNrNiches();
        renderNrTable();
    } catch (err) {
        console.error('Error loading new releases:', err);
    }
}

function updateNrOverview() {
    const games = nrData.games;
    document.getElementById('nr-total').textContent = games.length;
    
    const avgHype = Math.round(games.reduce((a, g) => a + g.hypeIndex, 0) / games.length);
    document.getElementById('nr-avg-hype').textContent = avgHype;
    
    const d1Games = games.filter(g => g.retentionDay1 > 0);
    const avgD1 = d1Games.length > 0 
        ? Math.round(d1Games.reduce((a, g) => a + g.retentionDay1, 0) / d1Games.length) 
        : 0;
    document.getElementById('nr-avg-d1').textContent = avgD1 + '%';
    
    const d7Games = games.filter(g => g.retentionDay7 > 0);
    const avgD7 = d7Games.length > 0 
        ? Math.round(d7Games.reduce((a, g) => a + g.retentionDay7, 0) / d7Games.length) 
        : 0;
    document.getElementById('nr-avg-d7').textContent = avgD7 + '%';
    
    const avgGrowth = Math.round(games.reduce((a, g) => a + g.growthRate, 0) / games.length);
    document.getElementById('nr-avg-growth').textContent = '+' + avgGrowth + '%';
}

function renderNrCharts() {
    Chart.defaults.color = '#a0a0b0';
    Chart.defaults.borderColor = '#3a3a48';
    
    // 1. Platform breakdown doughnut
    const ctxPlat = document.getElementById('nrPlatformChart').getContext('2d');
    if (chartInstances.nrPlatform) chartInstances.nrPlatform.destroy();
    
    const platLabels = Object.keys(nrData.platformBreakdown);
    const platData = Object.values(nrData.platformBreakdown);
    const platColors = {
        'Steam': '#66C0F4',
        'Google Play': '#34A853',
        'Poki': '#00C2FF',
        'CrazyGames': '#FF4C4C',
        'Yandex Games': '#FC3F1D'
    };
    
    chartInstances.nrPlatform = new Chart(ctxPlat, {
        type: 'doughnut',
        data: {
            labels: platLabels,
            datasets: [{
                data: platData,
                backgroundColor: platLabels.map(l => platColors[l] || '#888'),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right' } }
        }
    });
    
    // 2. Retention grouped bar chart (top 8 by hype)
    const ctxRet = document.getElementById('nrRetentionChart').getContext('2d');
    if (chartInstances.nrRetention) chartInstances.nrRetention.destroy();
    
    const top8 = [...nrData.games]
        .sort((a, b) => b.hypeIndex - a.hypeIndex)
        .slice(0, 8);
    
    const retLabels = top8.map(g => g.name.length > 15 ? g.name.slice(0, 15) + '…' : g.name);
    
    chartInstances.nrRetention = new Chart(ctxRet, {
        type: 'bar',
        data: {
            labels: retLabels,
            datasets: [
                {
                    label: 'D1 %',
                    data: top8.map(g => g.retentionDay1),
                    backgroundColor: '#4caf50',
                    borderRadius: 4
                },
                {
                    label: 'D7 %',
                    data: top8.map(g => g.retentionDay7),
                    backgroundColor: '#ff9800',
                    borderRadius: 4
                },
                {
                    label: 'D30 %',
                    data: top8.map(g => g.retentionDay30),
                    backgroundColor: '#2196F3',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { min: 0, max: 100, title: { display: true, text: 'Retention %' } }
            },
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}

function renderNrNiches() {
    const container = document.getElementById('nr-niches-container');
    container.innerHTML = '';
    
    nrData.niches.forEach(niche => {
        const retClass = niche.avgRetention >= 50 ? 'high' : (niche.avgRetention >= 30 ? 'mid' : 'low');
        const html = `
            <div class="niche-card">
                <div class="niche-title">${niche.genre}</div>
                <div class="niche-stats">
                    <span>Спрос: <strong>${niche.demand}</strong></span>
                    <span>Предложение: <strong>${niche.supply}</strong></span>
                </div>
                <div class="niche-metrics">
                    <div class="niche-metric">
                        <span class="niche-metric-value">${niche.avgRating}★</span>
                        <span class="niche-metric-label">Рейтинг</span>
                    </div>
                    <div class="niche-metric">
                        <span class="niche-metric-value">${niche.avgRetention}%</span>
                        <span class="niche-metric-label">D7 Retention</span>
                    </div>
                    <div class="niche-metric">
                        <span class="niche-metric-value">${niche.opportunity}</span>
                        <span class="niche-metric-label">Возможность</span>
                    </div>
                </div>
                <div class="niche-opp">
                    <div class="opp-bar"><div class="opp-fill" style="width: ${niche.opportunity}%"></div></div>
                </div>
                <div class="niche-insight">
                    💡 ${niche.insight}
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

function renderNrTable() {
    const tbody = document.getElementById('nr-tbody');
    
    // Sort
    nrFilteredData.sort((a, b) => {
        let vA = a[nrSortCol], vB = b[nrSortCol];
        if (typeof vA === 'string') { vA = vA.toLowerCase(); vB = vB.toLowerCase(); }
        if (vA < vB) return nrSortDesc ? 1 : -1;
        if (vA > vB) return nrSortDesc ? -1 : 1;
        return 0;
    });
    
    tbody.innerHTML = '';
    
    nrFilteredData.forEach(game => {
        const hypeClass = game.hypeIndex >= 85 ? 'hype-high' : (game.hypeIndex >= 70 ? 'hype-med' : 'hype-low');
        
        const retD1Class = game.retentionDay1 >= 65 ? 'high' : (game.retentionDay1 >= 45 ? 'mid' : 'low');
        const retD7Class = game.retentionDay7 >= 45 ? 'high' : (game.retentionDay7 >= 25 ? 'mid' : 'low');
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="game-name-cell">
                    <span class="game-name">${game.name}</span>
                    <span class="game-dev">${game.developer} • <span class="days-badge">${game.daysAgo}д назад</span></span>
                </div>
            </td>
            <td><span class="platform-badge ${game.platformKey}">${game.platform}</span></td>
            <td>
                <div>${game.genre}</div>
                <div style="font-size:0.8rem; color:var(--text-muted)">${game.subGenre}</div>
            </td>
            <td><strong>${game.rating}</strong> <span style="font-size:0.8rem; color:var(--text-muted)">(${formatNumber(game.ratingsCount)})</span></td>
            <td class="${hypeClass}" style="font-weight:bold; font-size:1.1rem">${game.hypeIndex}</td>
            <td>
                <div class="retention-cell">
                    <span>${game.retentionDay1}%</span>
                    <div class="retention-bar"><div class="retention-fill ${retD1Class}" style="width:${game.retentionDay1}%"></div></div>
                </div>
            </td>
            <td>
                <div class="retention-cell">
                    <span>${game.retentionDay7}%</span>
                    <div class="retention-bar"><div class="retention-fill ${retD7Class}" style="width:${game.retentionDay7}%"></div></div>
                </div>
            </td>
            <td style="color:var(--trend-up); font-weight:bold">+${game.growthRate}%</td>
            <td><span class="insight-text">${game.highlight}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function exportNrCSV() {
    if (!nrFilteredData || nrFilteredData.length === 0) return;
    
    const h = ['Название','Платформа','Разработчик','Жанр','Поджанр','Рейтинг','Оценки','Скачивания','Hype Index','D1 %','D7 %','D30 %','Рост %','Дней назад','Инсайт'];
    let csv = h.join(',') + '\n';
    
    nrFilteredData.forEach(g => {
        csv += [
            `"${g.name}"`, `"${g.platform}"`, `"${g.developer}"`,
            g.genre, g.subGenre, g.rating, g.ratingsCount,
            `"${g.downloads}"`, g.hypeIndex,
            g.retentionDay1, g.retentionDay7, g.retentionDay30,
            g.growthRate, g.daysAgo, `"${g.highlight}"`
        ].join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `new_releases_${new Date().toISOString().slice(0,10)}.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Start app
document.addEventListener('DOMContentLoaded', init);

