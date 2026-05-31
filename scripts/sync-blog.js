/**
 * sync-blog.js
 *
 * Synchronizes blog-data.json from the main site (fraustrohbach.de)
 * to the mirror site (fraustrohbachde/) so both stay consistent.
 *
 * Usage:
 *   node scripts/sync-blog.js
 */
const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'fraustrohbach.de', 'blog-data.json');
const target = path.join(__dirname, '..', 'fraustrohbachde', 'blog-data.json');

function sync() {
  if (!fs.existsSync(source)) {
    console.error('Source file not found:', source);
    process.exit(1);
  }

  const data = fs.readFileSync(source, 'utf8');

  // Validate JSON before writing
  try {
    JSON.parse(data);
  } catch (e) {
    console.error('Invalid JSON in source file:', e.message);
    process.exit(1);
  }

  fs.writeFileSync(target, data);
  console.log('Synced blog-data.json to mirror site.');
  console.log('Source:', source);
  console.log('Target:', target);
}

sync();
