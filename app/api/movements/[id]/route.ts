import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Movement from "@/lib/models/Movement";
import DamageReport from "@/lib/models/DamageReport";
import { logActivity } from "@/lib/activityLogger";
import mongoose from "mongoose";

const SYSTEM_ADMIN_OID = new mongoose.Types.ObjectId("000000000000000000000000");
function resolveOid(id: string) {
  return mongoose.isValidObjectId(id) ? id : SYSTEM_ADMIN_OID;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();

  const movement = await Movement.findById(id)
    .populate("asset", "name category")
    .populate("event", "name location fromDate toDate")
    .populate("allocatedPerson", "name phone")
    .populate("outBy", "name")
    .lean();

  if (!movement) return NextResponse.json({ error: "Movement not found" }, { status: 404 });
  return NextResponse.json({ success: true, data: movement });
}

// PATCH – used to record IN (return) with condition/damage
export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as {
    returnBy?: string;
    verifiedBy?: string;
    condition?: "good" | "damaged" | "defective" | "missing";
    damageReason?: string;
    remarks?: string;
  };

  await connectDB();
  const movement = await Movement.findById(id);
  if (!movement) return NextResponse.json({ error: "Movement not found" }, { status: 404 });

  movement.status = "IN";
  movement.inDate = new Date();
  if (body.returnBy) movement.returnBy = body.returnBy;
  if (body.verifiedBy) movement.verifiedBy = body.verifiedBy;
  if (body.condition) movement.condition = body.condition;
  if (body.damageReason) movement.damageReason = body.damageReason;
  if (body.remarks) movement.remarks = body.remarks;

  await movement.save();

  // Auto-create damage report if condition is not good
  if (body.condition && body.condition !== "good") {
    const conditionToType: Record<string, "damage" | "defect" | "missing"> = {
      damaged: "damage",
      defective: "defect",
      missing: "missing",
    };
    const reportType = conditionToType[body.condition] ?? "damage";
    await DamageReport.create({
      movement: movement._id,
      asset: movement.asset,
      event: movement.event,
      type: reportType,
      reason: body.damageReason ?? "No reason provided",
      reportedBy: resolveOid(session.user.id),
    });
  }

  await logActivity({
    userId: session.user.id,
    userName: session.user.name,
    action: "IN",
    module: "Movements",
    resourceId: id,
    details: `Asset returned. Condition: ${body.condition ?? "good"}`,
  });

  return NextResponse.json({ success: true, data: movement });
}
