import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const event = await prisma.calendarEvent.update({
    where: { id },
    data: {
      ...(body.title       !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.location    !== undefined && { location: body.location }),
      ...(body.start       !== undefined && { start: new Date(body.start) }),
      ...(body.end         !== undefined && { end: new Date(body.end) }),
      ...(body.allDay      !== undefined && { allDay: body.allDay }),
      ...(body.color       !== undefined && { color: body.color }),
      ...(body.type        !== undefined && { type: body.type }),
      ...(body.attendees   !== undefined && { attendees: body.attendees }),
    },
  });
  return NextResponse.json({ ...event, start: event.start.toISOString(), end: event.end.toISOString() });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  await prisma.calendarEvent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
