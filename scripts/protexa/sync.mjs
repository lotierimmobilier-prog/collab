#!/usr/bin/env node
/**
 * Robot de synchronisation Protexa → Collab.
 *
 * Se connecte à Protexa (production.protexa.fr), lit « Statistiques → Stats par
 * tiers négociateurs » pour les registres Transaction et Gestion sur l'année
 * civile en cours (réservations ET avenants EXCLUS), puis envoie les compteurs
 * par négociateur à Collab via POST /api/protexa/sync.
 *
 * À lancer SUR LE VPS (réseau ouvert vers Protexa), idéalement via cron quotidien.
 * Identifiants et secret passés en VARIABLES D'ENVIRONNEMENT — jamais en clair.
 *
 *   PROTEXA_LOGIN        identifiant Protexa
 *   PROTEXA_PASS         mot de passe Protexa
 *   COLLAB_URL           ex. https://collab.lotier-immobilier.com
 *   PROTEXA_SYNC_SECRET  même valeur que la variable du serveur Collab
 *   PROTEXA_BASE         (optionnel) défaut https://production.protexa.fr/ProtexaFullWeb
 *   PROTEXA_YEAR         (optionnel) année civile, défaut = année courante
 *   DIAG                 (optionnel) 1 = captures d'écran + HTML dans ./diag
 *   HEADFUL              (optionnel) 1 = navigateur visible (debug local)
 *
 * Dépendance : playwright (voir README.md).
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
  try { writeFileSync(`diag/${n}-${tag}.html`, await page.content()); } catch { /* ignore */ }
  log(`  · diag/${n}-${tag}.{png,html}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Connexion (formulaire WinDev : identifiant « SPxxxxx » puis mot de passe).
// Le champ identifiant a un placeholder « SP12345 » ; les boutons WinDev n'ont
// pas de texte → le bouton principal porte la classe « font-white ».
// ─────────────────────────────────────────────────────────────────────────────
async function login(page) {
  log("▶ Connexion à Protexa…");
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await snap(page, "login-1-landing");
  await dumpInputs(page, "landing");

  // Champ identifiant : priorité au champ « placeholder=SP12345 ».
  let loginField = page.locator('input[placeholder*="SP"]:visible, input[placeholder*="12345"]:visible').first();
  if (!(await loginField.count().catch(() => 0))) {
    loginField = page.locator("input[type=email]:visible, input[type=text]:visible").first();
  }
  await loginField.waitFor({ timeout: 20000 });
  await loginField.fill(LOGIN);
  log("  · identifiant saisi");

  // Mot de passe : s'il n'est pas déjà visible, on valide pour faire apparaître
  // l'écran 2, puis on saisit le champ mot de passe VISIBLE.
  let pass = page.locator("input[type=password]:visible").first();
  if (!(await pass.count().catch(() => 0))) {
    await clickPrimary(page);
    await page.waitForTimeout(3000);
    await snap(page, "login-2-after-id");
    await dumpInputs(page, "after-id");
    pass = page.locator("input[type=password]:visible").first();
  }
  await pass.waitFor({ timeout: 20000 });
  await pass.fill(PASS);
  log("  · mot de passe saisi");
  await clickPrimary(page);
  await page.waitForTimeout(4000);
  await snap(page, "login-3-after-pass");

  const ok = await page.locator("text=/Statistiques|Registre/i").count().catch(() => 0);
  if (!ok) log("  ⚠ Menu non détecté après connexion — voir diag/login-3.");
  else log("  ✓ Connecté.");
}

// Clique le bouton de validation. Protexa : lien « Se connecter » à l'écran
// identifiant, puis « Valider/Connexion » à l'écran mot de passe. Repli sur le
// style « font-white », puis sur la touche Entrée.
async function clickPrimary(page) {
  const byText = page.locator(
    'a:visible:has-text("Se connecter"), button:visible:has-text("Se connecter"),'
    + ' a:visible:has-text("Connexion"), a:visible:has-text("Valider"),'
    + ' a:visible:has-text("Connecter"), button:visible:has-text("Valider")'
  ).first();
  if (await byText.count().catch(() => 0)) { await byText.click().catch(() => {}); return true; }
  const b = page.locator('a.font-white:visible, [data-webdev-class-usr="font-white"]:visible, .font-white:visible').first();
  if (await b.count().catch(() => 0)) { await b.click().catch(() => {}); return true; }
  await page.keyboard.press("Enter").catch(() => {});
  return false;
}

// Journalise les champs et boutons VISIBLES (diagnostic, mode DIAG uniquement).
async function dumpInputs(page, tag) {
  if (!DIAG) return;
  const info = await page.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden"; };
    const inputs = Array.from(document.querySelectorAll("input")).filter(vis)
      .map(e => `input type=${e.type} id=${e.id} ph="${e.placeholder || ""}" ti=${e.tabIndex}`);
    const btns = Array.from(document.querySelectorAll("a,button")).filter(vis)
      .map(e => `${e.tagName} id=${e.id} class="${e.className}" txt="${(e.innerText || "").trim().slice(0, 25)}"`);
    return { inputs, btns };
  }).catch(() => ({ inputs: [], btns: [] }));
  log(`  [dump ${tag}] ${info.inputs.length} champ(s) visible(s) :`);
  info.inputs.forEach(i => log(`     ${i}`));
  log(`  [dump ${tag}] ${info.btns.length} bouton(s) visible(s) :`);
  info.btns.slice(0, 30).forEach(b => log(`     ${b}`));
}

// Journalise les libellés cliquables visibles (diagnostic de navigation).
async function dumpLinks(page, tag) {
  if (!DIAG) return;
  const links = await page.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden"; };
    return Array.from(document.querySelectorAll("a,button")).filter(vis)
      .map(e => (e.innerText || "").trim()).filter(t => t && t.length < 60 && /[A-Za-zÀ-ÿ]/.test(t));
  }).catch(() => []);
  log(`  [liens ${tag}] ${[...new Set(links)].slice(0, 50).join(" | ")}`);
}

// Clique un élément par son libellé, en privilégiant les éléments VISIBLES :
// bouton (rôle), lien (rôle), puis texte. Renvoie true si un clic a abouti.
async function clickByText(page, text, exact = false) {
  const cands = [
    page.getByRole("button", { name: text, exact }),
    page.getByRole("link", { name: text, exact }),
    page.getByText(text, { exact }),
  ];
  for (const loc of cands) {
    const el = loc.first();
    if (await el.count().catch(() => 0)) {
      try { await el.click({ timeout: 7000 }); return true; } catch { /* candidat suivant */ }
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lecture du récap par négociateur pour un registre (Transaction | Gestion).
// Renvoie une Map nom → nombre de mandats signés sur l'année.
//
// ⚠ Sélecteurs à confirmer sur le VPS (page non accessible en dev) : lancer une
//   première fois avec DIAG=1 et m'envoyer les captures pour ajuster.
// ─────────────────────────────────────────────────────────────────────────────
async function readRegistre(page, registre) {
  log(`▶ Statistiques — ${registre}…`);
  // 1) Menu gauche « Statistiques » (bouton WinDev visible, libellé exact).
  const okStat = await clickByText(page, "Statistiques", true);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500);
  log(`   clic « Statistiques » : ${okStat}`);
  await snap(page, `stat-${registre}-1-menu`);
  await dumpLinks(page, `${registre}-page-stat`);

  // 2) Onglet Transaction / Gestion.
  const okTab = await clickByText(page, registre, true);
  await page.waitForTimeout(2000);
  log(`   clic onglet « ${registre} » : ${okTab}`);
  await dumpLinks(page, `${registre}-apres-onglet`);

  // 3) Lien « Stats par tiers négociateurs ».
  const okLink = await clickByText(page, "Stats par tiers négociateurs", false);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500);
  log(`   clic « Stats par tiers négociateurs » : ${okLink}`);
  await snap(page, `stat-${registre}-2-params`);
  await dumpInputs(page, `${registre}-params`);

  // 4) Paramètres : décocher « Inclure les réservations » et « Inclure les avenants ».
  for (const label of ["réservations", "reservations", "avenants"]) {
    const cb = page.locator(`label:has-text('${label}') input[type=checkbox], input[type=checkbox]`).first();
    // On ne décoche que si c'est coché (best-effort, ciblage par libellé proche).
    const box = page.locator(`text=/Inclure les ${label}/i`).locator("xpath=preceding::input[@type='checkbox'][1]").first();
    const target = (await box.count().catch(() => 0)) ? box : cb;
    if (await target.count().catch(() => 0) && await target.isChecked().catch(() => false)) {
      await target.uncheck().catch(() => {});
    }
  }

  // 5) Période = année civile en cours (du 01/01 au 31/12 de YEAR).
  //    Le sélecteur de dates dépend de la page — on tente de remplir d'éventuels
  //    champs date « du / au ». À ajuster selon diag.
  await setPeriode(page, registre);

  // 6) Lancer le résultat.
  await page.locator("text=/^R[ée]sultat$/i, a:has-text('Résultat'), button:has-text('Résultat')").first()
    .click({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3500);
  await snap(page, `stat-${registre}-3-result`);

  // 7) Lire le tableau résultat : nom de négociateur + nombre.
  const rows = await parseResultTable(page);
  log(`  ✓ ${registre} : ${rows.size} négociateur(s) lus.`);
  return rows;
}

// Tente de fixer la période sur l'année civile YEAR (du 01/01 au 31/12).
async function setPeriode(page, registre) {
  const from = `01/01/${YEAR}`;
  const to = `31/12/${YEAR}`;
  // Heuristique : champs date visibles (jj/mm/aaaa). Best-effort.
  const dates = page.locator("input[type=text]").filter({ hasText: "" });
  const n = await dates.count().catch(() => 0);
  // On remplit au plus les deux premiers champs ressemblant à des dates.
  let filled = 0;
  for (let i = 0; i < n && filled < 2; i++) {
    const el = dates.nth(i);
    const ph = (await el.getAttribute("placeholder").catch(() => "")) || "";
    const val = (await el.inputValue().catch(() => "")) || "";
    if (/\/|date|jj|mm/i.test(ph) || /\d{2}\/\d{2}\/\d{4}/.test(val)) {
      await el.fill(filled === 0 ? from : to).catch(() => {});
      filled++;
    }
  }
  await snap(page, `stat-${registre}-2b-periode`);
}

// Parse un tableau de résultats en Map(nom → nombre). Générique : prend chaque
// ligne dont une cellule est un nom (lettres/espaces) et une autre un entier.
async function parseResultTable(page) {
  const data = await page.evaluate(() => {
    const out = [];
    const isInt = (s) => /^\d{1,5}$/.test(s.trim());
    const isName = (s) => /[A-Za-zÀ-ÿ]{2,}/.test(s) && !/\d{2}\/\d{2}/.test(s);
    for (const tr of Array.from(document.querySelectorAll("tr"))) {
      const cells = Array.from(tr.querySelectorAll("td, th")).map((c) => (c.innerText || "").trim());
      if (cells.length < 2) continue;
      const name = cells.find((c) => isName(c) && c.length <= 60);
      // le dernier entier de la ligne = total (souvent en fin de ligne)
      const nums = cells.filter(isInt).map(Number);
      if (name && nums.length) out.push([name, nums[nums.length - 1]]);
    }
    return out;
  }).catch(() => []);
  const map = new Map();
  for (const [name, n] of data) {
    const key = name.replace(/\s+/g, " ").trim();
    map.set(key, (map.get(key) || 0) + n);
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const browser = await chromium.launch({ headless: !HEADFUL, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, locale: "fr-FR" });
  const page = await ctx.newPage();
  try {
    await login(page);
    const tx = await readRegistre(page, "Transaction");
    const ge = await readRegistre(page, "Gestion");

    // Fusion par négociateur.
    const names = new Set([...tx.keys(), ...ge.keys()]);
    const negociateurs = [...names].map((name) => ({
      name,
      transaction: tx.get(name) || 0,
      gestion: ge.get(name) || 0,
    })).filter((r) => r.transaction || r.gestion);

    log("▶ Résultat :");
    for (const r of negociateurs) log(`   ${r.name} — T:${r.transaction} G:${r.gestion}`);

    if (!negociateurs.length) fail("Aucun négociateur lu — relancer avec DIAG=1 et m'envoyer le dossier diag/.");

    // Envoi à Collab.
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
