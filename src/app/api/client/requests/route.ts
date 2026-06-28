import { NextResponse } from "next/server";
import { getClientFromCookie } from "@/lib/client-auth";
import { listTenantRequests } from "@/lib/client-data";

// GET — liste des demandes du locataire avec leur statut.
export async function GET() {
  const client = await getClientFromCookie();
  if (!client) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  return NextResponse.json({ requests: await listTenantRequests({ email: client.email }) });
}
