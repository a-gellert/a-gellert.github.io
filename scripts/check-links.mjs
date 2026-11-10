/**
 * Tiny internal link checker for the static site.
 * Usage: node scripts/check-links.mjs
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) files.push(...await walk(full));
        else if (entry.name.endsWith('.html')) files.push(full);
    }
    return files;
}

async function exists(path) {
    try { await stat(path); return true; } catch { return false; }
}

async function resolveTarget(page, href) {
    const clean = href.split('#')[0].split('?')[0];
    if (!clean) return null;
    if (/^(https?:|mailto:|tel:|javascript:)/i.test(clean)) return null;

    let target;
    if (clean.startsWith('/')) target = join(root, clean);
    else target = resolve(dirname(page), clean);

    if (target.endsWith(sep) || clean.endsWith('/')) return join(target, 'index.html');
    if (await exists(target)) {
        const info = await stat(target);
        if (info.isDirectory()) return join(target, 'index.html');
        return target;
    }
    return target;
}

const files = await walk(root);
const problems = [];
let checked = 0;

for (const page of files) {
    const html = await readFile(page, 'utf8');
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

    for (const href of hrefs) {
        if (!href || href.startsWith('#') || href.startsWith('${')) continue;
        if (/\.html($|[?#])/.test(href) && !href.includes('http')) {
            problems.push(`${relative(root, page)} → legacy .html link: ${href}`);
        }
        const target = await resolveTarget(page, href);
        if (!target) continue;
        checked += 1;
        if (!await exists(target)) {
            problems.push(`${relative(root, page)} → missing: ${href}`);
        }
    }
}

console.log(`Checked ${checked} internal links in ${files.length} HTML files.`);
if (problems.length) {
    console.log(`\n${problems.length} problem(s):`);
    for (const problem of problems) console.log(`  • ${problem}`);
    process.exitCode = 1;
} else {
    console.log('All internal links resolve.');
}
