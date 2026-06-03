/* ───────── DOM refs ───────── */
const canvas = document.getElementById("power-plot");
const ctx = canvas.getContext("2d");
const canvasNutrients = document.getElementById("nutrients-plot");
const ctxN = canvasNutrients.getContext("2d");

const sliderDen = document.getElementById("slider-density");
const sliderEff = document.getElementById("slider-efficiency");
const sliderVmin = document.getElementById("slider-vmin");
const sliderVpeak = document.getElementById("slider-vpeak");
const sliderLopt = document.getElementById("slider-lopt");
const sliderDemBase = document.getElementById("slider-demand-base");
const sliderDemSlope = document.getElementById("slider-demand-slope");
const sliderLen = document.getElementById("slider-length");
const sliderPressure = document.getElementById("slider-pressure");
const sliderCell = document.getElementById("slider-cell");
const btnPrecipYes = document.getElementById("precip-yes");
const btnPrecipNo = document.getElementById("precip-no");

const valDen = document.getElementById("val-density");
const valEff = document.getElementById("val-efficiency");
const valVmin = document.getElementById("val-vmin");
const valVpeak = document.getElementById("val-vpeak");
const valLopt = document.getElementById("val-lopt");
const valLoptFormula = document.getElementById("val-lopt-formula");
const valDemBase = document.getElementById("val-demand-base");
const valDemSlope = document.getElementById("val-demand-slope");
const valLen = document.getElementById("val-length");
const valPressure = document.getElementById("val-pressure");
const valCell = document.getElementById("val-cell");

const outVeff = document.getElementById("out-veff");
const outKin = document.getElementById("out-kinetic");
const outCap = document.getElementById("out-captured");
const outCapEff = document.getElementById("out-capt-eff");
const outAtp = document.getElementById("out-atp");
const outDemand = document.getElementById("out-demand");
const outSur = document.getElementById("out-surplus");
const outMeets = document.getElementById("out-meets");
const outWasteS = document.getElementById("out-waste-s");
const outWasteSO4 = document.getElementById("out-waste-so4");
const outWasteCH4 = document.getElementById("out-waste-ch4");
const outWasteFe = document.getElementById("out-waste-fe");
const outWasteHeat = document.getElementById("out-waste-heat");
const outNutH2S = document.getElementById("out-nut-h2s");
const outNutCH4 = document.getElementById("out-nut-ch4");
const outNutFe = document.getElementById("out-nut-fe");
const outNutSi = document.getElementById("out-nut-si");
const outNutBa = document.getElementById("out-nut-ba");
const resultPanel = document.getElementById("result-panel");

/* ───────── Physics constants ───────── */
const ENERGY_PER_ATP = 5.07e-20; // J (Alberty 2003)
const SIGMA = 1; // fixed narrow bell-curve width (µm)
const MINERAL_BONUS = 0.15; // β — 15 % Bioverfügbarkeits-Bonus
const PRESSURE_EUROPA_BAR = 2600; // Ozeanboden-Druck Europa
const MU_WATER_0C = 1.8e-3; // Pa·s (Seewasser 0 °C)
const FLAGELLUM_RADIUS = 20e-9; // 20 nm (Wikipedia "Flagellum")
const LOPT_ALPHA = 8.0; // Proportionalitätsfaktor — empirisch kalibriert auf E. coli (~15 µm)

/* ───────── Nährstoff-Referenzkonzentrationen (Black Smoker) ─────────
   Quellen: German & Seyfried 2014; Wikipedia "Hydrothermal vent" */
const NUTRIENT_REF = {
  H2S: 110,   // mmol/kg — German & Seyfried 2014
  CH4: 1.0,   // mmol/kg
  Fe: 24,     // mmol/kg — Rainbow Vent Field
  Si: 20,     // mmol/kg — gelöstes SiO₂
  Ba: 1.0,    // mmol/kg
};
/* Druck-Ausfällungs-Parameter (bar) [P_start, P_scale] für tanh:
   Bei P_start beginnt die Ausfällung; über P_scale bar ist sie ~63 % komplett.
   Wenn precipitates=false, sind diese Kurven neutralisiert (volle Löslichkeit). */
const PRECIP_PARAMS = {
  H2S: { start: 500,  scale: 1000, frac: 0.5 },  // Pyrit/Chalkopyrit-Bildung
  Fe:  { start: 300,  scale:  800, frac: 0.7 },  // Pyrit/Chalkopyrit
  Si:  { start: 200,  scale: 1500, frac: 0.3 },  // Quarz-Fällung
  Ba:  { start: 100,  scale:  600, frac: 0.6 },  // Baryt
  CH4: { start: 5000, scale: 1000, frac: 0.0 },  // CH₄ bleibt gelöst (Gashydrate erst bei Tiefst-T)
};

/* ───────── State ───────── */
let state = {
  density: 1000,
  efficiency: 0.5,
  v_min: 0.001,    // m/s — Grenzschicht
  v_peak: 0.05,    // m/s = 5 cm/s — Stokes-Regime (Re << 1) garantiert
  l_opt: 15,       // wird live aus Formel überschrieben
  demand_base: 1e-15,
  demand_slope: 2.86e-15,
  length: 10,
  pressure: 2600,
  precipitates: false,
  cell_size: 2.0,  // µm (Bakterien-Zellgröße; default E. coli)
};

let hoverPoint = null;
let hoverNutrient = null;

/* ───────── Helpers ───────── */
function fmtExp(v) {
  if (v === 0) return "0";
  if (!isFinite(v)) return "∞";
  const exp = Math.floor(Math.log10(Math.abs(v)));
  const mant = (v / 10 ** exp).toFixed(2);
  return `${mant}e${exp}`;
}
function fmtFixed(v, d = 2) {
  return v.toFixed(d);
}

/* ───────── Physics engine ───────── */
function calcEffectiveVelocity(L, v_min, v_peak, l_opt, sigma) {
  const dx = (L - l_opt) / sigma;
  return v_min + (v_peak - v_min) * Math.exp(-dx * dx);
}
function calcArea(lengthM) {
  return Math.PI * lengthM * lengthM;
}
function calcKineticPower(density, area, velocity) {
  // Im Stokes-Regime (Re << 1) skaliert die Drag-Kraft LINEAR mit v (F ∝ μ·L·v),
  // die mechanische Leistung daher QUADRATISCH (P = F·v ∝ v²).
  // F_drag = 4πμL·v_eff / ln(L/a) (Slender-Body, senkrecht zur Strömung)
  // P = F · v_eff  →  P ∝ v_eff²
  // Konstante k = 4π / ln(L/a) (dimensionsloser Faktor, typisch 1–3)
  // Vereinfacht: P = ½ · ρ · A · v² · v (Faktor v in der kinematischen Skala)
  // Im Tool: P_kin = k_stokes · μ · L · v²  mit k_stokes = 4π / ln(L/a) ≈ 2
  // Wir nutzen eine generische Form P = c · μ · L · v² , c ≈ 2·10⁻⁶ (SI)
  return 2.0 * MU_WATER_0C * Math.sqrt(area / Math.PI) * velocity * velocity;
}
function calcCapturedPower(kin, eff) {
  return kin * eff;
}
function calcMineralBonus(p_precipitates) {
  return p_precipitates ? 0 : MINERAL_BONUS;
}
function calcCapturedEffective(cap, bonus) {
  return cap * (1 + bonus);
}
function calcAtpPerSecond(captured) {
  if (Math.abs(captured) < 1e-30) return 0;
  return captured / ENERGY_PER_ATP;
}
function calcMetabolicDemand(L, base, slope) {
  return base + slope * L;
}
function calcSlenderBodyForce(mu, Lm, u) {
  if (Lm < 1e-9) return 0;
  const logTerm = Math.log(Lm / FLAGELLUM_RADIUS) + 0.5;
  if (logTerm <= 0) return 0;
  return (4 * Math.PI * mu * Lm * u) / logTerm;
}

/* ───────── Auto-berechnete optimale Länge L_opt ─────────
   Aus Boundary-Layer-Theorie (Prandtl):
   δ ≈ 5 · √(ν · x / v_∞)   mit ν = μ/ρ
   Bei Bakterien-Größenordnung:
   L_opt ≈ α · √(μ · L_cell / (ρ · v_peak))    [m]
   Mit α = 8 ergibt sich für E. coli (L_cell=2µm, μ=1.8mPa·s, ρ=1000, v_peak=1):
   L_opt = 8 · √(1.8e-3 · 2e-6 / 1000 / 1) = 8 · 1.9e-6 m = 15.2 µm ✓ */
function calcOptLength(cellSizeUm, density, mu, v_peak) {
  if (v_peak <= 0) return 0;
  const cellM = cellSizeUm * 1e-6;
  const inner = (mu * cellM) / (density * v_peak);
  if (inner <= 0) return 0;
  const LoptM = LOPT_ALPHA * Math.sqrt(inner);
  return LoptM * 1e6; // zurück in µm
}

function calcWasteProducts(atpPerSec) {
  const molH2S = atpPerSec * 0.1;
  const molS0 = molH2S * 0.80;
  const molSO4 = molH2S * 0.20;
  const molCH4 = molH2S * 0.05;
  const molFe = molH2S * 0.05;
  const heatW = atpPerSec * ENERGY_PER_ATP * 0.001;
  return { S: molS0, SO4: molSO4, CH4: molCH4, Fe: molFe, heat: heatW };
}

/* ───────── Nährstoff-Konzentrationen ─────────
   p_bar: Druck in bar
   precipitates: boolean (true = Minerale fallen aus, false = bleiben gelöst) */
function calcNutrientConcentration(species, p_bar, precipitates) {
  const ref = NUTRIENT_REF[species];
  const params = PRECIP_PARAMS[species];
  if (!precipitates) return ref; // alles gelöst, keine Ausfällung
  if (params.frac === 0) return ref; // CH₄ bleibt
  // tanh-Modell: ab p_start setzt Ausfällung ein
  const x = (p_bar - params.start) / params.scale;
  const factor = 1 - params.frac * 0.5 * (1 + Math.tanh(x));
  return ref * factor;
}

function runPhysics(s) {
  const lengthM = s.length * 1e-6;
  const area = calcArea(lengthM);
  const v_eff = calcEffectiveVelocity(s.length, s.v_min, s.v_peak, s.l_opt, SIGMA);
  const kin = calcKineticPower(s.density, area, v_eff);
  const cap = calcCapturedPower(kin, s.efficiency);
  const bonus = calcMineralBonus(s.precipitates);
  const capEff = calcCapturedEffective(cap, bonus);
  const atp = calcAtpPerSecond(capEff);
  const demand = calcMetabolicDemand(s.length, s.demand_base, s.demand_slope);
  const surplus = capEff - demand;
  const waste = calcWasteProducts(atp);
  const slenderF = calcSlenderBodyForce(MU_WATER_0C, lengthM, v_eff);

  // Nährstoffe
  const nut = {
    H2S: calcNutrientConcentration("H2S", s.pressure, s.precipitates),
    CH4: calcNutrientConcentration("CH4", s.pressure, s.precipitates),
    Fe:  calcNutrientConcentration("Fe",  s.pressure, s.precipitates),
    Si:  calcNutrientConcentration("Si",  s.pressure, s.precipitates),
    Ba:  calcNutrientConcentration("Ba",  s.pressure, s.precipitates),
  };

  return {
    v_eff, kin, cap, capEff, bonus, atp, demand, surplus,
    meets: surplus >= 0, waste, slenderF, nut,
  };
}

function generateLengthSeries(minUm, maxUm, n = 300) {
  const logMin = Math.log10(minUm);
  const logMax = Math.log10(maxUm);
  const step = (logMax - logMin) / (n - 1);
  const arr = [];
  for (let i = 0; i < n; i++) arr.push(10 ** (logMin + i * step));
  return arr;
}

/* ───────── Canvas: Power-Plot ───────── */
const M = { t: 40, r: 40, b: 60, l: 70 };

function resizeCanvas() {
  for (const c of [canvas, canvasNutrients]) {
    const rect = c.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    c.style.width = rect.width + "px";
    c.style.height = rect.height + "px";
    const c2 = c.getContext("2d");
    c2.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  drawPlot();
  drawNutrientsPlot();
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
  const kinW = [], capW = [], capEffW = [], demW = [];
  let maxY = 0, minPositiveY = Infinity;
  const bonus = calcMineralBonus(state.precipitates);

  for (const l of lengths) {
    const lm = l * 1e-6;
    const area = calcArea(lm);
    const v_eff = calcEffectiveVelocity(l, state.v_min, state.v_peak, state.l_opt, SIGMA);
    const k = calcKineticPower(state.density, area, v_eff);
    const c = calcCapturedPower(k, state.efficiency);
    const cE = c * (1 + bonus);
    const d = calcMetabolicDemand(l, state.demand_base, state.demand_slope);
    kinW.push(k); capW.push(c); capEffW.push(cE); demW.push(d);
    if (k > 0 && k < minPositiveY) minPositiveY = k;
    if (c > 0 && c < minPositiveY) minPositiveY = c;
    if (cE > 0 && cE < minPositiveY) minPositiveY = cE;
    if (d > 0 && d < minPositiveY) minPositiveY = d;
    if (k > maxY) maxY = k;
    if (c > maxY) maxY = c;
    if (cE > maxY) maxY = cE;
    if (d > maxY) maxY = d;
  }

  let yMin = Math.max(1e-20, minPositiveY * 0.3);
  let yMax = Math.max(maxY * 1.5, 1e-13);
  if (yMax <= yMin) yMax = yMin * 10;
  const niceMin = 10 ** Math.floor(Math.log10(yMin));
  const niceMax = 10 ** Math.ceil(Math.log10(yMax));

  function xPx(val) { return mapLog(val, 0.1, 200, M.l, M.l + w); }
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
  for (const t of xTicks) ctx.fillText(t + " µm", xPx(t), M.t + h + 18);
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

  // Metabolic demand curve (red)
  ctx.strokeStyle = "#e74c3c";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < lengths.length; i++) {
    const x = xPx(lengths[i]);
    const y = yPx(demW[i]);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
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
    const x = xPx(lengths[i]); const y = yPx(kinW[i]);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Captured power curve (green)
  ctx.strokeStyle = "#2ecc71";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < lengths.length; i++) {
    const x = xPx(lengths[i]); const y = yPx(capW[i]);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Captured effective (orange, gestrichelt) bei Bonus
  if (bonus > 0) {
    ctx.strokeStyle = "#f39c12";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    for (let i = 0; i < lengths.length; i++) {
      const x = xPx(lengths[i]); const y = yPx(capEffW[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // L_opt-Linie (orange dotted)
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

  // Marker
  const xCurr = xPx(state.length);
  const phys = runPhysics(state);
  const yCurr = yPx(Math.max(phys.capEff, niceMin * 1.1));
  ctx.beginPath();
  ctx.arc(xCurr, yCurr, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#fbbf24";
  ctx.fill();
  ctx.strokeStyle = "#020617";
  ctx.lineWidth = 2;
  ctx.stroke();

  const idx = lengths.findIndex((l) => Math.abs(l - state.length) < 0.5);
  if (idx >= 0) {
    const capVal = capEffW[idx];
    const demVal = demW[idx];
    const ratio = capVal / demVal;
    ctx.fillStyle = ratio >= 1 ? "#2ecc71" : "#e74c3c";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText((ratio >= 1 ? "+" : "") + ratio.toFixed(1) + "× Bedarf", xCurr, yCurr + 10);
  }

  if (hoverPoint) {
    ctx.fillStyle = "rgba(15,23,42,0.95)";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    const tw = 190, th = 110;
    let tx = hoverPoint.x + 12, ty = hoverPoint.y + 12;
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
    ctx.fillStyle = "#f39c12";
    ctx.fillText("P_capt,eff = " + fmtExp(hoverPoint.capEff), tx + 8, ty + 62);
    ctx.fillStyle = "#e74c3c";
    ctx.fillText("P_meta = " + fmtExp(hoverPoint.dem), tx + 8, ty + 80);
  }
}

/* ───────── Canvas: Nährstoff-Plot (Druck vs. Konzentration) ───────── */
const SPECIES_COLORS = {
  H2S: "#f59e0b",  // amber
  CH4: "#8b5cf6",  // violett
  Fe:  "#ef4444",  // rot
  Si:  "#06b6d4",  // cyan
  Ba:  "#84cc16",  // lime
};
const SPECIES_LABELS = {
  H2S: "H₂S",
  CH4: "CH₄",
  Fe:  "Fe²⁺",
  Si:  "SiO₂",
  Ba:  "Ba²⁺",
};

function drawNutrientsPlot() {
  const W = canvasNutrients.width / (window.devicePixelRatio || 1);
  const H = canvasNutrients.height / (window.devicePixelRatio || 1);
  const w = W - M.l - M.r;
  const h = H - M.t - M.b;

  ctxN.clearRect(0, 0, W, H);

  // X: Druck 1 .. 3000 bar (log)
  // Y: Konzentration 0.01 .. 200 mmol/kg (log)
  const xMin = 1, xMax = 3000;
  const yMin = 0.01, yMax = 200;

  function xPx(val) { return mapLog(val, xMin, xMax, M.l, M.l + w); }
  function yPx(val) { return mapLog(val, yMin, yMax, M.t + h, M.t); }

  // Grid
  ctxN.strokeStyle = "rgba(51,65,85,0.4)";
  ctxN.lineWidth = 1;
  const xTicks = [1, 10, 100, 1000, 3000];
  for (const t of xTicks) {
    const x = xPx(t);
    ctxN.beginPath();
    ctxN.moveTo(x, M.t);
    ctxN.lineTo(x, M.t + h);
    ctxN.stroke();
  }
  const yTicks = [0.01, 0.1, 1, 10, 100];
  for (const t of yTicks) {
    const y = yPx(t);
    if (y < M.t || y > M.t + h) continue;
    ctxN.beginPath();
    ctxN.moveTo(M.l, y);
    ctxN.lineTo(M.l + w, y);
    ctxN.stroke();
  }

  // Axes
  ctxN.strokeStyle = "#475569";
  ctxN.lineWidth = 1.5;
  ctxN.beginPath();
  ctxN.moveTo(M.l, M.t);
  ctxN.lineTo(M.l, M.t + h);
  ctxN.lineTo(M.l + w, M.t + h);
  ctxN.stroke();

  // Labels X
  ctxN.fillStyle = "#94a3b8";
  ctxN.font = "10px Inter, sans-serif";
  ctxN.textAlign = "center";
  ctxN.textBaseline = "top";
  for (const t of xTicks) ctxN.fillText(t === 1 ? "1" : t + "", xPx(t), M.t + h + 18);
  ctxN.fillText("Druck (bar)", M.l + w / 2, H - 8);
  // Europäische Druck-Annotation
  ctxN.fillStyle = "#06b6d4";
  ctxN.font = "italic 9px Inter, sans-serif";
  ctxN.fillText("Europa ≈ 2 600 bar", xPx(2600), M.t + h + 32);

  // Labels Y
  ctxN.textAlign = "right";
  ctxN.textBaseline = "middle";
  for (const t of yTicks) {
    const y = yPx(t);
    if (y < M.t - 5 || y > M.t + h + 5) continue;
    ctxN.fillText(t < 1 ? t.toString() : t.toString(), M.l - 8, y);
  }
  ctxN.save();
  ctxN.translate(14, M.t + h / 2);
  ctxN.rotate(-Math.PI / 2);
  ctxN.textAlign = "center";
  ctxN.fillText("Konzentration (mmol/kg)", 0, 0);
  ctxN.restore();

  // 200 Stützstellen für glatte Kurven
  const N = 200;
  const logMin = Math.log10(xMin);
  const logMax = Math.log10(xMax);
  const pressures = [];
  for (let i = 0; i < N; i++) {
    pressures.push(10 ** (logMin + (i / (N - 1)) * (logMax - logMin)));
  }

  for (const sp of Object.keys(SPECIES_COLORS)) {
    const concs = pressures.map((p) => calcNutrientConcentration(sp, p, state.precipitates));
    ctxN.strokeStyle = SPECIES_COLORS[sp];
    ctxN.lineWidth = 2;
    ctxN.beginPath();
    for (let i = 0; i < N; i++) {
      const x = xPx(pressures[i]);
      const y = yPx(concs[i]);
      if (i === 0) ctxN.moveTo(x, y); else ctxN.lineTo(x, y);
    }
    ctxN.stroke();

    // End-Label
    const lastConc = concs[N - 1];
    const lastY = yPx(lastConc);
    ctxN.fillStyle = SPECIES_COLORS[sp];
    ctxN.textAlign = "left";
    ctxN.textBaseline = "middle";
    ctxN.font = "bold 10px Inter, sans-serif";
    if (lastY > M.t + 4 && lastY < M.t + h - 4) {
      ctxN.fillText(SPECIES_LABELS[sp], M.l + w + 4, lastY);
    }
  }

  // Aktueller Druck-Marker (vertikale Linie)
  const xCurr = xPx(state.pressure);
  if (xCurr >= M.l && xCurr <= M.l + w) {
    ctxN.strokeStyle = "rgba(251, 191, 36, 0.6)";
    ctxN.lineWidth = 1.5;
    ctxN.setLineDash([3, 3]);
    ctxN.beginPath();
    ctxN.moveTo(xCurr, M.t);
    ctxN.lineTo(xCurr, M.t + h);
    ctxN.stroke();
    ctxN.setLineDash([]);

    // Marker-Punkte an den Schnittstellen
    for (const sp of Object.keys(SPECIES_COLORS)) {
      const c = calcNutrientConcentration(sp, state.pressure, state.precipitates);
      const y = yPx(c);
      if (y >= M.t && y <= M.t + h) {
        ctxN.beginPath();
        ctxN.arc(xCurr, y, 4, 0, Math.PI * 2);
        ctxN.fillStyle = SPECIES_COLORS[sp];
        ctxN.fill();
        ctxN.strokeStyle = "#020617";
        ctxN.lineWidth = 1.5;
        ctxN.stroke();
      }
    }
    ctxN.fillStyle = "#fbbf24";
    ctxN.font = "bold 10px Inter, sans-serif";
    ctxN.textAlign = "center";
    ctxN.textBaseline = "bottom";
    ctxN.fillText("p = " + state.pressure + " bar", xCurr, M.t - 4);
  }

  // Hover-Tooltip
  if (hoverNutrient) {
    ctxN.fillStyle = "rgba(15,23,42,0.95)";
    ctxN.strokeStyle = "#334155";
    ctxN.lineWidth = 1;
    const tw = 200, th = 120;
    let tx = hoverNutrient.x + 12, ty = hoverNutrient.y + 12;
    if (tx + tw > W) tx = hoverNutrient.x - tw - 12;
    if (ty + th > H) ty = hoverNutrient.y - th - 12;
    ctxN.fillRect(tx, ty, tw, th);
    ctxN.strokeRect(tx, ty, tw, th);
    ctxN.fillStyle = "#e2e8f0";
    ctxN.textAlign = "left";
    ctxN.textBaseline = "top";
    ctxN.font = "11px Inter, sans-serif";
    ctxN.fillText("p = " + hoverNutrient.pressure.toFixed(0) + " bar", tx + 8, ty + 8);
    let yi = 26;
    for (const sp of Object.keys(SPECIES_COLORS)) {
      const c = calcNutrientConcentration(sp, hoverNutrient.pressure, state.precipitates);
      ctxN.fillStyle = SPECIES_COLORS[sp];
      ctxN.fillText(SPECIES_LABELS[sp] + ": " + c.toFixed(2) + " mmol/kg", tx + 8, ty + yi);
      yi += 16;
    }
  }
}

/* ───────── Update UI from state ───────── */
function updateUI() {
  // L_opt aus Formel berechnen (überschreibt jeden Slider-Input — Slider ist read-only)
  const lopt = calcOptLength(state.cell_size, state.density, MU_WATER_0C, state.v_peak);
  state.l_opt = lopt;
  // L auf L_opt setzen, falls noch im Auto-Modus (length == previous l_opt)
  // Hier: NICHT automatisch — User kann L unabhängig setzen.

  const phys = runPhysics(state);

  valDen.textContent = state.density.toFixed(0);
  valEff.textContent = fmtFixed(state.efficiency, 2);
  valVmin.textContent = state.v_min.toFixed(4);
  valVpeak.textContent = state.v_peak.toFixed(3);
  valLopt.textContent = fmtFixed(lopt, 1) + " µm";
  if (valLoptFormula) valLoptFormula.textContent = fmtFixed(lopt, 2);
  valDemBase.textContent = fmtExp(state.demand_base);
  valDemSlope.textContent = fmtExp(state.demand_slope);
  valLen.textContent = fmtFixed(state.length, 1);
  valPressure.textContent = state.pressure.toFixed(0);
  valCell.textContent = fmtFixed(state.cell_size, 1) + " µm";

  sliderDen.value = state.density;
  sliderEff.value = state.efficiency;
  sliderVmin.value = state.v_min;
  sliderVpeak.value = state.v_peak;
  sliderLopt.value = lopt; // read-only, nur Anzeige
  sliderLen.value = state.length;
  sliderDemBase.value = Math.log10(state.demand_base).toFixed(1);
  sliderDemSlope.value = Math.log10(state.demand_slope).toFixed(1);
  sliderPressure.value = state.pressure;
  sliderCell.value = state.cell_size;

  if (state.precipitates) {
    btnPrecipYes.className = "flex-1 text-[10px] uppercase tracking-widest py-2 border border-neon-amber text-neon-amber bg-neon-amber/10";
    btnPrecipNo.className = "flex-1 text-[10px] uppercase tracking-widest py-2 border border-slate-700 text-slate-400 hover:border-neon-cyan hover:text-neon-cyan transition-colors";
  } else {
    btnPrecipNo.className = "flex-1 text-[10px] uppercase tracking-widest py-2 border border-neon-cyan/40 text-neon-cyan bg-neon-cyan/5";
    btnPrecipYes.className = "flex-1 text-[10px] uppercase tracking-widest py-2 border border-slate-700 text-slate-400 hover:border-neon-amber hover:text-neon-amber transition-colors";
  }

  outVeff.textContent = fmtFixed(phys.v_eff, 4) + " m/s";
  outKin.textContent = fmtExp(phys.kin) + " W";
  outCap.textContent = fmtExp(phys.cap) + " W";
  outCapEff.textContent = fmtExp(phys.capEff) + " W" + (phys.bonus > 0 ? "  (+" + (phys.bonus * 100).toFixed(0) + "%)" : "");
  outAtp.textContent = fmtExp(phys.atp) + " /s";
  outDemand.textContent = fmtExp(phys.demand) + " W";
  outSur.textContent = fmtExp(phys.surplus) + " W";
  outSur.className = "text-sm font-mono " + (phys.surplus >= 0 ? "text-neon-cyan" : "text-neon-rose");
  outMeets.textContent = phys.meets ? "✓ Erfüllt" : "✗ Defizit";
  outMeets.className = "text-xs font-mono " + (phys.meets ? "text-neon-cyan" : "text-neon-rose");

  outWasteS.textContent = fmtExp(phys.waste.S) + " mol/s";
  outWasteSO4.textContent = fmtExp(phys.waste.SO4) + " mol/s";
  outWasteCH4.textContent = fmtExp(phys.waste.CH4) + " mol/s";
  outWasteFe.textContent = fmtExp(phys.waste.Fe) + " mol/s";
  outWasteHeat.textContent = fmtExp(phys.waste.heat) + " W";

  // Nährstoffe (Anzeige der Konzentrationen beim aktuellen Druck)
  outNutH2S.textContent = fmtFixed(phys.nut.H2S, 2) + " mmol/kg";
  outNutCH4.textContent = fmtFixed(phys.nut.CH4, 2) + " mmol/kg";
  outNutFe.textContent  = fmtFixed(phys.nut.Fe, 2)  + " mmol/kg";
  outNutSi.textContent  = fmtFixed(phys.nut.Si, 2)  + " mmol/kg";
  outNutBa.textContent  = fmtFixed(phys.nut.Ba, 2)  + " mmol/kg";

  drawPlot();
  drawNutrientsPlot();
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
sliderPressure.addEventListener("input", (e) => {
  state.pressure = parseFloat(e.target.value);
  updateUI();
});
sliderCell.addEventListener("input", (e) => {
  state.cell_size = parseFloat(e.target.value);
  updateUI();
});
btnPrecipYes.addEventListener("click", () => {
  state.precipitates = true;
  updateUI();
});
btnPrecipNo.addEventListener("click", () => {
  state.precipitates = false;
  updateUI();
});

document.getElementById("btn-peak").addEventListener("click", () => {
  state.length = state.l_opt;
  updateUI();
});

/* ───────── Canvas hover / click ───────── */
function getMousePos(evt, c) {
  const rect = c.getBoundingClientRect();
  return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
}
function pxToLength(px) {
  const W = canvas.width / (window.devicePixelRatio || 1);
  const w = W - M.l - M.r;
  const t = (px - M.l) / w;
  return 10 ** (Math.log10(0.1) + t * (Math.log10(200) - Math.log10(0.1)));
}
function pxToPressure(px) {
  const W = canvasNutrients.width / (window.devicePixelRatio || 1);
  const w = W - M.l - M.r;
  const t = (px - M.l) / w;
  return 10 ** (Math.log10(1) + t * (Math.log10(3000) - Math.log10(1)));
}

canvas.addEventListener("mousemove", (e) => {
  const pos = getMousePos(e, canvas);
  const W = canvas.width / (window.devicePixelRatio || 1);
  const H = canvas.height / (window.devicePixelRatio || 1);
  if (pos.x < M.l || pos.x > W - M.r || pos.y < M.t || pos.y > H - M.b) {
    hoverPoint = null;
    drawPlot();
    return;
  }
  const l = pxToLength(pos.x);
  const lm = l * 1e-6;
  const area = calcArea(lm);
  const v_eff = calcEffectiveVelocity(l, state.v_min, state.v_peak, state.l_opt, SIGMA);
  const k = calcKineticPower(state.density, area, v_eff);
  const c = calcCapturedPower(k, state.efficiency);
  const bonus = calcMineralBonus(state.precipitates);
  const cE = c * (1 + bonus);
  const d = calcMetabolicDemand(l, state.demand_base, state.demand_slope);
  hoverPoint = { x: pos.x, y: pos.y, length: l, veff: v_eff, cap: c, capEff: cE, dem: d };
  drawPlot();
});
canvas.addEventListener("mouseleave", () => {
  hoverPoint = null;
  drawPlot();
});
canvas.addEventListener("click", (e) => {
  const pos = getMousePos(e, canvas);
  if (pos.x < M.l || pos.x > canvas.width / (window.devicePixelRatio || 1) - M.r) return;
  const l = pxToLength(pos.x);
  if (l >= 0.1 && l <= 200) {
    state.length = l;
    updateUI();
  }
});

canvasNutrients.addEventListener("mousemove", (e) => {
  const pos = getMousePos(e, canvasNutrients);
  const W = canvasNutrients.width / (window.devicePixelRatio || 1);
  const H = canvasNutrients.height / (window.devicePixelRatio || 1);
  if (pos.x < M.l || pos.x > W - M.r || pos.y < M.t || pos.y > H - M.b) {
    hoverNutrient = null;
    drawNutrientsPlot();
    return;
  }
  const p = pxToPressure(pos.x);
  hoverNutrient = { x: pos.x, y: pos.y, pressure: p };
  drawNutrientsPlot();
});
canvasNutrients.addEventListener("mouseleave", () => {
  hoverNutrient = null;
  drawNutrientsPlot();
});
canvasNutrients.addEventListener("click", (e) => {
  const pos = getMousePos(e, canvasNutrients);
  if (pos.x < M.l || pos.x > canvasNutrients.width / (window.devicePixelRatio || 1) - M.r) return;
  const p = pxToPressure(pos.x);
  if (p >= 1 && p <= 3000) {
    // auf nearest step-10 runden
    state.pressure = Math.round(p / 10) * 10;
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
