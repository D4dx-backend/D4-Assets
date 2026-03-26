import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Movement from "@/lib/models/Movement";
import DamageReport from "@/lib/models/DamageReport";
import { logActivity } from "@/lib/activityLogger";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("event");
  const assetId = searchParams.get("asset");
  const status = searchParams.get("status");

  await connectDB();
  const query: Record<string, unknown> = {};
  if (eventId) query.event = eventId;
  if (assetId) query.asset = assetId;
  if (status) query.status = status;

  const movements = await Movement.find(query)
    .populate("asset", "name category")
    .populate("event", "name location fromDate toDate")
    .populate("allocatedPerson", "name")
    .populate("outBy", "name")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ success: true, data: movements });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    asset: string;
    event: string;
    allocatedPerson: string;
    outDate?: string;
    remarks?: string;
  };

  const { asset, event, allocatedPerson } = body;
  if (!asset || !event || !allocatedPerson) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  await connectDB();

  // Check if asset is already OUT for this event
  const existing = await Movement.findOne({ asset, event, status: "OUT" });
  if (existing) {
    return NextResponse.json(
      { error: "This asset is already checked out for this event" },
      { status: 409 }
    );
  }

  const movement = await Movement.create({
    asset,
    event,
    allocatedPerson,
    outDate: body.outDate ? new Date(body.outDate) : new Date(),
    outBy: session.user.id,
    status: "OUT",
    remarks: body.remarks,
    createdBy: session.user.id,
  });

  await logActivity({
    userId: session.user.id,
    userName: session.user.name,
    action: "OUT",
    module: "Movements",
    resourceId: movement._id.toString(),
    details: `Asset checked out for event`,
  });

  return NextResponse.json({ success: true, data: movement }, { status: 201 });
}
