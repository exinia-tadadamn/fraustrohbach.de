const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json({ limit: '10mb' }));

// ─── CORS (allow file:// origins and localhost dev) ───
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ─── STATIC FILES ───
// Serve fraustrohbach.de as root site
app.use(express.static(path.join(__dirname, 'fraustrohbach.de')));

// Also serve fraustrohbachde under its own path
app.use('/fraustrohbachde', express.static(path.join(__dirname, 'fraustrohbachde')));

// ─── HELPERS ───
function getBlogDataPath(site) {
    const dir = site === 'fraustrohbachde' ? 'fraustrohbachde' : 'fraustrohbach.de';
    return path.join(__dirname, dir, 'blog-data.json');
}

function readBlogData(site) {
    const p = getBlogDataPath(site);
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeBlogData(site, data) {
    const p = getBlogDataPath(site);
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

// ─── API: GET blog data ───
app.get('/api/blog-data', (req, res) => {
    const site = req.query.site || 'fraustrohbach.de';
    try {
        res.json(readBlogData(site));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── API: POST (overwrite) blog data ───
app.post('/api/blog-data', (req, res) => {
    const site = req.query.site || 'fraustrohbach.de';
    try {
        writeBlogData(site, req.body);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── API: DELETE a post by id ───
app.delete('/api/blog-posts/:id', (req, res) => {
    const site = req.query.site || 'fraustrohbach.de';
    try {
        const data = readBlogData(site);
        const before = data.posts.length;
        data.posts = data.posts.filter(p => p.id !== req.params.id);
        writeBlogData(site, data);
        res.json({ success: true, removed: before - data.posts.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── API: GET / POST single post (merge) ───
app.put('/api/blog-posts/:id', (req, res) => {
    const site = req.query.site || 'fraustrohbach.de';
    try {
        const data = readBlogData(site);
        const idx = data.posts.findIndex(p => p.id === req.params.id);
        if (idx !== -1) {
            data.posts[idx] = { ...data.posts[idx], ...req.body, updatedAt: new Date().toISOString() };
        } else {
            data.posts.push({ ...req.body, id: req.params.id, createdAt: new Date().toISOString() });
        }
        writeBlogData(site, data);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n  Local server running at http://localhost:${PORT}`);
    console.log(`  Blog (main)      → http://localhost:${PORT}/blog.html`);
    console.log(`  Blog (mirror)    → http://localhost:${PORT}/fraustrohbachde/blog.html`);
    console.log(`  API docs:`);
    console.log(`    GET    /api/blog-data`);
    console.log(`    POST   /api/blog-data          (overwrite full JSON)`);
    console.log(`    DELETE /api/blog-posts/:id`);
    console.log(`    PUT    /api/blog-posts/:id     (merge single post)`);
    console.log(`\n  Press Ctrl+C to stop.\n`);
});
