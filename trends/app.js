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

// Initialization
async function init() {
    setupEventListeners();
    await loadData(currentPlatform);
}

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

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num;
}

// Start app
document.addEventListener('DOMContentLoaded', init);
