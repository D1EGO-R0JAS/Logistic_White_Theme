#!/usr/bin/env node
'use strict';

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'images');
const QUALITY = 80;
const SOURCE_EXTS = new Set(['.jpg', '.jpeg', '.png']);

// ── 1. Convert images ────────────────────────────────────────────────────────

async function convertImages() {
  const files = fs.readdirSync(IMAGES_DIR);
  const sources = files.filter(f => SOURCE_EXTS.has(path.extname(f).toLowerCase()));

  let converted = 0;
  let skipped = 0;

  for (const file of sources) {
    const src = path.join(IMAGES_DIR, file);
    const dest = path.join(IMAGES_DIR, path.basename(file, path.extname(file)) + '.webp');

    if (fs.existsSync(dest)) {
      console.log(`  skip  ${file}  →  already has .webp`);
      skipped++;
      continue;
    }

    try {
      await sharp(src).webp({ quality: QUALITY }).toFile(dest);
      const srcKB  = (fs.statSync(src).size  / 1024).toFixed(1);
      const destKB = (fs.statSync(dest).size / 1024).toFixed(1);
      console.log(`  ✓  ${file}  →  ${path.basename(dest)}  (${srcKB} KB → ${destKB} KB)`);
      converted++;
    } catch (err) {
      console.error(`  ✗  ${file}: ${err.message}`);
    }
  }

  console.log(`\nImages: ${converted} converted, ${skipped} skipped.\n`);
}

// ── 2. Rewrite .html and .css references ────────────────────────────────────

function rewriteRefs() {
  // Collect .html and .css files from root (non-recursive for this project layout)
  const targets = [];
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (ext === '.html' || ext === '.css') targets.push(path.join(ROOT, entry.name));
  }
  // Also include files one level deep (css/ and js/ folders)
  for (const dir of ['css', 'js']) {
    const sub = path.join(ROOT, dir);
    if (!fs.existsSync(sub)) continue;
    for (const entry of fs.readdirSync(sub, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.html' || ext === '.css') targets.push(path.join(sub, entry.name));
    }
  }

  // Regex: match .jpg / .jpeg / .png in image references (case-insensitive)
  // Positive lookahead ensures we only replace inside attribute values / url()
  const RE = /(?<=["'(][^"'()]*)\.(jpg|jpeg|png)(?=["')?\s#])/gi;

  let totalFiles = 0;
  let totalReplacements = 0;

  for (const file of targets) {
    const original = fs.readFileSync(file, 'utf8');
    const rewritten = original.replace(RE, '.webp');
    if (rewritten !== original) {
      fs.writeFileSync(file, rewritten, 'utf8');
      const count = (original.match(RE) || []).length;
      console.log(`  ✓  ${path.relative(ROOT, file)}  (${count} replacement${count !== 1 ? 's' : ''})`);
      totalReplacements += count;
      totalFiles++;
    }
  }

  console.log(`\nRefs: ${totalReplacements} replacement${totalReplacements !== 1 ? 's' : ''} in ${totalFiles} file${totalFiles !== 1 ? 's' : ''}.`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  console.log('── Converting images to WebP ───────────────────────────────');
  await convertImages();
  console.log('── Rewriting .html / .css references ──────────────────────');
  rewriteRefs();
  console.log('\nDone. Originals untouched.');
})();
