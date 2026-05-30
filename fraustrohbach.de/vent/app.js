/* ───────── DOM refs ───────── */
const canvas = document.getElementById("power-plot");
const ctx = canvas.getContext("2d");

const sliderDen = document.getElementById("slider-density");
const sliderEff = document.getElementById("slider-efficiency");
const sliderVmin = document.getElementById("slider-vmin");
const sliderVpeak = document.getElementById("slider-vpeak");
const sliderLopt = document.getElementById("slider-lopt");
const sliderDemBase = document.getElementById("slider-demand-base");
const sliderDemSlope = document.getElementById("slider-demand-slope");
const sliderLen = document.getElementById("slider-length");

const valDen = document.getElementById("val-density");
const valEff = document.getElementById("val-efficiency");
const valVmin = document.getElementById("val-vmin");
const valVpeak = document.getElementById("val-vpeak");
const valLopt = document.getElementById("val-lopt");
const valDemBase = document.getElementById("val-demand-base");
const valDemSlope = document.getElementById("val-demand-slope");
const valLen = document.getElementById("val-length");

const outVeff = document.getElementById("out-veff");
const outKin = document.getElementById("out-kinetic");
const outCap = document.getElementById("out-captured");
const outAtp = document.getElementById("out-atp");
const outDemand = document.getElementById("out-demand");
const outSur = document.getElementById("out-surplus");
const outMeets = document.getElementById("out-meets");
const resultPanel = document.getElementById("result-panel");

/* ───────── Physics constants ───────── */
const ENERGY_PER_ATP = 5.07e-20; // J
const SIGMA = 1; // fixed narrow bell-curve width (µm)

/* ───────── State ───────── */
let state = {
  density: 1000,
  efficiency: 0.5,
  v_min: 0.001,
  v_peak: 0.10,
  l_opt: 15,
  demand_base: 1e-15,
  demand_slope: 2.86e-15, // W/µm so that at L=35 µm demand ≈ 1e-13 W
  length: 10, // µm
};

let hoverPoint = null;

/* ───────── Helpers ───────── */
function fmtExp(v) {
  if (v === 0) return "0";
  const exp = Math.floor(Math.log10(Math.abs(v)));
  const mant = (v / 10 ** exp).toFixed(2);
  return `${mant}e${exp}`;
}
function fmtFixed(v, d = 2) {
  return v.toFixed(d);
}

/* ───────── Physics engine ───────── */
function calcEffectiveVelocity(L, v_min, v_peak, l_opt, sigma) {
  // Gaussian bell for effective velocity vs. length
  const dx = (L - l_opt) / sigma;
  return v_min + (v_peak - v_min) * Math.exp(-dx * dx);
}
function calcArea(lengthM) {
  return Math.PI * lengthM * lengthM;
}
function calcKineticPower(density, area, velocity) {
  return 0.5 * density * area * velocity ** 3;
}
function calcCapturedPower(kin, eff) {
  return kin * eff;
}
function calcAtpPerSecond(captured) {
  if (Math.abs(captured) < 1e-30) return 0;
  return captured / ENERGY_PER_ATP;
}
function calcMetabolicDemand(L, base, slope) {
  return base + slope * L;
}

function runPhysics(s) {
  const lengthM = s.length * 1e-6;
  const area = calcArea(lengthM);
  const v_eff = calcEffectiveVelocity(s.length, s.v_min, s.v_peak, s.l_opt, s.sigma);
  const kin = calcKineticPower(s.density, area, v_eff);
  const cap = calcCapturedPower(kin, s.efficiency);
  const atp = calcAtpPerSecond(cap);
  const demand = calcMetabolicDemand(s.length, s.demand_base, s.demand_slope);
  const surplus = cap - demand;
  return { v_eff, kin, cap, atp, demand, surplus, meets: surplus >= 0 };
}

function generateLengthSeries(minUm, maxUm, n = 300) {
  const logMin = Math.log10(minUm);
  const logMax = Math.log10(maxUm);
  const step = (logMax - logMin) / (n - 1);
  const arr = [];
  for (let i = 0; i < n; i++) arr.push(10 ** (logMin + i * step));
  return arr;
}

/* ───────── Canvas Plot ───────── */
const M = { t: 40, r: 40, b: 60, l: 70 };

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + "px";
  canvas.style.height = rect.height + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawPlot();
}

function mapLog(val, min, max, pixMin, pixMax) {
  const lmin = Math.log10(min);
  const lmax = Math.log10(max);
  const t = (Math.log10(val) - lmin) / (lmax - lmin);
  return pixMin + t * (pixMax - pixMin);
}

function drawPlot() {
  const W = canvas.width / (window.devicePixelRatio || 1);
  const H = canvas.height / (window.devicePixelRatio || 1);
  const w = W - M.l - M.r;
  const h = H - M.t - M.b;

  ctx.clearRect(0, 0, W, H);

  const lengths = generateLengthSeries(0.1, 200, 300);
  const kinW = [];
  const capW = [];
  const demW = [];
  let maxY = 0;
  let minPositiveY = Infinity;

  for (const l of lengths) {
    const lm = l * 1e-6;
    const area = calcArea(lm);
    const v_eff = calcEffectiveVelocity(l, state.v_min, state.v_peak, state.l_opt, state.sigma);
    const k = calcKineticPower(state.density, area, v_eff);
    const c = calcCapturedPower(k, state.efficiency);
    const d = calcMetabolicDemand(l, state.demand_base, state.demand_slope);
    kinW.push(k);
    capW.push(c);
    demW.push(d);
    if (k > 0 && k < minPositiveY) minPositiveY = k;
    if (c > 0 && c < minPositiveY) minPositiveY = c;
    if (d > 0 && d < minPositiveY) minPositiveY = d;
    if (k > maxY) maxY = k;
    if (c > maxY) maxY = c;
    if (d > maxY) maxY = d;
  }

  // Y range
  let yMin = Math.max(1e-20, minPositiveY * 0.3);
  let yMax = Math.max(maxY * 1.5, 1e-13);
  if (yMax <= yMin) yMax = yMin * 10;
  const niceMin = 10 ** Math.floor(Math.log10(yMin));
  const niceMax = 10 ** Math.ceil(Math.log10(yMax));

  function xPx(val) {
    return mapLog(val, 0.1, 200, M.l, M.l + w);
  }
  function yPx(val) {
    if (val <= 0) val = niceMin * 0.5;
    return mapLog(val, niceMin, niceMax, M.t + h, M.t);
  }

  // Grid
  ctx.strokeStyle = "rgba(51,65,85,0.4)";
  ctx.lineWidth = 1;
  const xTicks = [0.1, 1, 10, 100, 200];
  for (const t of xTicks) {
    const x = xPx(t);
    ctx.beginPath();
    ctx.moveTo(x, M.t);
    ctx.lineTo(x, M.t + h);
    ctx.stroke();
  }
  const yTicks = [];
  for (let e = Math.floor(Math.log10(niceMin)); e <= Math.ceil(Math.log10(niceMax)); e++) {
    yTicks.push(10 ** e);
  }
  for (const t of yTicks) {
    const y = yPx(t);
    if (y < M.t || y > M.t + h) continue;
    ctx.beginPath();
    ctx.moveTo(M.l, y);
    ctx.lineTo(M.l + w, y);
    ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(M.l, M.t);
  ctx.lineTo(M.l, M.t + h);
  ctx.lineTo(M.l + w, M.t + h);
  ctx.stroke();

  // Labels X
  ctx.fillStyle = "#94a3b8";
  ctx.font = "10px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const t of xTicks) {
    ctx.fillText(t + " µm", xPx(t), M.t + h + 18);
  }
  ctx.fillText("Flagellum length (µm)", M.l + w / 2, H - 8);

  // Labels Y
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const t of yTicks) {
    const y = yPx(t);
    if (y < M.t - 5 || y > M.t + h + 5) continue;
    ctx.fillText(t.toExponential(0), M.l - 8, y);
  }
  ctx.save();
  ctx.translate(14, M.t + h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("Power (W)", 0, 0);
  ctx.restore();

  // Metabolic demand curve (red solid — now sloped!)
  ctx.strokeStyle = "#e74c3c";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < lengths.length; i++) {
    const x = xPx(lengths[i]);
    const y = yPx(demW[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = "#e74c3c";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.font = "10px Inter, sans-serif";
  ctx.fillText("P_meta(L)", M.l + 4, yPx(demW[0]) - 2);

  // Kinetic power curve (dashed blue)
  ctx.strokeStyle = "#3498db";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  for (let i = 0; i < lengths.length; i++) {
    const x = xPx(lengths[i]);
    const y = yPx(kinW[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Captured power curve (solid green) — the inverted bell!
  ctx.strokeStyle = "#2ecc71";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < lengths.length; i++) {
    const x = xPx(lengths[i]);
    const y = yPx(capW[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // L_opt line (orange dotted)
  const xOpt = xPx(state.l_opt);
  ctx.strokeStyle = "#f39c12";
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(xOpt, M.t);
  ctx.lineTo(xOpt, M.t + h);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#f39c12";
  ctx.font = "bold 11px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("L_opt = " + state.l_opt.toFixed(1) + " µm", xOpt, M.t - 6);

  // Current point marker (yellow circle)
  const xCurr = xPx(state.length);
  const phys = runPhysics(state);
  const yCurr = yPx(Math.max(phys.cap, niceMin * 1.1));

  ctx.beginPath();
  ctx.arc(xCurr, yCurr, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#fbbf24";
  ctx.fill();
  ctx.strokeStyle = "#020617";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Intersection annotation if near crossing
  const idx = lengths.findIndex((l) => Math.abs(l - state.length) < 0.5);
  if (idx >= 0) {
    const capVal = capW[idx];
    const demVal = demW[idx];
    const ratio = capVal / demVal;
    ctx.fillStyle = ratio >= 1 ? "#2ecc71" : "#e74c3c";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText((ratio >= 1 ? "+" : "") + ratio.toFixed(1) + "× Bedarf", xCurr, yCurr + 10);
  }

  // Hover tooltip
  if (hoverPoint) {
    ctx.fillStyle = "rgba(15,23,42,0.95)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    const tw = 170;
    const th = 88;
    let tx = hoverPoint.x + 12;
    let ty = hoverPoint.y + 12;
    if (tx + tw > W) tx = hoverPoint.x - tw - 12;
    if (ty + th > H) ty = hoverPoint.y - th - 12;
    ctx.fillRect(tx, ty, tw, th);
    ctx.strokeRect(tx, ty, tw, th);
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = "11px Inter, sans-serif";
    ctx.fillText("L = " + hoverPoint.length.toFixed(2) + " µm", tx + 8, ty + 8);
    ctx.fillStyle = "#06b6d4";
    ctx.fillText("v_eff = " + hoverPoint.veff.toFixed(4) + " m/s", tx + 8, ty + 26);
    ctx.fillStyle = "#2ecc71";
    ctx.fillText("P_capt = " + fmtExp(hoverPoint.cap), tx + 8, ty + 44);
    ctx.fillStyle = "#e74c3c";
    ctx.fillText("P_meta = " + fmtExp(hoverPoint.dem), tx + 8, ty + 62);
  }
}

/* ───────── Update UI from state ───────── */
function updateUI() {
  const phys = runPhysics(state);

  valDen.textContent = state.density.toFixed(0);
  valEff.textContent = fmtFixed(state.efficiency, 2);
  valVmin.textContent = state.v_min.toFixed(4);
  valVpeak.textContent = state.v_peak.toFixed(3);
  valLopt.textContent = fmtFixed(state.l_opt, 1);
  valDemBase.textContent = fmtExp(state.demand_base);
  valDemSlope.textContent = fmtExp(state.demand_slope);
  valLen.textContent = fmtFixed(state.length, 1);

  sliderDen.value = state.density;
  sliderEff.value = state.efficiency;
  sliderVmin.value = state.v_min;
  sliderVpeak.value = state.v_peak;
  sliderLopt.value = state.l_opt;
  sliderLen.value = state.length;
  sliderDemBase.value = Math.log10(state.demand_base).toFixed(1);
  sliderDemSlope.value = Math.log10(state.demand_slope).toFixed(1);

  outVeff.textContent = fmtFixed(phys.v_eff, 4) + " m/s";
  outKin.textContent = fmtExp(phys.kin) + " W";
  outCap.textContent = fmtExp(phys.cap) + " W";
  outAtp.textContent = fmtExp(phys.atp) + " /s";
  outDemand.textContent = fmtExp(phys.demand) + " W";
  outSur.textContent = fmtExp(phys.surplus) + " W";
  outSur.className = "text-sm font-mono " + (phys.surplus >= 0 ? "text-neon-cyan" : "text-neon-rose");
  outMeets.textContent = phys.meets ? "✓ Erfüllt" : "✗ Defizit";
  outMeets.className = "text-xs font-mono " + (phys.meets ? "text-neon-cyan" : "text-neon-rose");

  drawPlot();
}

/* ───────── Event handlers ───────── */
sliderDen.addEventListener("input", (e) => {
  state.density = parseFloat(e.target.value);
  updateUI();
});
sliderEff.addEventListener("input", (e) => {
  state.efficiency = parseFloat(e.target.value);
  updateUI();
});
sliderVmin.addEventListener("input", (e) => {
  state.v_min = parseFloat(e.target.value);
  updateUI();
});
sliderVpeak.addEventListener("input", (e) => {
  state.v_peak = parseFloat(e.target.value);
  updateUI();
});
sliderLopt.addEventListener("input", (e) => {
  state.l_opt = parseFloat(e.target.value);
  updateUI();
});
sliderDemBase.addEventListener("input", (e) => {
  state.demand_base = 10 ** parseFloat(e.target.value);
  updateUI();
});
sliderDemSlope.addEventListener("input", (e) => {
  state.demand_slope = 10 ** parseFloat(e.target.value);
  updateUI();
});
sliderLen.addEventListener("input", (e) => {
  state.length = parseFloat(e.target.value);
  updateUI();
});

document.getElementById("btn-peak").addEventListener("click", () => {
  state.length = state.l_opt;
  updateUI();
});

// Canvas hover / click
function getMousePos(evt) {
  const rect = canvas.getBoundingClientRect();
  return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
}
function pxToLength(px) {
  const W = canvas.width / (window.devicePixelRatio || 1);
  const w = W - M.l - M.r;
  const t = (px - M.l) / w;
  return 10 ** (Math.log10(0.1) + t * (Math.log10(200) - Math.log10(0.1)));
}

canvas.addEventListener("mousemove", (e) => {
  const pos = getMousePos(e);
  if (pos.x < M.l || pos.x > canvas.width / (window.devicePixelRatio || 1) - M.r ||
      pos.y < M.t || pos.y > canvas.height / (window.devicePixelRatio || 1) - M.b) {
    hoverPoint = null;
    drawPlot();
    return;
  }
  const l = pxToLength(pos.x);
  const lm = l * 1e-6;
  const area = calcArea(lm);
  const v_eff = calcEffectiveVelocity(l, state.v_min, state.v_peak, state.l_opt, state.sigma);
  const k = calcKineticPower(state.density, area, v_eff);
  const c = calcCapturedPower(k, state.efficiency);
  const d = calcMetabolicDemand(l, state.demand_base, state.demand_slope);
  hoverPoint = { x: pos.x, y: pos.y, length: l, veff: v_eff, cap: c, dem: d };
  drawPlot();
});
canvas.addEventListener("mouseleave", () => {
  hoverPoint = null;
  drawPlot();
});
canvas.addEventListener("click", (e) => {
  const pos = getMousePos(e);
  if (pos.x < M.l || pos.x > canvas.width / (window.devicePixelRatio || 1) - M.r) return;
  const l = pxToLength(pos.x);
  if (l >= 0.1 && l <= 200) {
    state.length = l;
    updateUI();
  }
});

window.addEventListener("resize", resizeCanvas);

document.getElementById("run-sim-btn").addEventListener("click", () => {
  resultPanel.classList.remove("hidden");
  updateUI();
});

/* ───────── Init ───────── */
updateUI();
requestAnimationFrame(() => {
  resizeCanvas();
  updateUI();
});
