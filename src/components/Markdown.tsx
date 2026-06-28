"use client";
import React from "react";

// Rendu Markdown léger (sans dépendance) pour les réponses d'Auguste :
// titres, gras, listes, tableaux, citations. Suffisant pour un assistant.
const GOLD = "#B8966A"; const BORDER = "#E6E1D9"; const DARK = "#1C1A17";

// Formatage en ligne : **gras**, *italique*, `code`.
function inline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*)/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined) nodes.push(<strong key={`${keyBase}-b${i}`}>{m[2]}</strong>);
    else if (m[3] !== undefined) nodes.push(<code key={`${keyBase}-c${i}`} style={{ background: "#F0EDE7", borderRadius: 4, padding: "1px 5px", fontSize: "0.92em" }}>{m[3]}</code>);
    else if (m[4] !== undefined) nodes.push(<em key={`${keyBase}-i${i}`}>{m[4]}</em>);
    last = m.index + m[0].length; i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const splitRow = (line: string) => line.replace(/^\||\|$/g, "").split("|").map(c => c.trim());

export default function Markdown({ text }: { text: string }) {
  const lines = (text ?? "").replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0; let k = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Tableau : ligne | … | suivie d'une ligne de séparation |---|
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const header = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(splitRow(lines[i])); i++; }
      blocks.push(
        <div key={k++} style={{ overflowX: "auto", margin: "8px 0" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.95em" }}>
            <thead><tr>{header.map((h, j) => <th key={j} style={{ background: "#F7F0E6", color: DARK, textAlign: "left", padding: "6px 10px", border: `1px solid ${BORDER}`, fontWeight: 700 }}>{inline(h, `th${k}-${j}`)}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} style={{ padding: "6px 10px", border: `1px solid ${BORDER}`, verticalAlign: "top" }}>{inline(c, `td${k}-${ri}-${ci}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }

    // Titres ## / ###
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      blocks.push(<div key={k++} style={{ fontWeight: 700, color: DARK, fontSize: lvl <= 2 ? "1.08em" : "1em", margin: "10px 0 4px" }}>{inline(h[2], `h${k}`)}</div>);
      i++; continue;
    }

    // Listes (- * • ou numérotées)
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const items: { ord: boolean; txt: string }[] = [];
      let ordered = /^\s*\d+[.)]/.test(line);
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
        const t = lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, "");
        items.push({ ord: /^\s*\d+[.)]/.test(lines[i]), txt: t }); i++;
      }
      ordered = items.every(it => it.ord);
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(React.createElement(ListTag, { key: k++, style: { margin: "6px 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 3 } },
        items.map((it, j) => <li key={j}>{inline(it.txt, `li${k}-${j}`)}</li>)));
      continue;
    }

    // Citation >
    if (/^\s*>\s?/.test(line)) {
      blocks.push(<div key={k++} style={{ borderLeft: `3px solid ${GOLD}`, paddingLeft: 10, color: "#6b6357", margin: "6px 0", fontStyle: "italic" }}>{inline(line.replace(/^\s*>\s?/, ""), `q${k}`)}</div>);
      i++; continue;
    }

    // Séparateur ---
    if (/^\s*-{3,}\s*$/.test(line)) { blocks.push(<hr key={k++} style={{ border: "none", borderTop: `1px solid ${BORDER}`, margin: "10px 0" }} />); i++; continue; }

    // Ligne vide
    if (!line.trim()) { i++; continue; }

    // Paragraphe (regroupe les lignes consécutives)
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s*([-*•]|\d+[.)]|#{1,4}\s|>|\|)/.test(lines[i]) && !/^\s*-{3,}\s*$/.test(lines[i])) { para.push(lines[i]); i++; }
    blocks.push(<p key={k++} style={{ margin: "5px 0", lineHeight: 1.55 }}>{para.map((p, j) => <React.Fragment key={j}>{j > 0 && <br />}{inline(p, `p${k}-${j}`)}</React.Fragment>)}</p>);
  }

  return <div style={{ fontSize: "inherit" }}>{blocks}</div>;
}
