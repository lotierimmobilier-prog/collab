#!/usr/bin/env node
/**
 * Robot de synchronisation Protexa → Collab.
 *
 * Se connecte à Protexa (production.protexa.fr), lit les statistiques de mandats
 * par tiers négociateur (registre Transaction et Gestion) sur l'année civile en
 * cours, puis envoie les compteurs par négociateur à Collab via
 * POST /api/protexa/sync.
 *
 * À lancer SUR LE VPS (réseau ouvert vers Protexa), idéalement via cron quotidien.
 * Identifiants et secret passés en VARIABLES D'ENVIRONNEMENT — jamais en clair.
 *
 *   PROTEXA_LOGIN  PROTEXA_PASS  COLLAB_URL  PROTEXA_SYNC_SECRET
 *   PROTEXA_BASE (optionnel)  PROTEXA_YEAR (optionnel)  DIAG=1 (captures)
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

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
async function snap(page, tag) {
  if (!DIAG) return;
  step++;
  const n = String(step).padStart(2, "0");
  try { await page.screenshot({ path: `diag/${n}-${tag}.png`, fullPage: true }); } catch { /* ignore */ }
  log(`  · diag/${n}-${tag}.png`);
}
async function dumpText(page, tag) {
  if (!DIAG) return;
  const t = await page.evaluate(() => (document.body.innerText || "").replace(/\s+/g, " ").trim().slice(0, 4000)).catch(() => "");
  log(`  [texte ${tag}] ${t}`);
}

// Connexion (formulaire WinDev : identifiant « SPxxxxx » puis mot de passe).
async function login(page) {
  log("▶ Connexion à Protexa…");
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  let loginField = page.locator('input[placeholder*="SP"]:visible, input[placeholder*="12345"]:visible').first();
  if (!(await loginField.count().catch(() => 0))) {
    loginField = page.locator("input[type=email]:visible, input[type=text]:visible").first();
  }
  await loginField.waitFor({ timeout: 20000 });
  await loginField.fill(LOGIN);
  let pass = page.locator("input[type=password]:visible").first();
  if (!(await pass.count().catch(() => 0))) {
    await clickPrimary(page);
    await page.waitForTimeout(3000);
    pass = page.locator("input[type=password]:visible").first();
  }
  await pass.waitFor({ timeout: 20000 });
  await pass.fill(PASS);
  await clickPrimary(page);
  await page.waitForTimeout(4000);
  const ok = await page.locator("text=/Statistiques|Registre/i").count().catch(() => 0);
  log(ok ? "  ✓ Connecté." : "  ⚠ Menu non détecté.");
}

async function clickPrimary(page) {
  const byText = page.locator('a:visible:has-text("Se connecter"), button:visible:has-text("Se connecter"), a:visible:has-text("Valider")').first();
  if (await byText.count().catch(() => 0)) { await byText.click().catch(() => {}); return; }
  const b = page.locator('a.font-white:visible, .font-white:visible').first();
  if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); return; }
  await page.keyboard.press("Enter").catch(() => {});
}

// Clique l'élément VISIBLE le plus précis dont le texte correspond, en
// déclenchant le clic DANS la page (les boutons WinDev résistent au clic
// Playwright). exact=true → texte identique ; sinon « contient ».
async function clickByText(page, text, exact = false) {
  const ok = await page.evaluate(({ text, exact }) => {
    const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden"; };
    const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
    const fire = (e) => {
      const opt = { bubbles: true, cancelable: true, view: window };
      for (const t of ["mousedown", "mouseup", "click", "mousedown", "mouseup", "click", "dblclick"]) e.dispatchEvent(new MouseEvent(t, opt));
      if (typeof e.click === "function") { try { e.click(); } catch { /* ignore */ } }
    };
    for (const sel of ["a", "button", "[onclick]", "[role=button]", "li", "div", "span", "td"]) {
      const els = Array.from(document.querySelectorAll(sel)).filter((e) => {
        if (!vis(e)) return false;
        const t = norm(e.innerText || e.textContent);
        return exact ? t === text : t.includes(text);
      });
      els.sort((a, b) => norm(a.innerText || a.textContent).length - norm(b.innerText || b.textContent).length);
      if (els[0]) { fire(els[0]); return true; }
    }
    return false;
  }, { text, exact }).catch(() => false);
  return ok;
}

// Lit une statistique « par tiers négociateur » via l'assistant Protexa :
//   Statistiques → onglet (Transaction|Gestion) → <statLabel>
//   → étape 1 « Sélectionner » (tous les négociateurs) → Suivant
//   → étape 2 « Année en cours » → Résultat → lecture du tableau.
async function readStat(page, registre, statLabel) {
  log(`▶ Statistiques — ${registre} (${statLabel})…`);
  await clickByText(page, "Statistiques", true);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500);
  const okTab = await clickByText(page, registre, true);
  await page.waitForTimeout(2000);
  const okStat = await clickByText(page, statLabel, false);
  await page.waitForTimeout(2000);
  log(`   onglet « ${registre} » : ${okTab} | stat « ${statLabel} » : ${okStat}`);

  // Étape 1 — sélection des négociateurs : « Sélectionner » = tout sélectionner.
  const okSel = await clickByText(page, "Sélectionner", true);
  await page.waitForTimeout(1200);
  const okNext = await clickByText(page, "Suivant", true);
  await page.waitForTimeout(2200);
  log(`   Sélectionner : ${okSel} | Suivant : ${okNext}`);
  await snap(page, `${registre}-1-periode`);
  await dumpText(page, `${registre}-periode`);

  // Étape 2 — période = « Année en cours » (= année civile en cours).
  const okYear = await clickByText(page, "Année en cours", true);
  await page.waitForTimeout(1000);
  // Transaction : bouton « Résultat ». Gestion (Liste) : étape « 3. Options »
  // supplémentaire → on enchaîne Suivant puis Résultat (best-effort).
  let okFinal = await clickByText(page, "Résultat", true);
  if (!okFinal) okFinal = await clickByText(page, "Suivant", true);
  await page.waitForTimeout(2500);
  await clickByText(page, "Résultat", true);  // au cas où une étape « Options » reste
  await page.waitForTimeout(3500);
  log(`   Année en cours : ${okYear} | Final : ${okFinal}`);
  await snap(page, `${registre}-2-result`);
  await dumpText(page, `${registre}-result`);

  const rows = await parseResultTable(page);
  log(`  ✓ ${registre} : ${rows.size} négociateur(s) lus.`);
  return rows;
}

// Parse le résultat « par tiers négociateur » en Map(nom → nb total de mandats).
// Le tableau Protexa est rendu en texte « Nom négo · Période(AAAAMM) · Papier ·
// Tablette · SAD », répété par négociateur ET par mois. On l'extrait par regex
// sur le texte de la page (plus fiable que le DOM WinDev) et on additionne
// Papier+Tablette+SAD de toutes les lignes, regroupé par négociateur.
async function parseResultTable(page) {
  const txt = await page.evaluate(() => (document.body.innerText || "").replace(/\s+/g, " ").trim()).catch(() => "");
  // Nom = au moins deux mots commençant par une majuscule (ex. « Barbara BOUBA »,
  // « NON AFFECTE »), suivi d'une période AAAAMM puis de 3 entiers.
  const re = /([A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’-]+(?:\s+[A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’-]+)+)\s+20\d{4}\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/g;
  const map = new Map();
  let m;
  while ((m = re.exec(txt))) {
    const name = m[1].replace(/\s+/g, " ").trim();
    const cnt = Number(m[2]) + Number(m[3]) + Number(m[4]);
    map.set(name, (map.get(name) || 0) + cnt);
  }
  return map;
}

async function main() {
  const browser = await chromium.launch({ headless: !HEADFUL, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, locale: "fr-FR" });
  const page = await ctx.newPage();
  try {
    await login(page);
    const tx = await readStat(page, "Transaction", "Stats par tiers négociateurs");
    const ge = await readStat(page, "Gestion", "Liste des mandats par tiers négociateurs");

    const names = new Set([...tx.keys(), ...ge.keys()]);
    const negociateurs = [...names].map((name) => ({
      name, transaction: tx.get(name) || 0, gestion: ge.get(name) || 0,
    })).filter((r) => r.transaction || r.gestion);

    log("▶ Résultat :");
    for (const r of negociateurs) log(`   ${r.name} — T:${r.transaction} G:${r.gestion}`);
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
