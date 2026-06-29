#!/usr/bin/env node
/**
 * Robot de synchronisation Protexa → Collab.
 *
 * Se connecte à Protexa (production.protexa.fr), lit les mandats par tiers
 * négociateur (registre Transaction et Gestion) sur l'année civile en cours,
 * VENTILÉS PAR TRIMESTRE (T1=janv-mars … T4=oct-déc), puis envoie le détail à
 * Collab via POST /api/protexa/sync.
 *
 * À lancer SUR LE VPS (réseau ouvert vers Protexa), via cron quotidien.
 * Identifiants et secret passés en VARIABLES D'ENVIRONNEMENT — jamais en clair.
 *
 *   PROTEXA_LOGIN  PROTEXA_PASS  COLLAB_URL  PROTEXA_SYNC_SECRET
 *   PROTEXA_BASE (optionnel)  PROTEXA_YEAR (optionnel)  DIAG=1 (captures)
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.PROTEXA_BASE || "https://production.protexa.fr/ProtexaFullWeb";
const LOGIN = process.env.PROTEXA_LOGIN;
const PASS = process.env.PROTEXA_PASS;
const COLLAB_URL = (process.env.COLLAB_URL || "").replace(/\/+$/, "");
const SECRET = process.env.PROTEXA_SYNC_SECRET;
const YEAR = parseInt(process.env.PROTEXA_YEAR || "", 10) || new Date().getFullYear();
const DIAG = process.env.DIAG === "1";
const HEADFUL = process.env.HEADFUL === "1";

if (!LOGIN || !PASS) fail("PROTEXA_LOGIN / PROTEXA_PASS manquants.");
if (!COLLAB_URL || !SECRET) fail("COLLAB_URL / PROTEXA_SYNC_SECRET manquants.");

if (DIAG) mkdirSync("diag", { recursive: true });
let step = 0;
function fail(msg) { console.error("✖ " + msg); process.exit(1); }
function log(msg) { console.log(msg); }
const quarter = (mm) => Math.min(3, Math.max(0, Math.floor((mm - 1) / 3)));   // 0..3
const lastTwo = (s) => s.trim().split(/\s+/).slice(-2).join(" ");
async function snap(page, tag) { if (!DIAG) return; step++; try { await page.screenshot({ path: `diag/${String(step).padStart(2, "0")}-${tag}.png`, fullPage: true }); } catch { /* ignore */ } }

// Connexion (formulaire WinDev : identifiant « SPxxxxx » puis mot de passe).
async function login(page) {
  log("▶ Connexion à Protexa…");
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  let lf = page.locator('input[placeholder*="SP"]:visible, input[placeholder*="12345"]:visible').first();
  if (!(await lf.count().catch(() => 0))) lf = page.locator("input[type=email]:visible, input[type=text]:visible").first();
  await lf.waitFor({ timeout: 20000 }); await lf.fill(LOGIN);
  let pass = page.locator("input[type=password]:visible").first();
  if (!(await pass.count().catch(() => 0))) { await clickPrimary(page); await page.waitForTimeout(3000); pass = page.locator("input[type=password]:visible").first(); }
  await pass.waitFor({ timeout: 20000 }); await pass.fill(PASS);
  await clickPrimary(page); await page.waitForTimeout(4000);
  const ok = await page.locator("text=/Statistiques|Registre/i").count().catch(() => 0);
  log(ok ? "  ✓ Connecté." : "  ⚠ Menu non détecté.");
}
async function clickPrimary(page) {
  const b = page.locator('a:visible:has-text("Se connecter"), button:visible:has-text("Se connecter"), a:visible:has-text("Valider")').first();
  if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); return; }
  const f = page.locator('a.font-white:visible, .font-white:visible').first();
  if (await f.count().catch(() => 0)) { await f.click().catch(() => {}); return; }
  await page.keyboard.press("Enter").catch(() => {});
}

// Clique l'élément VISIBLE le plus précis dont le texte correspond, en
// déclenchant le clic DANS la page (boutons WinDev récalcitrants).
async function clickByText(page, text, exact = false) {
  return await page.evaluate(({ text, exact }) => {
    const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden"; };
    const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
    const fire = (e) => { const o = { bubbles: true, cancelable: true, view: window }; for (const t of ["mousedown", "mouseup", "click", "mousedown", "mouseup", "click", "dblclick"]) e.dispatchEvent(new MouseEvent(t, o)); if (e.click) { try { e.click(); } catch { /* ignore */ } } };
    for (const sel of ["a", "button", "[onclick]", "[role=button]", "li", "div", "span", "td"]) {
      const els = Array.from(document.querySelectorAll(sel)).filter((e) => { if (!vis(e)) return false; const t = norm(e.innerText || e.textContent); return exact ? t === text : t.includes(text); });
      els.sort((a, b) => norm(a.innerText || a.textContent).length - norm(b.innerText || b.textContent).length);
      if (els[0]) { fire(els[0]); return true; }
    }
    return false;
  }, { text, exact }).catch(() => false);
}
const pageText = (page) => page.evaluate(() => (document.body.innerText || "").replace(/\s+/g, " ").trim()).catch(() => "");

// Ouvre l'assistant : Statistiques → onglet → stat → Sélectionner(tous) →
// Suivant → Année en cours → Résultat (+ étape Options pour la liste gestion).
async function openStat(page, registre, statLabel) {
  log(`▶ Statistiques — ${registre} (${statLabel})…`);
  await clickByText(page, "Statistiques", true);
  await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(2500);
  const okTab = await clickByText(page, registre, true); await page.waitForTimeout(2000);
  const okStat = await clickByText(page, statLabel, false); await page.waitForTimeout(2000);
  log(`   onglet « ${registre} » : ${okTab} | stat : ${okStat}`);
  const okSel = await clickByText(page, "Sélectionner", true); await page.waitForTimeout(1200);
  const okNext = await clickByText(page, "Suivant", true); await page.waitForTimeout(2200);
  const okYear = await clickByText(page, "Année en cours", true); await page.waitForTimeout(1000);
  let okFinal = await clickByText(page, "Résultat", true);
  if (!okFinal) okFinal = await clickByText(page, "Suivant", true);
  await page.waitForTimeout(2500);
  await clickByText(page, "Résultat", true);   // étape « Options » éventuelle (gestion)
  await page.waitForTimeout(3500);
  log(`   Sélectionner : ${okSel} | Suivant : ${okNext} | Année : ${okYear} | Résultat : ${okFinal}`);
}

// Transaction : tableau « Nom · AAAAMM · Papier · Tablette · SAD ». On somme
// (Papier+Tablette+SAD) par négociateur ET par trimestre (déduit du mois).
async function readTransaction(page) {
  await openStat(page, "Transaction", "Stats par tiers négociateurs");
  await snap(page, "transaction-result");
  const txt = await pageText(page);
  const re = /([A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’-]+(?:\s+[A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’-]+)+)\s+(\d{4})(\d{2})\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/g;
  const map = new Map();   // nom → [T1,T2,T3,T4]
  let m;
  while ((m = re.exec(txt))) {
    const year = Number(m[2]); if (year !== YEAR) continue;
    const q = quarter(Number(m[3]));
    const cnt = Number(m[4]) + Number(m[5]) + Number(m[6]);
    const name = lastTwo(m[1]);
    const a = map.get(name) || [0, 0, 0, 0];
    a[q] += cnt; map.set(name, a);
  }
  const total = [...map.values()].reduce((s, a) => s + a.reduce((x, y) => x + y, 0), 0);
  log(`  ✓ Transaction : ${map.size} négociateur(s), ${total} mandat(s).`);
  return map;
}

// Gestion : LISTE de mandats « … N°  Nom  Début : JJ/MM/AAAA … ». La grille est
// virtualisée → on accumule les mandats (clé = N°) au fil du défilement pour ne
// rien perdre, puis on compte par négociateur et par trimestre (mois de début).
async function readGestion(page) {
  await openStat(page, "Gestion", "Liste des mandats par tiers négociateurs");
  const seen = new Map();   // N° mandat → { name, q }
  const re = /(\d{2,6})\s+\d+\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’-]+(?:\s+[A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’-]+)+)\s+Début\s*:\s*\d{2}\/(\d{2})\/(\d{4})/g;
  let lastTop = -1, stable = 0;
  for (let i = 0; i < 40; i++) {
    const txt = await pageText(page);
    let m;
    while ((m = re.exec(txt))) {
      const num = m[1], name = lastTwo(m[2]), month = Number(m[3]), year = Number(m[4]);
      if (year !== YEAR) continue;
      seen.set(num, { name, q: quarter(month) });
    }
    // défilement incrémental de la plus grande zone scrollable + fenêtre
    const top = await page.evaluate(() => {
      const e = [...document.querySelectorAll("*")].filter((x) => x.scrollHeight > x.clientHeight + 40).sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
      if (e) e.scrollTop = e.scrollTop + Math.max(120, e.clientHeight * 0.8);
      window.scrollBy(0, 400);
      return e ? e.scrollTop : window.scrollY;
    }).catch(() => 0);
    await page.waitForTimeout(300);
    if (top <= lastTop) { if (++stable >= 3) break; } else stable = 0;
    lastTop = top;
  }
  await snap(page, "gestion-result");
  const map = new Map();   // nom → [T1,T2,T3,T4]
  for (const { name, q } of seen.values()) { const a = map.get(name) || [0, 0, 0, 0]; a[q] += 1; map.set(name, a); }
  const total = [...map.values()].reduce((s, a) => s + a.reduce((x, y) => x + y, 0), 0);
  log(`  ✓ Gestion : ${map.size} négociateur(s), ${total} mandat(s).`);
  return map;
}

async function main() {
  const browser = await chromium.launch({ headless: !HEADFUL, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, locale: "fr-FR" });
  const page = await ctx.newPage();
  try {
    await login(page);
    const tx = await readTransaction(page);
    const ge = await readGestion(page);

    const names = new Set([...tx.keys(), ...ge.keys()]);
    const negociateurs = [...names].map((name) => ({
      name,
      t: tx.get(name) || [0, 0, 0, 0],
      g: ge.get(name) || [0, 0, 0, 0],
    })).filter((r) => r.t.some((x) => x) || r.g.some((x) => x));

    log("▶ Résultat (T1 T2 T3 T4) :");
    for (const r of negociateurs) {
      const tt = r.t.reduce((a, b) => a + b, 0), gt = r.g.reduce((a, b) => a + b, 0);
      log(`   ${r.name} — T:[${r.t.join(" ")}]=${tt}  G:[${r.g.join(" ")}]=${gt}`);
    }
    if (!negociateurs.length) fail("Aucun négociateur lu.");

    log(`▶ Envoi à Collab (${COLLAB_URL})…`);
    const res = await fetch(`${COLLAB_URL}/api/protexa/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-protexa-secret": SECRET },
      body: JSON.stringify({ year: YEAR, negociateurs }),
    });
    const body = await res.text();
    if (!res.ok) fail(`Collab a refusé (HTTP ${res.status}) : ${body}`);
    log(`  ✓ Synchronisé : ${body}`);
  } catch (e) {
    await snap(page, "error");
    fail(`Erreur : ${e?.message || e}`);
  } finally {
    await browser.close();
  }
}

main();
