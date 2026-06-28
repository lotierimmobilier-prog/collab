import { NextResponse } from "next/server";
import { clearClientCookie } from "@/lib/client-auth";

export async function POST() {
  await clearClientCookie();
  return NextResponse.json({ ok: true });
}
