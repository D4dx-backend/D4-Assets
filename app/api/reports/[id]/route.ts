import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
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

// PATCH – edit type/reason/notes and/or resolve a damage report
export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid report id" }, { status: 400 });
  }

  const body = await req.json() as {
    type?: "damage" | "defect" | "missing";
    reason?: string;
    notes?: string;
    isResolved?: boolean;
  };

  await connectDB();
  const report = await DamageReport.findById(id);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  if (body.type !== undefined) report.type = body.type;
  if (body.reason !== undefined && body.reason.trim()) report.reason = body.reason.trim();
  if (body.notes !== undefined) report.notes = body.notes.trim() || undefined;

  if (body.isResolved === true && !report.isResolved) {
    report.isResolved = true;
    report.resolvedAt = new Date();
    report.resolvedBy = resolveOid(session.user.id) as unknown as mongoose.Types.ObjectId;
  } else if (body.isResolved === false && report.isResolved) {
    report.isResolved = false;
    report.resolvedAt = undefined;
    report.resolvedBy = undefined;
  }

  await report.save();

  await logActivity({
    userId: session.user.id,
    userName: session.user.name,
    action: "UPDATE",
    module: "Reports",
    resourceId: id,
    details: body.isResolved === true
      ? `Damage report resolved`
      : `Damage report updated`,
  });

  const populated = await DamageReport.findById(id)
    .populate("asset", "name category")
    .populate("event", "name")
    .populate("reportedBy", "name")
    .populate("resolvedBy", "name")
    .lean();

  return NextResponse.json({ success: true, data: populated });
}
