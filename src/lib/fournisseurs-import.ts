import { getAnthropic, MODELS } from "@/lib/auguste";

export interface ParsedFournisseur {
  icsNum?: string;
  metier?: string;
  nom: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  modeReglement?: string;
  iban?: string;
  tel?: string;
  mobile?: string;
  email?: string;
  ca?: string;
}

// Extraction de la liste des fournisseurs depuis le PDF ICS via Claude
// (lecture du document — robuste face à la mise en page irrégulière).
export async function extractFournisseursPdf(base64: string): Promise<ParsedFournisseur[]> {
  const client = getAnthropic();
  const resp = await client.messages.create({
    model: MODELS.smart,
    max_tokens: 8000,
    system: "Tu extrais une liste de fournisseurs depuis un document PDF. Tu réponds UNIQUEMENT par un tableau JSON valide, sans texte autour.",
    messages: [{
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
        { type: "text", text: `Ce PDF est une « Liste des fournisseurs » exportée d'un logiciel immobilier.
Chaque ligne du tableau correspond à un fournisseur, avec les colonnes :
N° | Métier | Nom et adresse | Mode de règlement | Contact | C.A

Extrais TOUS les fournisseurs. Réponds par un tableau JSON, un objet par fournisseur :
[{"icsNum":"40129695","metier":"Plombier","nom":"13 TEL","adresse":"10 rue du 14 Juillet","codePostal":"34440","ville":"NISSAN LEZ ENSERUNE","modeReglement":"Virement","iban":"FR76...","tel":"0467...","mobile":"0632...","email":"x@y.fr","ca":""}]

Règles :
- "icsNum" = le numéro de la colonne N° (ex. 40129695).
- "nom" = la raison sociale (en gras), OBLIGATOIRE.
- Sépare l'adresse en "adresse" (rue), "codePostal" (5 chiffres) et "ville" quand c'est possible ; sinon mets tout dans "adresse".
- "iban" sans espaces. "tel"/"mobile"/"email" tels que présents (peut être vide).
- Normalise les numéros de téléphone français : "33632078067" → "0632078067", "+33675040342" → "0675040342".
- Si une valeur est absente, mets une chaîne vide "".
- N'invente JAMAIS de données. Ne renvoie que ce qui est dans le document.` },
      ],
    }],
  });

  const text = resp.content.filter(b => b.type === "text").map(b => (b as { text: string }).text).join("");
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]) as ParsedFournisseur[];
    return arr
      .filter(f => f && typeof f.nom === "string" && f.nom.trim())
      .map(f => ({
        icsNum: clean(f.icsNum),
        metier: clean(f.metier),
        nom: clean(f.nom)!,
        adresse: clean(f.adresse),
        codePostal: clean(f.codePostal),
        ville: clean(f.ville),
        modeReglement: clean(f.modeReglement),
        iban: clean(f.iban)?.replace(/\s+/g, ""),
        tel: normPhone(f.tel),
        mobile: normPhone(f.mobile),
        email: clean(f.email)?.toLowerCase(),
        ca: clean(f.ca),
      }));
  } catch { return []; }
}

function clean(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function normPhone(v: unknown): string | undefined {
  let s = clean(v);
  if (!s) return undefined;
  s = s.replace(/[^\d+]/g, "");
  if (s.startsWith("+33")) s = "0" + s.slice(3);
  else if (s.startsWith("0033")) s = "0" + s.slice(4);
  else if (s.startsWith("33") && s.length === 11) s = "0" + s.slice(2);
  return s || undefined;
}
