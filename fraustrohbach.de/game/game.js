/* ─── Quanten-Archäologe — Web-Version ─── */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

/* ─── State ─── */
const state = {
    phase: 'intro', // intro | world | minigame | result
    lastTime: 0,
    totalTime: 0,
    chronitonen: 0,
    solved: 0,
    optimal: 0,
    keys: new Set(),
    mouse: { x: 0, y: 0, down: false },
    player: { x: 0, y: 0, speed: 220, size: 48 },
    camera: { x: 0, y: 0 },
    artifacts: [],
    particles: [],
    activeArtifact: null,
    dragTarget: null,
};

/* ─── Assets ─── */
const ASSETS = {
    ruins: 'assets/stylizedRuins.png',
    player: 'assets/quantumArchaeologist.png',
    path: 'assets/ArtefaktVerschraenkungsstein.png',
    signal: 'assets/artefaktResonanzFossil.png',
    alloc: 'assets/ArtifaktEnergieKapsel.png',
    svd: 'assets/ArtifaktGedächtnisKristall.png',
    sync: 'assets/artefaktEverettNode.png',
    hud: 'assets/UIElementOrbitHUDRahmen.png',
    star: 'assets/ChronitonenSterne.png',
    enemy: 'assets/ersterGegner.png',
};
const images = {};
let assetsLoaded = 0;

function loadAssets(cb) {
    const keys = Object.keys(ASSETS);
    let done = 0;
    keys.forEach(k => {
        const img = new Image();
        img.onload = () => { images[k] = img; done++; if (done === keys.length) cb(); };
        img.onerror = () => { done++; if (done === keys.length) cb(); };
        img.src = ASSETS[k];
    });
}

/* ─── Resize ─── */
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    state.player.x = canvas.width / 2;
    state.player.y = canvas.height / 2;
}
window.addEventListener('resize', resize);
resize();

/* ─── Math Helpers ─── */
const Mathx = {
    lerp: (a, b, t) => a + (b - a) * t,
    clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    simpson: (f, a, b, n = 200) => {
        const h = (b - a) / n;
        let s = f(a) + f(b);
        for (let i = 1; i < n; i++) s += (i % 2 === 0 ? 2 : 4) * f(a + i * h);
        return s * h / 3;
    },
    // Simple 2x2 solve
    solve2x2: (A, b) => {
        const det = A[0][0]*A[1][1] - A[0][1]*A[1][0];
        if (Math.abs(det) < 1e-12) return null;
        return [
            (b[0]*A[1][1] - b[1]*A[0][1]) / det,
            (A[0][0]*b[1] - A[1][0]*b[0]) / det
        ];
    },
    // Normal equations for least squares (small n)
    leastSquares: (A, b) => {
        const m = A.length, n = A[0].length;
        // AtA
        const AtA = Array.from({length: n}, () => Array(n).fill(0));
        const Atb = Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                for (let k = 0; k < m; k++) AtA[i][j] += A[k][i] * A[k][j];
            }
            for (let k = 0; k < m; k++) Atb[i] += A[k][i] * b[k];
        }
        // For n<=3, use analytic formulas or simple Gaussian elimination
        if (n === 2) {
            const sol = Mathx.solve2x2(AtA, Atb);
            return sol ? { c: sol, residual: 0 } : null;
        }
        return null;
    },
    optimalAllocation: (a, P, E) => {
        const n = a.length;
        const w = a.map((ai, i) => (ai * ai) / P[i]);
        const tot = w.reduce((s, v) => s + v, 0);
        if (tot <= 0) return Array(n).fill(0);
        return w.map((wi, i) => (E / P[i]) * (wi / tot));
    },
    objectiveAlloc: (a, t) => a.reduce((s, ai, i) => s + ai * Math.sqrt(Math.max(t[i], 0)), 0),
};

/* ─── Artifact Definitions ─── */
function initArtifacts() {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    state.artifacts = [
        { id: 'path', name: 'Pfad-Optimierung', x: cx - 260, y: cy - 120, img: 'path', mechanic: 'path', solved: false, hoverPhase: 0 },
        { id: 'signal', name: 'Signal-Dekomposition', x: cx + 260, y: cy - 120, img: 'signal', mechanic: 'signal', solved: false, hoverPhase: 0 },
        { id: 'alloc', name: 'Energie-Allokation', x: cx - 260, y: cy + 120, img: 'alloc', mechanic: 'alloc', solved: false, hoverPhase: 0 },
        { id: 'svd', name: 'Dimensionale Kompression', x: cx + 260, y: cy + 120, img: 'svd', mechanic: 'svd', solved: false, hoverPhase: 0 },
        { id: 'sync', name: 'Multiversum-Sync', x: cx, y: cy, img: 'sync', mechanic: 'sync', solved: false, hoverPhase: 0 },
    ];
}

/* ─── Input ─── */
window.addEventListener('keydown', e => {
    state.keys.add(e.code);
    if (state.phase === 'intro' && (e.code === 'Space' || e.code === 'Enter')) startGame();
    if (state.phase === 'world' && (e.code === 'Space' || e.code === 'Enter')) tryInteract();
    if (state.phase === 'minigame' && (e.code === 'Space' || e.code === 'Enter')) submitMinigame();
});
window.addEventListener('keyup', e => state.keys.delete(e.code));

window.addEventListener('mousemove', e => {
    state.mouse.x = e.clientX;
    state.mouse.y = e.clientY;
    if (state.phase === 'minigame' && state.mouse.down) handleMinigameDrag(e);
});
window.addEventListener('mousedown', e => {
    state.mouse.down = true;
    if (state.phase === 'minigame') handleMinigameClick(e);
});
window.addEventListener('mouseup', () => { state.mouse.down = false; state.dragTarget = null; });

// Touch
window.addEventListener('touchstart', e => {
    const t = e.touches[0];
    state.mouse.x = t.clientX; state.mouse.y = t.clientY; state.mouse.down = true;
}, { passive: false });
window.addEventListener('touchmove', e => {
    if (state.phase === 'minigame' && state.mouse.down) {
        const t = e.touches[0];
        handleMinigameDrag({ clientX: t.clientX, clientY: t.clientY });
    }
}, { passive: false });
window.addEventListener('touchend', () => { state.mouse.down = false; state.dragTarget = null; });

// D-Pad
const dbtns = document.querySelectorAll('.d-btn[data-key]');
dbtns.forEach(b => {
    const keyMap = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
    const key = keyMap[b.dataset.key];
    b.addEventListener('touchstart', e => { e.preventDefault(); state.keys.add(key); });
    b.addEventListener('touchend', e => { e.preventDefault(); state.keys.delete(key); });
    b.addEventListener('mousedown', () => state.keys.add(key));
    b.addEventListener('mouseup', () => state.keys.delete(key));
});

document.getElementById('startBtn').addEventListener('click', startGame);

function startGame() {
    state.phase = 'world';
    state.totalTime = 0;
    state.chronitonen = 0;
    state.solved = 0;
    state.optimal = 0;
    initArtifacts();
    document.getElementById('introOverlay').classList.add('hidden');
    state.lastTime = performance.now();
}

/* ─── Movement ─── */
function updateMovement(dt) {
    let dx = 0, dy = 0;
    if (state.keys.has('KeyW') || state.keys.has('ArrowUp')) dy -= 1;
    if (state.keys.has('KeyS') || state.keys.has('ArrowDown')) dy += 1;
    if (state.keys.has('KeyA') || state.keys.has('ArrowLeft')) dx -= 1;
    if (state.keys.has('KeyD') || state.keys.has('ArrowRight')) dx += 1;
    if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        dx /= len; dy /= len;
        state.player.x += dx * state.player.speed * dt;
        state.player.y += dy * state.player.speed * dt;
    }
    state.player.x = Mathx.clamp(state.player.x, 40, canvas.width - 40);
    state.player.y = Mathx.clamp(state.player.y, 40, canvas.height - 40);
}

function tryInteract() {
    const p = state.player;
    for (const a of state.artifacts) {
        if (a.solved) continue;
        const d = Mathx.dist({ x: a.x, y: a.y }, p);
        if (d < 90) {
            openMinigame(a);
            return;
        }
    }
}

/* ─── Rendering ─── */
function drawWorld(ctx) {
    // Background
    if (images.ruins) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        const scale = Math.max(canvas.width / images.ruins.width, canvas.height / images.ruins.height);
        const w = images.ruins.width * scale;
        const h = images.ruins.height * scale;
        ctx.drawImage(images.ruins, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        ctx.restore();
    } else {
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Grid overlay
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.06)';
    ctx.lineWidth = 1;
    const gs = 60;
    for (let x = 0; x < canvas.width; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

    // Artifacts
    for (const a of state.artifacts) {
        a.hoverPhase += 0.03;
        const hoverY = Math.sin(a.hoverPhase) * 6;
        ctx.save();
        ctx.globalAlpha = a.solved ? 0.35 : 0.9;
        const size = a.mechanic === 'sync' ? 72 : 56;
        if (images[a.img]) {
            ctx.drawImage(images[a.img], a.x - size/2, a.y - size/2 + hoverY, size, size);
        } else {
            ctx.fillStyle = '#06b6d4';
            ctx.fillRect(a.x - size/2, a.y - size/2 + hoverY, size, size);
        }
        ctx.restore();

        // Label
        ctx.fillStyle = a.solved ? '#475569' : '#e2e8f0';
        ctx.font = '11px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(a.name, a.x, a.y + size/2 + 18 + hoverY);

        // Glow ring if close
        const d = Mathx.dist({ x: a.x, y: a.y + hoverY }, state.player);
        if (d < 120 && !a.solved) {
            ctx.strokeStyle = `rgba(6, 182, 212, ${0.3 + 0.15 * Math.sin(a.hoverPhase * 2)})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(a.x, a.y + hoverY, 50, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // Player
    ctx.save();
    const ps = state.player.size;
    if (images.player) {
        ctx.drawImage(images.player, state.player.x - ps/2, state.player.y - ps/2, ps, ps);
    } else {
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(state.player.x - ps/2, state.player.y - ps/2, ps, ps);
    }
    ctx.restore();
}

/* ─── HUD ─── */
function updateHUD() {
    document.getElementById('hudChron').textContent = Math.floor(state.chronitonen);
    document.getElementById('hudTime').textContent = state.totalTime.toFixed(1) + 's';
    const res = state.totalTime > 0 ? state.chronitonen / Math.sqrt(state.totalTime) : 0;
    document.getElementById('hudRes').textContent = res.toFixed(2);
}

/* ─── Particles ─── */
function spawnParticles(x, y, count = 12) {
    for (let i = 0; i < count; i++) {
        state.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 120,
            vy: (Math.random() - 0.5) * 120 - 40,
            life: 1.0,
            size: 2 + Math.random() * 4,
            color: Math.random() > 0.5 ? '#06b6d4' : '#f472b6'
        });
    }
}

function updateParticles(dt) {
    for (const p of state.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 0.8;
        p.vy += 60 * dt;
    }
    state.particles = state.particles.filter(p => p.life > 0);
}

function drawParticles(ctx) {
    for (const p of state.particles) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

/* ═══════════════════════════════════════
   MINIGAMES
   ═══════════════════════════════════════ */

const miniCanvas = document.getElementById('miniCanvas');
const miniCtx = miniCanvas.getContext('2d');
const miniOverlay = document.getElementById('minigameOverlay');
let miniData = {};

function openMinigame(artifact) {
    state.activeArtifact = artifact;
    state.phase = 'minigame';
    miniOverlay.classList.add('active');
    miniData = {};

    switch (artifact.mechanic) {
        case 'path': initPathGame(); break;
        case 'signal': initSignalGame(); break;
        case 'alloc': initAllocGame(); break;
        case 'svd': initSVDGame(); break;
        case 'sync': initSyncGame(); break;
    }
    drawMinigame();
}

function closeMinigame() {
    miniOverlay.classList.remove('active');
    state.phase = 'world';
    state.activeArtifact = null;
    miniData = {};
}

/* ─── Path Optimization ─── */
function initPathGame() {
    document.getElementById('miniTitle').textContent = 'Mechanik A: Pfad-Optimierung';
    document.getElementById('miniInstr').textContent = 'Verschiebe die Kontrollpunkte. Minimiere die Integral-Zeit T[γ].';
    const w = miniCanvas.width, h = miniCanvas.height;
    miniData.points = [
        { x: 80, y: h/2 },
        { x: 200, y: h/2 - 60 },
        { x: 400, y: h/2 + 50 },
        { x: w - 80, y: h/2 }
    ];
    miniData.dragging = null;
    miniData.field = (px, py) => 1.0 + 0.3 * Math.sin(0.008 * px) * Math.cos(0.008 * py) + 0.2 * (px / w);
    miniData.T = computePathTime();
    miniData.Topt = 420; // approx reference
}

function computePathTime() {
    const pts = miniData.points;
    const field = miniData.field;
    const n = pts.length - 1;
    const f = t => {
        const s = t * n;
        const idx = Math.min(Math.floor(s), n - 1);
        const local = s - idx;
        const a = pts[idx], b = pts[idx + 1];
        const px = a.x + local * (b.x - a.x);
        const py = a.y + local * (b.y - a.y);
        const vx = n * (b.x - a.x);
        const vy = n * (b.y - a.y);
        return field(px, py) * Math.hypot(vx, vy);
    };
    return Mathx.simpson(f, 0, 1, 400);
}

function drawPathGame() {
    const w = miniCanvas.width, h = miniCanvas.height;
    const pts = miniData.points;
    miniCtx.fillStyle = '#0b1220';
    miniCtx.fillRect(0, 0, w, h);

    // Draw field heatmap (simplified)
    miniCtx.fillStyle = 'rgba(6, 182, 212, 0.04)';
    for (let x = 0; x < w; x += 20) {
        for (let y = 0; y < h; y += 20) {
            const val = miniData.field(x, y);
            if (val > 1.3) {
                miniCtx.fillRect(x, y, 20, 20);
            }
        }
    }

    // Path
    miniCtx.strokeStyle = '#06b6d4';
    miniCtx.lineWidth = 3;
    miniCtx.shadowColor = '#06b6d4';
    miniCtx.shadowBlur = 8;
    miniCtx.beginPath();
    miniCtx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) miniCtx.lineTo(pts[i].x, pts[i].y);
    miniCtx.stroke();
    miniCtx.shadowBlur = 0;

    // Points
    for (const p of pts) {
        miniCtx.fillStyle = '#f472b6';
        miniCtx.beginPath();
        miniCtx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        miniCtx.fill();
        miniCtx.strokeStyle = '#fff';
        miniCtx.lineWidth = 2;
        miniCtx.stroke();
    }

    // Info
    miniData.T = computePathTime();
    miniCtx.fillStyle = '#94a3b8';
    miniCtx.font = '13px "Space Grotesk", sans-serif';
    miniCtx.textAlign = 'left';
    miniCtx.fillText(`T[γ] = ${miniData.T.toFixed(1)}`, 12, 24);
    miniCtx.fillText(`Optimum ≈ ${miniData.Topt}`, 12, 42);
}

/* ─── Signal Decomposition ─── */
function initSignalGame() {
    document.getElementById('miniTitle').textContent = 'Mechanik B: Signal-Dekomposition';
    document.getElementById('miniInstr').textContent = 'Ziehe die Regler. Minimiere ‖A·c − b‖₂.';
    miniData.coeffs = [0, 0, 0];
    miniData.trueCoeffs = [3.0, 1.5, 0.8];
    miniData.samples = [];
    for (let i = 0; i < 100; i++) {
        const t = (i / 99) * 2 * Math.PI;
        const noise = (Math.random() - 0.5) * 0.6;
        const val = miniData.trueCoeffs[0] * Math.sin(2*t) +
                    miniData.trueCoeffs[1] * Math.cos(5*t) +
                    miniData.trueCoeffs[2] * Math.sin(8*t) + noise;
        miniData.samples.push({ t, val });
    }
    miniData.bases = [
        t => Math.sin(2*t),
        t => Math.cos(5*t),
        t => Math.sin(8*t)
    ];
    miniData.sliders = [
        { x: 420, y: 80, val: 0, label: 'sin(2t)' },
        { x: 420, y: 160, val: 0, label: 'cos(5t)' },
        { x: 420, y: 240, val: 0, label: 'sin(8t)' },
    ];
    miniData.draggingSlider = null;
}

function drawSignalGame() {
    const w = miniCanvas.width, h = miniCanvas.height;
    miniCtx.fillStyle = '#0b1220';
    miniCtx.fillRect(0, 0, w, h);

    // Target signal (red)
    miniCtx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
    miniCtx.lineWidth = 2;
    miniCtx.beginPath();
    const originX = 40, originY = h / 2;
    const xScale = (w * 0.55) / (2 * Math.PI);
    const yScale = (h * 0.35) / 10;
    for (let i = 0; i < miniData.samples.length; i++) {
        const s = miniData.samples[i];
        const px = originX + s.t * xScale;
        const py = originY + s.val * yScale;
        if (i === 0) miniCtx.moveTo(px, py);
        else miniCtx.lineTo(px, py);
    }
    miniCtx.stroke();

    // Fit signal (cyan)
    miniCtx.strokeStyle = '#06b6d4';
    miniCtx.lineWidth = 2.5;
    miniCtx.shadowColor = '#06b6d4';
    miniCtx.shadowBlur = 6;
    miniCtx.beginPath();
    for (let i = 0; i < miniData.samples.length; i++) {
        const s = miniData.samples[i];
        let fit = 0;
        for (let j = 0; j < 3; j++) fit += miniData.coeffs[j] * miniData.bases[j](s.t);
        const px = originX + s.t * xScale;
        const py = originY + fit * yScale;
        if (i === 0) miniCtx.moveTo(px, py);
        else miniCtx.lineTo(px, py);
    }
    miniCtx.stroke();
    miniCtx.shadowBlur = 0;

    // Residual (yellow faint)
    miniCtx.strokeStyle = 'rgba(234, 179, 8, 0.4)';
    miniCtx.lineWidth = 1;
    miniCtx.beginPath();
    let totalErr = 0;
    for (let i = 0; i < miniData.samples.length; i++) {
        const s = miniData.samples[i];
        let fit = 0;
        for (let j = 0; j < 3; j++) fit += miniData.coeffs[j] * miniData.bases[j](s.t);
        const res = s.val - fit;
        totalErr += res * res;
        const px = originX + s.t * xScale;
        const py = originY + res * yScale;
        if (i === 0) miniCtx.moveTo(px, py);
        else miniCtx.lineTo(px, py);
    }
    miniCtx.stroke();

    // Sliders
    for (let i = 0; i < 3; i++) {
        const sl = miniData.sliders[i];
        const val = miniData.coeffs[i];
        // Track
        miniCtx.fillStyle = '#334155';
        miniCtx.fillRect(sl.x - 100, sl.y - 3, 200, 6);
        // Knob
        const knobX = sl.x + val * 20;
        miniCtx.fillStyle = '#f472b6';
        miniCtx.beginPath();
        miniCtx.arc(knobX, sl.y, 10, 0, Math.PI * 2);
        miniCtx.fill();
        miniCtx.strokeStyle = '#fff';
        miniCtx.lineWidth = 2;
        miniCtx.stroke();

        // Label
        miniCtx.fillStyle = '#cbd5e1';
        miniCtx.font = '12px "Space Grotesk", sans-serif';
        miniCtx.textAlign = 'left';
        miniCtx.fillText(`${sl.label}: ${val.toFixed(2)}`, sl.x + 120, sl.y + 4);
    }

    // Error
    const err = Math.sqrt(totalErr);
    miniCtx.fillStyle = '#94a3b8';
    miniCtx.font = '13px "Space Grotesk", sans-serif';
    miniCtx.textAlign = 'left';
    miniCtx.fillText(`Fehler ‖A·c−b‖₂ = ${err.toFixed(3)}`, 12, 24);
    miniCtx.fillText(`Optimum ≈ 1.7`, 12, 42);
}

/* ─── Allocation ─── */
function initAllocGame() {
    document.getElementById('miniTitle').textContent = 'Mechanik C: Energie-Allokation';
    document.getElementById('miniInstr').textContent = 'Maximiere Σ aᵢ·√tᵢ bei Σ Pᵢ·tᵢ ≤ 100. Ziehe die Balken.';
    miniData.a = [4, 3, 5, 2.5, 3.5];
    miniData.P = [2, 1.5, 3, 1, 2.5];
    miniData.E = 100;
    miniData.t = [0, 0, 0, 0, 0];
    miniData.barW = 300;
    miniData.barH = 24;
    miniData.spacing = 50;
    miniData.startY = 60;
    miniData.dragBar = null;
}

function drawAllocGame() {
    const w = miniCanvas.width, h = miniCanvas.height;
    miniCtx.fillStyle = '#0b1220';
    miniCtx.fillRect(0, 0, w, h);

    const used = miniData.t.reduce((s, ti, i) => s + miniData.P[i] * ti, 0);
    const obj = Mathx.objectiveAlloc(miniData.a, miniData.t);
    const optT = Mathx.optimalAllocation(miniData.a, miniData.P, miniData.E);
    const optObj = Mathx.objectiveAlloc(miniData.a, optT);

    for (let i = 0; i < 5; i++) {
        const y = miniData.startY + i * miniData.spacing;
        const bx = 120;

        // Label
        miniCtx.fillStyle = '#cbd5e1';
        miniCtx.font = '11px "Space Grotesk", sans-serif';
        miniCtx.textAlign = 'right';
        miniCtx.fillText(`Scan ${i+1} (a=${miniData.a[i]}, P=${miniData.P[i]})`, bx - 10, y + 5);

        // Track
        miniCtx.fillStyle = '#1e293b';
        miniCtx.fillRect(bx, y - miniData.barH/2, miniData.barW, miniData.barH);

        // Fill
        const fillW = Math.min(miniData.t[i] / 20 * miniData.barW, miniData.barW);
        miniCtx.fillStyle = used > miniData.E ? '#ef4444' : '#f97316';
        miniCtx.fillRect(bx, y - miniData.barH/2, fillW, miniData.barH);

        // Value label
        miniCtx.fillStyle = '#94a3b8';
        miniCtx.textAlign = 'left';
        miniCtx.fillText(`t=${miniData.t[i].toFixed(1)}`, bx + miniData.barW + 8, y + 4);
    }

    // Energy bar
    const eY = miniData.startY + 5 * miniData.spacing + 20;
    miniCtx.fillStyle = '#1e293b';
    miniCtx.fillRect(120, eY - 6, 200, 12);
    const eRatio = Math.min(used / miniData.E, 1);
    miniCtx.fillStyle = used > miniData.E ? '#ef4444' : '#06b6d4';
    miniCtx.fillRect(120, eY - 6, 200 * eRatio, 12);

    miniCtx.fillStyle = '#94a3b8';
    miniCtx.font = '13px "Space Grotesk", sans-serif';
    miniCtx.textAlign = 'left';
    miniCtx.fillText(`Energie: ${used.toFixed(1)} / ${miniData.E}  |  Ziel: ${obj.toFixed(2)} (Opt: ${optObj.toFixed(2)})`, 12, 24);
}

/* ─── SVD ─── */
function initSVDGame() {
    document.getElementById('miniTitle').textContent = 'Mechanik D: Dimensionale Kompression (SVD)';
    document.getElementById('miniInstr').textContent = 'Wähle k. Erhalte max. Varianz bei min. Speicher.';
    miniData.sigma = [12.5, 8.3, 5.1, 3.2, 1.8, 1.1, 0.7, 0.4];
    miniData.k = 3;
    miniData.chartW = 480;
    miniData.chartH = 180;
    miniData.startX = (miniCanvas.width - 480) / 2;
    miniData.startY = 60;
}

function drawSVDGame() {
    const w = miniCanvas.width, h = miniCanvas.height;
    miniCtx.fillStyle = '#0b1220';
    miniCtx.fillRect(0, 0, w, h);

    const sw = miniData.chartW / miniData.sigma.length;
    const maxS = Math.max(...miniData.sigma);
    const totalVar = miniData.sigma.reduce((s, v) => s + v*v, 0);
    let cum = 0;

    // Bars
    for (let i = 0; i < miniData.sigma.length; i++) {
        const bh = (miniData.sigma[i] / maxS) * miniData.chartH;
        const bx = miniData.startX + i * sw + sw * 0.1;
        miniCtx.fillStyle = i < miniData.k ? '#f472b6' : '#334155';
        miniCtx.fillRect(bx, miniData.startY + miniData.chartH - bh, sw * 0.8, bh);
    }

    // Cumulative line
    miniCtx.strokeStyle = '#06b6d4';
    miniCtx.lineWidth = 2;
    miniCtx.beginPath();
    for (let i = 0; i < miniData.sigma.length; i++) {
        cum += miniData.sigma[i] * miniData.sigma[i];
        const px = miniData.startX + i * sw + sw / 2;
        const py = miniData.startY + miniData.chartH - (cum / totalVar) * miniData.chartH;
        if (i === 0) miniCtx.moveTo(px, py);
        else miniCtx.lineTo(px, py);
    }
    miniCtx.stroke();

    // Selection line
    const cutX = miniData.startX + miniData.k * sw;
    miniCtx.strokeStyle = '#eab308';
    miniCtx.lineWidth = 3;
    miniCtx.beginPath();
    miniCtx.moveTo(cutX, miniData.startY - 10);
    miniCtx.lineTo(cutX, miniData.startY + miniData.chartH + 10);
    miniCtx.stroke();

    const keptVar = miniData.sigma.slice(0, miniData.k).reduce((s, v) => s + v*v, 0);
    const pctVar = (keptVar / totalVar) * 100;
    const pctStore = (miniData.k / miniData.sigma.length) * 100;

    miniCtx.fillStyle = '#94a3b8';
    miniCtx.font = '13px "Space Grotesk", sans-serif';
    miniCtx.textAlign = 'left';
    miniCtx.fillText(`k = ${miniData.k}  |  Varianz = ${pctVar.toFixed(1)}%  |  Speicher = ${pctStore.toFixed(1)}%`, 12, 24);
    miniCtx.fillText('Klicke auf einen Balken, um k zu wählen.', 12, 42);
}

/* ─── Sync ─── */
function initSyncGame() {
    document.getElementById('miniTitle').textContent = 'Mechanik E: Multiversum-Synchronisation';
    document.getElementById('miniInstr').textContent = 'Klicke Knoten in Reihenfolge. Minimiere Zeit. Respektiere Zeitfenster.';
    miniData.nodes = [
        { id: 'α', x: 80, y: 180, tw: null },
        { id: 'β', x: 220, y: 100, tw: [10, 40] },
        { id: 'γ', x: 160, y: 260, tw: [30, 70] },
        { id: 'δ', x: 380, y: 140, tw: [50, 90] },
        { id: 'Ω', x: 500, y: 180, tw: null },
    ];
    miniData.edges = [
        { from: 'α', to: 'β', t: 15 },
        { from: 'α', to: 'γ', t: 25 },
        { from: 'β', to: 'γ', t: 20 },
        { from: 'β', to: 'δ', t: 30 },
        { from: 'γ', to: 'δ', t: 15 },
        { from: 'γ', to: 'Ω', t: 35 },
        { from: 'δ', to: 'Ω', t: 25 },
    ];
    miniData.route = [];
}

function drawSyncGame() {
    const w = miniCanvas.width, h = miniCanvas.height;
    miniCtx.fillStyle = '#0b1220';
    miniCtx.fillRect(0, 0, w, h);

    // Edges
    miniCtx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    miniCtx.lineWidth = 2;
    for (const e of miniData.edges) {
        const a = miniData.nodes.find(n => n.id === e.from);
        const b = miniData.nodes.find(n => n.id === e.to);
        miniCtx.beginPath();
        miniCtx.moveTo(a.x, a.y);
        miniCtx.lineTo(b.x, b.y);
        miniCtx.stroke();

        // Time label
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        miniCtx.fillStyle = '#64748b';
        miniCtx.font = '10px "Space Grotesk", sans-serif';
        miniCtx.textAlign = 'center';
        miniCtx.fillText(e.t.toString(), mx, my - 4);
    }

    // Route highlight
    if (miniData.route.length > 1) {
        miniCtx.strokeStyle = '#06b6d4';
        miniCtx.lineWidth = 3;
        miniCtx.shadowColor = '#06b6d4';
        miniCtx.shadowBlur = 8;
        miniCtx.beginPath();
        for (let i = 0; i < miniData.route.length; i++) {
            const n = miniData.nodes.find(nd => nd.id === miniData.route[i]);
            if (i === 0) miniCtx.moveTo(n.x, n.y);
            else miniCtx.lineTo(n.x, n.y);
        }
        miniCtx.stroke();
        miniCtx.shadowBlur = 0;
    }

    // Nodes
    for (const n of miniData.nodes) {
        const active = miniData.route.includes(n.id);
        const isNext = miniData.route.length > 0 && !active;
        const last = miniData.route[miniData.route.length - 1];
        const connected = isNext && miniData.edges.some(e => e.from === last && e.to === n.id);

        miniCtx.fillStyle = n.id === 'α' || n.id === 'Ω' ? '#22c55e' : (active ? '#06b6d4' : (connected ? '#a855f7' : '#475569'));
        miniCtx.beginPath();
        miniCtx.arc(n.x, n.y, 18, 0, Math.PI * 2);
        miniCtx.fill();
        miniCtx.strokeStyle = '#fff';
        miniCtx.lineWidth = 2;
        miniCtx.stroke();

        miniCtx.fillStyle = '#fff';
        miniCtx.font = '12px "Space Grotesk", sans-serif';
        miniCtx.textAlign = 'center';
        miniCtx.fillText(n.id, n.x, n.y + 4);

        if (n.tw) {
            miniCtx.fillStyle = connected ? '#facc15' : '#64748b';
            miniCtx.font = '9px "Space Grotesk", sans-serif';
            miniCtx.fillText(`[${n.tw[0]},${n.tw[1]}]`, n.x, n.y - 28);
        }
    }

    // Stats
    let totalTime = 0, violations = 0;
    for (let i = 1; i < miniData.route.length; i++) {
        const e = miniData.edges.find(ed => ed.from === miniData.route[i-1] && ed.to === miniData.route[i]);
        if (e) totalTime += e.t;
        const node = miniData.nodes.find(n => n.id === miniData.route[i]);
        if (node.tw) {
            if (totalTime < node.tw[0] || totalTime > node.tw[1]) violations++;
        }
    }
    miniCtx.fillStyle = violations > 0 ? '#ef4444' : '#94a3b8';
    miniCtx.font = '13px "Space Grotesk", sans-serif';
    miniCtx.textAlign = 'left';
    miniCtx.fillText(`Route: ${miniData.route.join(' → ') || '--'}`, 12, 24);
    miniCtx.fillText(`Zeit: ${totalTime}  |  Fenster: ${violations > 0 ? violations + '× VERLETZT' : 'OK'}`, 12, 42);
}

/* ─── Minigame Input ─── */
function handleMinigameClick(e) {
    const rect = miniCanvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (miniCanvas.width / rect.width);
    const my = (e.clientY - rect.top) * (miniCanvas.height / rect.height);

    if (state.activeArtifact.mechanic === 'path') {
        for (const p of miniData.points) {
            if (Math.hypot(mx - p.x, my - p.y) < 14) {
                state.dragTarget = { type: 'pathPoint', point: p };
                return;
            }
        }
    } else if (state.activeArtifact.mechanic === 'signal') {
        for (let i = 0; i < 3; i++) {
            const sl = miniData.sliders[i];
            if (Math.abs(my - sl.y) < 20 && Math.abs(mx - (sl.x + miniData.coeffs[i] * 20)) < 18) {
                state.dragTarget = { type: 'slider', index: i };
                return;
            }
        }
    } else if (state.activeArtifact.mechanic === 'alloc') {
        for (let i = 0; i < 5; i++) {
            const y = miniData.startY + i * miniData.spacing;
            const bx = 120;
            if (my > y - 20 && my < y + 20 && mx > bx && mx < bx + miniData.barW) {
                state.dragTarget = { type: 'bar', index: i };
                updateBar(i, mx, bx);
                return;
            }
        }
    } else if (state.activeArtifact.mechanic === 'svd') {
        const sw = miniData.chartW / miniData.sigma.length;
        for (let i = 0; i < miniData.sigma.length; i++) {
            const bx = miniData.startX + i * sw + sw * 0.1;
            if (mx > bx && mx < bx + sw * 0.8 && my > miniData.startY && my < miniData.startY + miniData.chartH) {
                miniData.k = i + 1;
                drawMinigame();
                return;
            }
        }
    } else if (state.activeArtifact.mechanic === 'sync') {
        for (const n of miniData.nodes) {
            if (Math.hypot(mx - n.x, my - n.y) < 22) {
                if (miniData.route.length === 0) {
                    if (n.id === 'α') miniData.route.push(n.id);
                } else {
                    const last = miniData.route[miniData.route.length - 1];
                    if (n.id === last) {
                        if (miniData.route.length > 1) miniData.route.pop();
                    } else if (!miniData.route.includes(n.id)) {
                        const edge = miniData.edges.find(e => e.from === last && e.to === n.id);
                        if (edge) miniData.route.push(n.id);
                    }
                }
                drawMinigame();
                return;
            }
        }
    }
}

function handleMinigameDrag(e) {
    if (!state.dragTarget) return;
    const rect = miniCanvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (miniCanvas.width / rect.width);
    const my = (e.clientY - rect.top) * (miniCanvas.height / rect.height);

    if (state.dragTarget.type === 'pathPoint') {
        state.dragTarget.point.x = Mathx.clamp(mx, 20, miniCanvas.width - 20);
        state.dragTarget.point.y = Mathx.clamp(my, 20, miniCanvas.height - 20);
        drawMinigame();
    } else if (state.dragTarget.type === 'slider') {
        const sl = miniData.sliders[state.dragTarget.index];
        const raw = (mx - sl.x) / 20;
        miniData.coeffs[state.dragTarget.index] = Mathx.clamp(raw, -5, 5);
        drawMinigame();
    } else if (state.dragTarget.type === 'bar') {
        updateBar(state.dragTarget.index, mx, 120);
        drawMinigame();
    }
}

function updateBar(index, mx, bx) {
    const local = Math.max(0, mx - bx);
    miniData.t[index] = (local / miniData.barW) * 20;
}

function drawMinigame() {
    if (!state.activeArtifact) return;
    switch (state.activeArtifact.mechanic) {
        case 'path': drawPathGame(); break;
        case 'signal': drawSignalGame(); break;
        case 'alloc': drawAllocGame(); break;
        case 'svd': drawSVDGame(); break;
        case 'sync': drawSyncGame(); break;
    }
}

/* ─── Submit ─── */
document.getElementById('miniReset').addEventListener('click', () => {
    if (!state.activeArtifact) return;
    switch (state.activeArtifact.mechanic) {
        case 'path': initPathGame(); break;
        case 'signal': initSignalGame(); break;
        case 'alloc': initAllocGame(); break;
        case 'svd': initSVDGame(); break;
        case 'sync': initSyncGame(); break;
    }
    drawMinigame();
});

document.getElementById('miniSubmit').addEventListener('click', submitMinigame);

function submitMinigame() {
    if (!state.activeArtifact) return;
    const art = state.activeArtifact;
    let stars = 1, gap = 1.0, bonus = 100;

    switch (art.mechanic) {
        case 'path': {
            const T = computePathTime();
            gap = Math.abs(T - miniData.Topt) / miniData.Topt;
            if (gap < 0.05) { stars = 3; bonus = 1000; }
            else if (gap < 0.15) { stars = 2; bonus = 500; }
            break;
        }
        case 'signal': {
            let err = 0;
            for (const s of miniData.samples) {
                let fit = 0;
                for (let j = 0; j < 3; j++) fit += miniData.coeffs[j] * miniData.bases[j](s.t);
                const r = s.val - fit;
                err += r * r;
            }
            const res = Math.sqrt(err);
            gap = Math.min(res / 8, 1);
            if (res < 3) { stars = 3; bonus = 1000; }
            else if (res < 6) { stars = 2; bonus = 500; }
            break;
        }
        case 'alloc': {
            const used = miniData.t.reduce((s, ti, i) => s + miniData.P[i] * ti, 0);
            const obj = Mathx.objectiveAlloc(miniData.a, miniData.t);
            const opt = Mathx.objectiveAlloc(miniData.a, Mathx.optimalAllocation(miniData.a, miniData.P, miniData.E));
            gap = used > miniData.E ? 0.5 : Math.abs(opt - obj) / opt;
            if (used <= miniData.E && gap < 0.02) { stars = 3; bonus = 1000; }
            else if (used <= miniData.E && gap < 0.1) { stars = 2; bonus = 500; }
            else if (used > miniData.E) { stars = 1; bonus = 50; }
            break;
        }
        case 'svd': {
            const totalVar = miniData.sigma.reduce((s, v) => s + v*v, 0);
            const kept = miniData.sigma.slice(0, miniData.k).reduce((s, v) => s + v*v, 0);
            const infoRatio = kept / totalVar;
            const storeRatio = miniData.k / miniData.sigma.length;
            const score = infoRatio / (1 + 2 * storeRatio);
            gap = 1 - score;
            if (miniData.k >= 3 && miniData.k <= 5 && infoRatio > 0.95) { stars = 3; bonus = 1000; }
            else if (miniData.k >= 2 && miniData.k <= 6 && infoRatio > 0.85) { stars = 2; bonus = 500; }
            break;
        }
        case 'sync': {
            let totalTime = 0, violations = 0;
            for (let i = 1; i < miniData.route.length; i++) {
                const e = miniData.edges.find(ed => ed.from === miniData.route[i-1] && ed.to === miniData.route[i]);
                if (e) totalTime += e.t;
                const node = miniData.nodes.find(n => n.id === miniData.route[i]);
                if (node.tw) {
                    if (totalTime < node.tw[0] || totalTime > node.tw[1]) violations++;
                }
            }
            const valid = miniData.route[miniData.route.length - 1] === 'Ω';
            gap = valid && violations === 0 ? 0 : 0.5;
            if (valid && violations === 0 && totalTime < 90) { stars = 3; bonus = 1000; }
            else if (valid && violations === 0) { stars = 2; bonus = 500; }
            break;
        }
    }

    state.chronitonen += bonus;
    state.solved++;
    if (stars === 3) state.optimal++;
    art.solved = true;
    spawnParticles(art.x, art.y, 16);
    closeMinigame();
    showResult(stars, bonus, gap);
}

function showResult(stars, bonus, gap) {
    const panel = document.getElementById('resultPanel');
    document.getElementById('resultStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    document.getElementById('resultText').textContent = `+${bonus} Chronitonen  |  Lücke: ${(gap * 100).toFixed(1)}%`;
    panel.classList.add('active');
}

function closeResult() {
    document.getElementById('resultPanel').classList.remove('active');
    state.phase = 'world';
}

/* ─── Main Loop ─── */
function loop(now) {
    const dt = Math.min((now - state.lastTime) / 1000, 0.05);
    state.lastTime = now;

    if (state.phase === 'world') {
        state.totalTime += dt;
        updateMovement(dt);
        updateParticles(dt);
        updateHUD();
    }

    // Render
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (state.phase !== 'intro') {
        drawWorld(ctx);
        drawParticles(ctx);
    }

    requestAnimationFrame(loop);
}

/* ─── Start ─── */
loadAssets(() => {
    initArtifacts();
    requestAnimationFrame(loop);
});
