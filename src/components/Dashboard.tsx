import StatCard from "./StatCard";
import Card from "./Card";

export default function Dashboard() {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard label="Biens gérés" value="—" icon="🏠" />
        <StatCard label="Locataires actifs" value="—" icon="👥" />
        <StatCard label="Encaissements" value="—" icon="💰" />
        <StatCard label="Franchisés" value="—" icon="🏪" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card title="Tâches urgentes" action={{ label: "Voir tout", href: "/taches" }}>
          <Empty message="Aucune tâche urgente" />
        </Card>
        <Card title="Rendez-vous aujourd'hui" action={{ label: "Planning", href: "/planning" }}>
          <Empty message="Aucun rendez-vous aujourd'hui" />
        </Card>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title="Franchisés — activité">
          <Empty message="Aucun franchisé enregistré" />
        </Card>
        <Card title="Dossiers en cours">
          <Empty message="Aucun dossier en cours" />
        </Card>
      </div>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div style={{ padding: "28px 0", textAlign: "center", fontSize: 13, color: "#d1d5db" }}>
      {message}
    </div>
  );
}
