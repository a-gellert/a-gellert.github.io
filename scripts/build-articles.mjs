/**
 * Build article data bundles from the single source of truth.
 *
 * Source:  articles/articles-data.js
 * Output:  articles/articles.json          (metadata for cards / fallback)
 *          articles/<slug>.json           (full article payload)
 *
 * Usage: npm run build-articles
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const articlesDir = join(root, 'articles');
const sourcePath = join(articlesDir, 'articles-data.js');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(await readFile(sourcePath, 'utf8'), sandbox, { filename: sourcePath });

const articles = sandbox.window.ARTICLES_DATA;

if (!Array.isArray(articles) || articles.length === 0) {
    throw new Error('No articles found in articles-data.js');
}

const seen = new Set();

for (const article of articles) {
    if (!article.id || !article.slug) {
        throw new Error(`Article is missing id/slug: ${JSON.stringify(article.title)}`);
    }
    if (seen.has(article.slug)) {
        throw new Error(`Duplicate article slug: ${article.slug}`);
    }
    seen.add(article.slug);

    const payload = {
        id: article.id,
        slug: article.slug,
        title: article.title,
        category: article.category,
        categoryTitle: article.categoryTitle,
        date: article.date,
        readTime: article.readTime,
        excerpt: article.excerpt,
        tags: article.tags ?? [],
        author: article.author,
        telegramChannel: article.telegramChannel,
        content: article.content ?? ''
    };

    await writeFile(
        join(articlesDir, `${article.slug}.json`),
        `${JSON.stringify(payload, null, 2)}\n`,
        'utf8'
    );
}

const metadata = articles.map(({ content, ...rest }) => rest);

await writeFile(
    join(articlesDir, 'articles.json'),
    `${JSON.stringify(metadata, null, 2)}\n`,
    'utf8'
);

console.log(`Built ${articles.length} articles:`);
for (const article of articles) {
    console.log(`  • ${article.slug}`);
}
