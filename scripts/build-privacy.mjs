/**
 * One-off migration helper: move privacy policies from /<name>_privacy.html
 * to clean /privacy/<slug>/ URLs, keep a tiny redirect at the old location,
 * and generate the /privacy/ index.
 *
 * Safe to re-run: already-migrated source files are detected and skipped.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const pages = [
    {
        legacy: 'smash_arena_privacy.html',
        slug: 'smash-arena',
        title: 'Privacy Policy — Smash Arena: PvP Battle Action',
        description: 'Privacy Policy for Smash Arena: PvP Battle Action by Alexander Gellert / Tiny Heart Studios.'
    },
    {
        legacy: 'numbert_privacy.html',
        slug: 'numbert',
        title: 'Privacy Policy — Numbert: Brain Puzzles Trainer',
        description: 'Privacy Policy for Numbert: Brain Puzzles Trainer by Alexander Gellert / Tiny Heart Studios.'
    },
    {
        legacy: 'ragdoll_destruction_privacy.html',
        slug: 'ragdoll-destruction',
        title: 'Privacy Policy — Ragdoll Destruction Playground',
        description: 'Privacy Policy for Ragdoll Destruction Playground by Alexander Gellert / Tiny Heart Studios.'
    },
    {
        legacy: 'master_of_3_tiles_privacy.html',
        slug: 'master-of-3-tiles',
        title: 'Privacy Policy — Master Of 3 Tiles - Mahjong',
        description: 'Privacy Policy for Master Of 3 Tiles - Mahjong by Alexander Gellert / Tiny Heart Studios.'
    },
    {
        legacy: 'perimeter_privacy.html',
        slug: 'perimeter',
        title: 'Privacy Policy — Perimeter: 3D Forest Survival',
        description: 'Privacy Policy for Perimeter: 3D Forest Survival by Alexander Gellert / Tiny Heart Studios.'
    }
];

const fonts = `    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">`;

function transform(html, page) {
    return html
        .replace(
            /<title>[\s\S]*?<\/title>/,
            `<title>${page.title}</title>\n    <meta name="description" content="${page.description}">\n    <link rel="canonical" href="https://a-gellert.github.io/privacy/${page.slug}/">`
        )
        .replace(
            '<link rel="stylesheet" href="style.css">',
            `${fonts}\n    <link rel="stylesheet" href="../../style.css">\n    <script>document.documentElement.classList.add('js');</script>`
        )
        .replace('<body>', '<body>\n\n<div class="scroll-progress"><div class="scroll-progress__bar"></div></div>')
        .replace('href="index.html"', 'href="../../"')
        .replace('href="smash_arena_privacy.html"', 'href="../smash-arena/"')
        .replace('href="numbert_privacy.html"', 'href="../numbert/"')
        .replace('href="ragdoll_destruction_privacy.html"', 'href="../ragdoll-destruction/"')
        .replace('href="master_of_3_tiles_privacy.html"', 'href="../master-of-3-tiles/"')
        .replace('href="perimeter_privacy.html"', 'href="../perimeter/"')
        .replace('href="app-ads.txt"', 'href="../../app-ads.txt"')
        .replace('<div class="privacy-container">', '<div class="privacy-container" data-reveal>')
        .replace('<div style="margin-top: 8px;">', '<div class="footer-bottom">')
        .replace(
            '</body>',
            '<script src="../../js/analytics.js"></script>\n<script src="../../js/main.js"></script>\n\n</body>'
        );
}

function redirectPage(page) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="0; url=/privacy/${page.slug}/">
    <link rel="canonical" href="https://a-gellert.github.io/privacy/${page.slug}/">
    <meta name="robots" content="noindex, follow">
    <title>Redirecting…</title>
    <script>location.replace('/privacy/${page.slug}/' + location.hash);</script>
</head>
<body>
    <p>This page has moved to <a href="/privacy/${page.slug}/">/privacy/${page.slug}/</a>.</p>
</body>
</html>
`;
}

const privacyIndex = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policies — Alexander Gellert / Tiny Heart Studios</title>
    <meta name="description" content="Privacy policies for games by Alexander Gellert / Tiny Heart Studios: Smash Arena, Numbert, Ragdoll Destruction, Master of 3 Tiles and Perimeter.">
    <link rel="canonical" href="https://a-gellert.github.io/privacy/">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../style.css">
    <script>document.documentElement.classList.add('js');</script>
</head>
<body>

<div class="scroll-progress"><div class="scroll-progress__bar"></div></div>

<nav class="top-nav">
    <div class="nav-container">
        <a href="../" class="nav-brand">
            <span class="nav-avatar-mini">AG</span>
            <span>Alexander Gellert</span>
        </a>
        <button class="nav-menu-btn" type="button" aria-label="Открыть меню" aria-expanded="false">
            <span></span><span></span><span></span>
        </button>
        <div class="nav-links">
            <a href="../#games" class="nav-link">Игры</a>
            <a href="../blog/" class="nav-link">Блог</a>
            <a href="../trends/" class="nav-link">Рынок</a>
            <a href="../analytics/" class="nav-link">Аналитика сайта</a>
            <a href="https://t.me/tiny_game" target="_blank" rel="noopener" class="nav-tg-btn">@tiny_game</a>
        </div>
    </div>
</nav>

<div class="container">

    <header data-reveal>
        <div class="status-pill">
            <span class="status-dot"></span>
            Tiny Heart Studios • Legal
        </div>
        <h1>Privacy Policies</h1>
        <p class="subtitle">Политики конфиденциальности мобильных игр. Выберите проект, чтобы открыть актуальную версию документа.</p>
    </header>

    <main>
        <div class="games-grid">
            <a class="card game-card" href="smash-arena/" data-reveal style="text-decoration:none">
                <div class="game-card-top">
                    <div class="game-icon" style="display:flex;align-items:center;justify-content:center;font-size:1.6rem">🥊</div>
                    <div class="game-info">
                        <h2 class="game-title">Smash Arena</h2>
                        <div class="tags-row"><span class="tag tag-highlight">Defold</span><span class="tag">PvP</span></div>
                    </div>
                </div>
                <p class="game-desc">Политика конфиденциальности для PvP-арены: AdMob, рекламные идентификаторы и права пользователей.</p>
                <div class="links-row"><span class="btn btn-outline">Открыть политику →</span></div>
            </a>

            <a class="card game-card" href="numbert/" data-reveal style="text-decoration:none">
                <div class="game-card-top">
                    <div class="game-icon" style="display:flex;align-items:center;justify-content:center;font-size:1.6rem">🔢</div>
                    <div class="game-info">
                        <h2 class="game-title">Numbert</h2>
                        <div class="tags-row"><span class="tag tag-highlight">Defold</span><span class="tag">Puzzle</span></div>
                    </div>
                </div>
                <p class="game-desc">Политика для математической головоломки: Firebase, Play Games Services и рекламные SDK.</p>
                <div class="links-row"><span class="btn btn-outline">Открыть политику →</span></div>
            </a>

            <a class="card game-card" href="ragdoll-destruction/" data-reveal style="text-decoration:none">
                <div class="game-card-top">
                    <div class="game-icon" style="display:flex;align-items:center;justify-content:center;font-size:1.6rem">💥</div>
                    <div class="game-info">
                        <h2 class="game-title">Ragdoll Destruction</h2>
                        <div class="tags-row"><span class="tag tag-highlight">Physics</span><span class="tag">Sandbox</span></div>
                    </div>
                </div>
                <p class="game-desc">Политика для физической песочницы: диагностика, реклама и технические идентификаторы.</p>
                <div class="links-row"><span class="btn btn-outline">Открыть политику →</span></div>
            </a>

            <a class="card game-card" href="master-of-3-tiles/" data-reveal style="text-decoration:none">
                <div class="game-card-top">
                    <div class="game-icon" style="display:flex;align-items:center;justify-content:center;font-size:1.6rem">🀄</div>
                    <div class="game-info">
                        <h2 class="game-title">Master Of 3 Tiles</h2>
                        <div class="tags-row"><span class="tag tag-highlight">Tile Match</span><span class="tag">Mahjong</span></div>
                    </div>
                </div>
                <p class="game-desc">Политика для тайл-матчинга: рекламные сети, Firebase и аналитика прогресса.</p>
                <div class="links-row"><span class="btn btn-outline">Открыть политику →</span></div>
            </a>

            <a class="card game-card" href="perimeter/" data-reveal style="text-decoration:none">
                <div class="game-card-top">
                    <div class="game-icon" style="display:flex;align-items:center;justify-content:center;font-size:1.6rem">🌲</div>
                    <div class="game-info">
                        <h2 class="game-title">Perimeter Survival</h2>
                        <div class="tags-row"><span class="tag tag-highlight">Unity</span><span class="tag">3D Survival</span></div>
                    </div>
                </div>
                <p class="game-desc">Политика для 3D-выживача: GameAnalytics, Unity Ads и Google Play Billing.</p>
                <div class="links-row"><span class="btn btn-outline">Открыть политику →</span></div>
            </a>
        </div>
    </main>

    <footer>
        <div class="footer-nav">
            <a href="../">Главная</a>
            <a href="../blog/">Блог</a>
            <a href="../trends/">Аналитика рынка</a>
            <a href="../analytics/">Аналитика сайта</a>
            <a href="mailto:oblistud@gmail.com">Контакты</a>
        </div>
        <div class="footer-bottom">© 2026 Alexander Gellert. Tiny Heart Studios. All rights reserved.</div>
    </footer>

</div>

<script src="../js/analytics.js"></script>
<script src="../js/main.js"></script>
</body>
</html>
`;

for (const page of pages) {
    const sourcePath = join(root, page.legacy);
    const source = await readFile(sourcePath, 'utf8');

    if (source.includes('http-equiv="refresh"')) {
        console.log(`Skipping ${page.legacy} (already a redirect)`);
        continue;
    }

    const targetDir = join(root, 'privacy', page.slug);
    await mkdir(targetDir, { recursive: true });
    await writeFile(join(targetDir, 'index.html'), transform(source, page), 'utf8');
    await writeFile(sourcePath, redirectPage(page), 'utf8');
    console.log(`Migrated ${page.legacy} → /privacy/${page.slug}/`);
}

await mkdir(join(root, 'privacy'), { recursive: true });
await writeFile(join(root, 'privacy', 'index.html'), privacyIndex, 'utf8');
console.log('Generated /privacy/ index');
