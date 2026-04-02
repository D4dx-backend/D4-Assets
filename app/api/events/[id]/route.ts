import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Event from "@/lib/models/Event";
import Movement from "@/lib/models/Movement";
import { logActivity } from "@/lib/activityLogger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();
  const event = await Event.findById(id)
    .populate("responsiblePerson", "name phone email")
    .populate("createdBy", "name email")
    .lean();

  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: event });
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;

  await connectDB();
  const event = await Event.findById(id);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const allowed = ["name", "location", "fromDate", "toDate", "responsiblePerson", "status"];
  for (const key of allowed) {
    if (key in body) {
      if ((key === "fromDate" || key === "toDate") && body[key]) {
        (event as unknown as Record<string, unknown>)[key] = new Date(body[key] as string);
      } else {
        (event as unknown as Record<string, unknown>)[key] = body[key];
      }
    }
  }

  await event.save();
  await logActivity({
    userId: session.user.id,
    userName: session.user.name,
    action: "UPDATE",
    module: "Events",
    resourceId: id,
    details: `Updated event: ${event.name}`,
  });

  return NextResponse.json({ success: true, data: event });
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  await connectDB();

  const event = await Event.findById(id);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  if (event.status === "completed") {
    return NextResponse.json({ error: "Cannot delete a completed event" }, { status: 400 });
  }

  const hasIssued = await Movement.exists({ event: id, status: "OUT" });
  if (hasIssued) {
    return NextResponse.json({ error: "Cannot delete an event with assets still issued" }, { status: 400 });
  }

  event.isActive = false;
  await event.save();

  await logActivity({
    userId: session.user.id,
    userName: session.user.name,
    action: "DELETE",
    module: "Events",
    resourceId: id,
    details: `Deleted event: ${event.name}`,
  });

  return NextResponse.json({ success: true });
}
