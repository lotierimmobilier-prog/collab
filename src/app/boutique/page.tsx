"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const GOLD_BG = "#F7F0E6";
const GREEN = "#2F855A"; const RED = "#DC2626"; const BLUE = "#2563EB"; const AMBER = "#B45309";

const euro = (n: number) => (Math.round(n * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const num = (s: string) => parseFloat((s || "").replace(",", ".")) || 0;

interface Product { id: string; name: string; description: string | null; price: number; category: string | null; image: string | null; active: boolean; order: number }
interface OrderItem { id: string; name: string; unitPrice: number; qty: number }
interface Order { id: string; userId: string; userName: string; status: string; total: number; note: string | null; createdAt: string; items: OrderItem[] }

const CATS: Record<string, { label: string; icon: string }> = {
  textile:    { label: "Textile",    icon: "👕" },
  accessoire: { label: "Accessoire", icon: "🎒" },
  bureau:     { label: "Bureau",     icon: "🖇️" },
  autre:      { label: "Autre",      icon: "✨" },
};
const ORDER_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  nouveau:     { label: "Nouvelle",      color: "#6b7280", bg: "#f3f4f6" },
  preparation: { label: "En préparation", color: AMBER,    bg: "#FEF3C7" },
  pret:        { label: "Prête",          color: BLUE,     bg: "#DBEAFE" },
  remis:       { label: "Remise",         color: GREEN,    bg: "#DCFCE7" },
  annule:      { label: "Annulée",        color: RED,      bg: "#FEE2E2" },
};
const STATUS_ORDER = ["nouveau", "preparation", "pret", "remis", "annule"];

// Vrai si la valeur est une référence d'image (URL externe OU chemin endpoint
// de la photo uploadée), par opposition à un emoji de secours.
function isUrl(s: string | null): boolean { return !!s && (/^https?:\/\//.test(s) || s.startsWith("/")); }

export default function BoutiquePage() {
  const { data: session } = useSession();
  const role = (session?.user as { roleId?: string })?.roleId ?? "";
  const isDir = ["admin", "dirigeant", "direction"].includes(role);

  const [tab, setTab] = useState<"shop" | "mine" | "manage" | "received">("shop");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [okMsg, setOkMsg] = useState("");

  const loadProducts = useCallback(() => {
    fetch(`/api/shop/products${isDir ? "?all=1" : ""}`).then(r => r.ok ? r.json() : null)
      .then(d => setProducts(d?.products ?? [])).catch(() => {});
  }, [isDir]);
  const loadOrders = useCallback(() => {
    const all = isDir && tab === "received";
    fetch(`/api/shop/orders${all ? "?all=1" : ""}`).then(r => r.ok ? r.json() : null)
      .then(d => setOrders(d?.orders ?? [])).catch(() => {});
  }, [isDir, tab]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { if (tab === "mine" || tab === "received") loadOrders(); }, [tab, loadOrders]);

  const visibleProducts = products.filter(p => p.active);
  const cartLines = useMemo(() => Object.entries(cart)
    .map(([id, qty]) => ({ p: products.find(x => x.id === id), qty }))
    .filter((x): x is { p: Product; qty: number } => !!x.p && x.qty > 0), [cart, products]);
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cartLines.reduce((s, l) => s + l.p.price * l.qty, 0);

  const add = (id: string) => { setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 })); setOkMsg(""); };
  const setQty = (id: string, qty: number) => setCart(c => { const n = { ...c }; if (qty <= 0) delete n[id]; else n[id] = Math.min(99, qty); return n; });

  const placeOrder = async () => {
    if (!cartLines.length || placing) return;
    setPlacing(true);
    const res = await fetch("/api/shop/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cartLines.map(l => ({ productId: l.p.id, qty: l.qty })), note }),
    }).catch(() => null);
    setPlacing(false);
    if (res?.ok) {
      setCart({}); setNote(""); setCartOpen(false);
      setOkMsg("Commande envoyée ! La direction la prépare et vous prévient quand elle est prête.");
      if (tab === "mine") loadOrders();
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#FAF8F5" }}>
      <Sidebar active="boutique" />
      <main style={{ flex: 1, padding: "28px 32px", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: DARK, margin: 0 }}>🛍️ Boutique de l'agence</h1>
          <button onClick={() => setCartOpen(true)} style={{ position: "relative", background: GOLD, color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            🧺 Panier
            {cartCount > 0 && <span style={{ position: "absolute", top: -7, right: -7, background: DARK, color: "#fff", borderRadius: 999, minWidth: 20, height: 20, fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{cartCount}</span>}
          </button>
        </div>
        <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4, marginBottom: 16 }}>
          Commandez les objets logotés de l'agence. La direction prépare votre commande et vous la remet.
        </p>

        {/* Onglets */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
          <TabBtn active={tab === "shop"} onClick={() => setTab("shop")} label="🛒 Catalogue" />
          <TabBtn active={tab === "mine"} onClick={() => setTab("mine")} label="📦 Mes commandes" />
          {isDir && <TabBtn active={tab === "manage"} onClick={() => setTab("manage")} label="⚙️ Gérer les articles" />}
          {isDir && <TabBtn active={tab === "received"} onClick={() => setTab("received")} label="📋 Commandes reçues" />}
        </div>

        {okMsg && <div style={{ background: "#DCFCE7", border: `1px solid #86EFAC`, color: GREEN, borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{okMsg}</div>}

        {tab === "shop" && <Catalogue products={visibleProducts} onAdd={add} cart={cart} />}
        {tab === "mine" && <OrdersList orders={orders} isDir={false} onReload={loadOrders} />}
        {tab === "manage" && isDir && <ManageProducts products={products} onChange={loadProducts} />}
        {tab === "received" && isDir && <OrdersList orders={orders} isDir onReload={loadOrders} />}
      </main>

      {cartOpen && (
        <CartDrawer lines={cartLines} total={cartTotal} note={note} setNote={setNote} setQty={setQty}
          onClose={() => setCartOpen(false)} onPlace={placeOrder} placing={placing} />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 13px", fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 9,
      background: active ? GOLD : "#fff", color: active ? "#fff" : "#6b7280", border: `1px solid ${active ? GOLD : BORDER}`,
    }}>{label}</button>
  );
}

function ProductVisual({ p, size = 64 }: { p: Product; size?: number }) {
  if (isUrl(p.image)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.image!} alt={p.name} style={{ width: size, height: size, objectFit: "cover", borderRadius: 12 }} />;
  }
  return <div style={{ width: size, height: size, borderRadius: 12, background: GOLD_BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5 }}>{p.image || "🛍️"}</div>;
}

// ════════════ Catalogue ════════════

function Catalogue({ products, onAdd, cart }: { products: Product[]; onAdd: (id: string) => void; cart: Record<string, number> }) {
  const [cat, setCat] = useState<string>("all");
  const cats = [...new Set(products.map(p => p.category || "autre"))];
  const shown = cat === "all" ? products : products.filter(p => (p.category || "autre") === cat);
  if (!products.length) return <Empty text="La boutique est vide pour le moment." />;
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        <FilterBtn active={cat === "all"} onClick={() => setCat("all")} label={`Tout (${products.length})`} />
        {cats.map(c => <FilterBtn key={c} active={cat === c} onClick={() => setCat(c)} label={`${CATS[c]?.icon || "✨"} ${CATS[c]?.label || c}`} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16 }}>
        {shown.map(p => (
          <div key={p.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "6px 0" }}><ProductVisual p={p} size={80} /></div>
            <div style={{ fontSize: 15, fontWeight: 700, color: DARK }}>{p.name}</div>
            {p.description && <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.4, flex: 1 }}>{p.description}</div>}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: GOLD }}>{euro(p.price)}</span>
              <button onClick={() => onAdd(p.id)} style={{ background: cart[p.id] ? GOLD_BG : GOLD, color: cart[p.id] ? GOLD : "#fff", border: `1px solid ${GOLD}`, borderRadius: 9, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                {cart[p.id] ? `Ajouté (${cart[p.id]})` : "+ Ajouter"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════ Panier ════════════

function CartDrawer({ lines, total, note, setNote, setQty, onClose, onPlace, placing }: {
  lines: { p: Product; qty: number }[]; total: number; note: string; setNote: (s: string) => void;
  setQty: (id: string, qty: number) => void; onClose: () => void; onPlace: () => void; placing: boolean;
}) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "min(420px,100%)", background: "#FAF8F5", height: "100%", display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: DARK, margin: 0 }}>🧺 Mon panier</h2>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 22, color: "#9ca3af", cursor: "pointer" }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
          {!lines.length && <Empty text="Votre panier est vide." />}
          {lines.map(({ p, qty }) => (
            <div key={p.id} style={{ display: "flex", gap: 12, alignItems: "center", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 10, marginBottom: 10 }}>
              <ProductVisual p={p} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: DARK }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{euro(p.price)} × {qty} = <b>{euro(p.price * qty)}</b></div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <QtyBtn label="−" onClick={() => setQty(p.id, qty - 1)} />
                <span style={{ minWidth: 22, textAlign: "center", fontSize: 14, fontWeight: 700 }}>{qty}</span>
                <QtyBtn label="+" onClick={() => setQty(p.id, qty + 1)} />
              </div>
            </div>
          ))}
          {!!lines.length && (
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Un mot pour la direction (taille, couleur, urgence…)" rows={3} maxLength={1000}
              style={{ width: "100%", marginTop: 8, padding: "10px 12px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
          )}
        </div>
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: 18, background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: DARK }}>Total</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: GOLD }}>{euro(total)}</span>
          </div>
          <button onClick={onPlace} disabled={!lines.length || placing} style={{
            width: "100%", background: !lines.length ? "#d1d5db" : GOLD, color: "#fff", border: "none", borderRadius: 11,
            padding: "12px", fontSize: 14, fontWeight: 800, cursor: !lines.length || placing ? "default" : "pointer",
          }}>{placing ? "Envoi…" : "Commander"}</button>
        </div>
      </div>
    </div>
  );
}

function QtyBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return <button onClick={onClick} style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${BORDER}`, background: "#fff", color: DARK, fontSize: 15, fontWeight: 700, cursor: "pointer", lineHeight: 1 }}>{label}</button>;
}

// ════════════ Commandes (mes commandes / reçues) ════════════

function OrdersList({ orders, isDir, onReload }: { orders: Order[]; isDir: boolean; onReload: () => void }) {
  const setStatus = async (id: string, status: string) => {
    await fetch(`/api/shop/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => {});
    onReload();
  };
  const remove = async (id: string) => {
    if (!confirm("Supprimer cette commande ?")) return;
    await fetch(`/api/shop/orders/${id}`, { method: "DELETE" }).catch(() => {});
    onReload();
  };
  if (!orders.length) return <Empty text={isDir ? "Aucune commande reçue." : "Vous n'avez pas encore commandé."} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {orders.map(o => {
        const st = ORDER_STATUS[o.status] || ORDER_STATUS.nouveau;
        return (
          <div key={o.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 7, padding: "3px 9px" }}>{st.label}</span>
                {isDir && <span style={{ fontSize: 13, fontWeight: 700, color: DARK }}>{o.userName}</span>}
                <span style={{ fontSize: 12, color: "#9ca3af" }}>{new Date(o.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</span>
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, color: GOLD }}>{euro(o.total)}</span>
            </div>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
              {o.items.map(it => (
                <div key={it.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#4b5563" }}>
                  <span>{it.qty} × {it.name}</span>
                  <span>{euro(it.unitPrice * it.qty)}</span>
                </div>
              ))}
            </div>
            {o.note && <div style={{ marginTop: 8, background: GOLD_BG, borderLeft: `3px solid ${GOLD}`, borderRadius: 6, padding: "6px 10px", fontSize: 12.5, color: "#4b5563" }}>{o.note}</div>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
              {isDir && (
                <select value={o.status} onChange={e => setStatus(o.id, e.target.value)} style={{ fontSize: 12, padding: "4px 8px", border: `1px solid ${BORDER}`, borderRadius: 7, color: DARK, background: "#fff" }}>
                  {STATUS_ORDER.map(k => <option key={k} value={k}>{ORDER_STATUS[k].label}</option>)}
                </select>
              )}
              {(isDir || o.status === "nouveau") && (
                <button onClick={() => remove(o.id)} style={{ fontSize: 11.5, color: RED, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Supprimer</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════ Gestion des articles (direction) ════════════

const BLANK = { name: "", description: "", price: "", category: "textile", image: "", order: "0", active: true };
const isPhotoPath = (s: string | null | undefined) => !!s && s.startsWith("/api/shop/products/");

// Aperçu de la photo dans le formulaire : nouveau fichier > photo en base > emoji/URL.
function PhotoPreview({ photo, existing, fallback }: { photo: { data: string } | null; existing: string | null; fallback: string }) {
  const box: React.CSSProperties = { width: 88, height: 88, borderRadius: 12, background: GOLD_BG, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0, border: `1px solid ${BORDER}` };
  const src = photo?.data || existing || (isUrl(fallback) ? fallback : "");
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <div style={box}><img src={src} alt="aperçu" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>;
  }
  return <div style={{ ...box, fontSize: 40 }}>{fallback || "🛍️"}</div>;
}

function ManageProducts({ products, onChange }: { products: Product[]; onChange: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  // Photo : nouveau fichier choisi (data-URI), photo déjà en base, suppression.
  const [photo, setPhoto] = useState<{ data: string; mime: string } | null>(null);
  const [existingPhoto, setExistingPhoto] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoErr, setPhotoErr] = useState("");
  const [saveErr, setSaveErr] = useState("");

  const resetPhoto = () => { setPhoto(null); setExistingPhoto(null); setRemovePhoto(false); setPhotoErr(""); };
  const startNew = () => { setEditing("new"); setForm({ ...BLANK }); resetPhoto(); };
  const startEdit = (p: Product) => {
    setEditing(p.id);
    // Si l'article a une photo uploadée, le champ emoji/URL reste vide et la
    // photo est affichée séparément en aperçu.
    const uploaded = isPhotoPath(p.image);
    setForm({ name: p.name, description: p.description || "", price: String(p.price), category: p.category || "autre", image: uploaded ? "" : (p.image || ""), order: String(p.order), active: p.active });
    setPhoto(null); setExistingPhoto(uploaded ? p.image : null); setRemovePhoto(false); setPhotoErr("");
  };
  const cancel = () => { setEditing(null); resetPhoto(); };

  const onPickPhoto = (file: File | undefined) => {
    setPhotoErr("");
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { setPhotoErr("Format accepté : JPG, PNG, WEBP ou GIF."); return; }
    if (file.size > 4 * 1024 * 1024) { setPhotoErr("Photo trop lourde (max 4 Mo)."); return; }
    const reader = new FileReader();
    reader.onload = () => { setPhoto({ data: String(reader.result || ""), mime: file.type }); setRemovePhoto(false); };
    reader.readAsDataURL(file);
  };

  const errText = async (r: Response | null, fallback: string) => {
    if (!r) return "Réseau indisponible.";
    const j = await r.json().catch(() => null);
    return (j && j.error) || fallback;
  };

  const save = async () => {
    if (form.name.trim().length < 2 || saving) return;
    setSaving(true); setSaveErr("");
    // Le champ « image » texte (emoji/URL) n'est envoyé que si aucune photo
    // n'est en jeu : la photo uploadée pilote elle-même la référence image.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = { name: form.name, description: form.description, price: num(form.price), category: form.category, order: parseInt(form.order) || 0, active: form.active };
    if (!photo) {
      if (removePhoto || (!existingPhoto)) payload.image = form.image;  // emoji/URL ou vide
      // sinon : photo existante conservée → on ne touche pas au champ image
    }
    let id = editing;
    if (editing === "new") {
      const res = await fetch("/api/shop/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
      const j = res?.ok ? await res.json().catch(() => null) : null;
      if (!j?.id) { setSaving(false); setSaveErr(await errText(res, "Création de l'article impossible.")); return; }
      id = j.id;
    } else {
      const res = await fetch(`/api/shop/products/${editing}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
      if (!res?.ok) { setSaving(false); setSaveErr(await errText(res, "Enregistrement impossible.")); return; }
    }
    // Photo : téléversement du nouveau fichier, ou suppression demandée.
    if (photo && id) {
      const res = await fetch(`/api/shop/products/${id}/image`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: photo.data, mime: photo.mime }) }).catch(() => null);
      if (!res?.ok) { setSaving(false); setSaveErr("Article enregistré mais la photo n'a pas pu être téléversée : " + await errText(res, "erreur serveur.")); onChange(); return; }
    } else if (removePhoto && existingPhoto && id) {
      await fetch(`/api/shop/products/${id}/image`, { method: "DELETE" }).catch(() => {});
    }
    setSaving(false);
    setEditing(null); resetPhoto(); onChange();
  };
  const toggle = async (p: Product) => {
    await fetch(`/api/shop/products/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !p.active }) }).catch(() => {});
    onChange();
  };
  const remove = async (p: Product) => {
    if (!confirm(`Supprimer définitivement « ${p.name} » ?`)) return;
    await fetch(`/api/shop/products/${p.id}`, { method: "DELETE" }).catch(() => {});
    onChange();
  };

  const champ: React.CSSProperties = { width: "100%", padding: "9px 11px", border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 14, boxSizing: "border-box" };
  const lab: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 4, display: "block" };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button onClick={startNew} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Nouvel article</button>
      </div>

      {editing && (
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "2 1 220px" }}><label style={lab}>Nom</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Gourde isotherme" style={champ} /></div>
            <div style={{ flex: "1 1 100px" }}><label style={lab}>Prix (€)</label><input inputMode="decimal" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="18" style={champ} /></div>
          </div>
          <div style={{ marginTop: 12 }}><label style={lab}>Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ ...champ, resize: "vertical", fontSize: 13 }} /></div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            <div style={{ flex: "1 1 140px" }}><label style={lab}>Catégorie</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={champ}>
                {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div style={{ flex: "0 1 90px" }}><label style={lab}>Ordre</label><input inputMode="numeric" value={form.order} onChange={e => setForm(f => ({ ...f, order: e.target.value }))} style={champ} /></div>
          </div>

          {/* Photo de l'article */}
          <div style={{ marginTop: 14 }}>
            <label style={lab}>Photo de l'article</label>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
              <PhotoPreview photo={photo} existing={removePhoto ? null : existingPhoto} fallback={form.image} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ display: "inline-block", background: GOLD_BG, color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  📷 {photo || (existingPhoto && !removePhoto) ? "Changer la photo" : "Téléverser une photo"}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => onPickPhoto(e.target.files?.[0])} style={{ display: "none" }} />
                </label>
                {(photo || (existingPhoto && !removePhoto)) && (
                  <button type="button" onClick={() => { setPhoto(null); setRemovePhoto(true); }} style={{ marginLeft: 8, background: "none", color: RED, border: `1px solid ${BORDER}`, borderRadius: 9, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Retirer</button>
                )}
                {photoErr && <div style={{ color: RED, fontSize: 12, marginTop: 6 }}>{photoErr}</div>}
                <div style={{ marginTop: 8 }}>
                  <label style={{ ...lab, marginBottom: 3 }}>Ou emoji / URL d'image (secours si pas de photo)</label>
                  <input value={form.image} onChange={e => setForm(f => ({ ...f, image: e.target.value }))} placeholder="🍶  ou  https://…/photo.jpg" style={champ} />
                </div>
              </div>
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13, color: DARK, cursor: "pointer" }}>
            <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} /> Visible dans la boutique
          </label>
          {saveErr && <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", color: RED, borderRadius: 9, padding: "9px 12px", fontSize: 12.5, fontWeight: 600, marginTop: 12 }}>{saveErr}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <button onClick={cancel} style={{ background: "#fff", color: "#6b7280", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Annuler</button>
            <button onClick={save} disabled={form.name.trim().length < 2 || saving} style={{ background: form.name.trim().length < 2 ? "#d1d5db" : GOLD, color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: form.name.trim().length < 2 ? "default" : "pointer" }}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
          </div>
        </div>
      )}

      {!products.length && <Empty text="Aucun article. Créez le premier !" />}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {products.map(p => (
          <div key={p.id} style={{ display: "flex", gap: 14, alignItems: "center", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, opacity: p.active ? 1 : 0.55 }}>
            <ProductVisual p={p} size={48} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: DARK }}>{p.name} {!p.active && <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>(masqué)</span>}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{euro(p.price)} · {CATS[p.category || "autre"]?.label || p.category}</div>
            </div>
            <button onClick={() => toggle(p)} style={{ fontSize: 12, fontWeight: 700, color: p.active ? AMBER : GREEN, background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>{p.active ? "Masquer" : "Afficher"}</button>
            <button onClick={() => startEdit(p)} style={{ fontSize: 12, fontWeight: 700, color: BLUE, background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>Modifier</button>
            <button onClick={() => remove(p)} style={{ fontSize: 16, color: RED, background: "none", border: "none", cursor: "pointer" }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════ Divers ════════════

function FilterBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{
      background: active ? GOLD : "#fff", color: active ? "#fff" : "#6b7280",
      border: `1px solid ${active ? GOLD : BORDER}`, borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
    }}>{label}</button>
  );
}
function Empty({ text }: { text: string }) {
  return <div style={{ color: "#9ca3af", fontSize: 13, padding: 28, textAlign: "center" }}>{text}</div>;
}
