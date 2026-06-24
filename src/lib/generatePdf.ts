import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { DocItem, UploadedFile } from "./locataires";

interface PdfInput {
  nom: string; prenom: string; email: string; telephone?: string;
  typeContrat: string; employeur?: string;
  revenus: number; loyerCC: number;
  situation: string; taux: number; gliOk: boolean; gliMsg: string;
  uploads: UploadedFile[];
  docs: DocItem[];
}

export async function generateDossierPDF(data: PdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const purple = rgb(0.486, 0.227, 0.929);
  const gray   = rgb(0.42, 0.44, 0.5);
  const black  = rgb(0.07, 0.08, 0.1);
  const green  = rgb(0.05, 0.71, 0.46);
  const red    = rgb(0.86, 0.17, 0.17);

  // PAGE DE GARDE
  const cover = pdf.addPage([595, 842]);
  const { width, height } = cover.getSize();

  cover.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: purple });
  cover.drawText("Collab.", { x: 40, y: height - 50, size: 26, font: fontBold, color: rgb(1, 1, 1) });
  cover.drawText("Dossier de candidature locative", { x: 40, y: height - 68, size: 11, font, color: rgb(0.85, 0.8, 1) });

  let y = height - 120;

  const section = (title: string) => {
    cover.drawRectangle({ x: 40, y: y - 2, width: width - 80, height: 22, color: rgb(0.96, 0.95, 1) });
    cover.drawText(title.toUpperCase(), { x: 44, y: y + 4, size: 9, font: fontBold, color: purple });
    y -= 28;
  };

  const row = (label: string, value: string) => {
    cover.drawText(label, { x: 44, y, size: 10, font, color: gray });
    cover.drawText(value || "-", { x: 200, y, size: 10, font: fontBold, color: black });
    y -= 18;
  };

  section("Candidat");
  row("Nom complet", `${data.prenom} ${data.nom}`);
  row("Email", data.email);
  row("Telephone", data.telephone || "-");
  y -= 6;

  section("Situation professionnelle");
  row("Type de contrat", data.typeContrat);
  row("Employeur", data.employeur || "-");
  row("Revenus nets / mois", data.revenus > 0 ? `${data.revenus.toLocaleString("fr-FR")} EUR` : "-");
  row("Logement actuel", data.situation);
  y -= 6;

  section("Analyse GLI");
  row("Loyer CC", data.loyerCC > 0 ? `${data.loyerCC.toLocaleString("fr-FR")} EUR` : "-");
  row("Taux d'endettement", data.taux > 0 ? `${data.taux}%` : "-");
  row("Revenu minimum requis", data.loyerCC > 0 ? `${(data.loyerCC * 3).toLocaleString("fr-FR")} EUR` : "-");

  y -= 10;
  cover.drawRectangle({
    x: 44, y: y - 6, width: width - 100, height: 26,
    color: data.gliOk ? rgb(0.94, 1, 0.96) : rgb(1, 0.95, 0.95),
  });
  // ASCII only — WinAnsi ne supporte pas les caracteres Unicode
  const gliPrefix = data.gliOk ? "[OK] " : "[NON] ";
  cover.drawText(gliPrefix + data.gliMsg, {
    x: 54, y: y + 4, size: 10, font: fontBold,
    color: data.gliOk ? green : red,
  });
  y -= 30;

  section("Documents fournis");
  for (const doc of data.docs) {
    const upload = data.uploads.find(u => u.docId === doc.id);
    const count = upload?.files.length ?? 0;
    const symbol = count > 0 ? "[OK]" : doc.required ? "[--]" : "[ ]";
    const color  = count > 0 ? green : doc.required ? red : gray;
    cover.drawText(symbol, { x: 44, y, size: 9, font: fontBold, color });
    cover.drawText(doc.label + (doc.required ? " *" : ""), { x: 78, y, size: 9, font, color: count > 0 ? black : gray });
    if (count > 0) cover.drawText(`${count} fichier(s)`, { x: 440, y, size: 9, font, color: gray });
    y -= 16;
    if (y < 60) break;
  }

  cover.drawText(`Genere le ${new Date().toLocaleDateString("fr-FR")}`, { x: 40, y: 30, size: 9, font, color: gray });

  // PAGES DOCUMENTS
  for (const upload of data.uploads) {
    const docMeta = data.docs.find(d => d.id === upload.docId);
    const groupLabel = docMeta?.label ?? upload.docId;

    for (const file of upload.files) {
      if (file.type === "application/pdf") {
        try {
          const base64 = file.dataUrl.split(",")[1];
          const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
          const srcPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
          const pages = await pdf.copyPages(srcPdf, srcPdf.getPageIndices());
          for (const p of pages) {
            const added = pdf.addPage(p);
            added.drawRectangle({ x: 0, y: added.getHeight() - 22, width: added.getWidth(), height: 22, color: purple });
            const label = `${groupLabel} - ${file.name}`.replace(/[^\x20-\x7E]/g, "?");
            added.drawText(label, { x: 8, y: added.getHeight() - 15, size: 8, font, color: rgb(1, 1, 1) });
          }
        } catch { /* PDF illisible */ }
      } else if (file.type.startsWith("image/")) {
        try {
          const base64 = file.dataUrl.split(",")[1];
          const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
          const img = file.type === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
          const page = pdf.addPage([595, 842]);
          const pW = page.getWidth() - 80;
          const pH = page.getHeight() - 100;
          const ratio = Math.min(pW / img.width, pH / img.height);
          page.drawRectangle({ x: 0, y: page.getHeight() - 40, width: page.getWidth(), height: 40, color: purple });
          const label = `${groupLabel} - ${file.name}`.replace(/[^\x20-\x7E]/g, "?");
          page.drawText(label, { x: 40, y: page.getHeight() - 25, size: 10, font, color: rgb(1, 1, 1) });
          page.drawImage(img, { x: 40, y: 40, width: img.width * ratio, height: img.height * ratio });
        } catch { /* image illisible */ }
      }
    }
  }

  return pdf.save();
}
