import Link from "next/link";
import { ReactNode } from "react";

export default function Card({ title, action, children }: {
  title: string;
  action?: { label: string; href: string };
  children: ReactNode;
}) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "16px 18px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{title}</h2>
        {action && (
          <Link href={action.href} style={{
            fontSize: 12, color: "#B8966A", textDecoration: "none",
            border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 10px",
          }}>{action.label}</Link>
        )}
      </div>
      {children}
    </div>
  );
}
