import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Person from "@/lib/models/Person";
import { logActivity } from "@/lib/activityLogger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { name?: string; phone?: string; email?: string; department?: string };

  await connectDB();
  const person = await Person.findByIdAndUpdate(id, body, { new: true });
  if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  await logActivity({
    userId: session.user.id,
    userName: session.user.name,
    action: "UPDATE",
    module: "Persons",
    resourceId: id,
    details: `Updated person: ${person.name}`,
  });

  return NextResponse.json({ success: true, data: person });
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  await connectDB();
  const person = await Person.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  await logActivity({
    userId: session.user.id,
    userName: session.user.name,
    action: "DELETE",
    module: "Persons",
    resourceId: id,
    details: `Deleted person: ${person.name}`,
  });

  return NextResponse.json({ success: true });
}
