import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Asset from "@/lib/models/Asset";
import { logActivity } from "@/lib/activityLogger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();

  const asset = await Asset.findById(id).populate("createdBy", "name email").lean();
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  return NextResponse.json({ success: true, data: asset });
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;

  await connectDB();
  const asset = await Asset.findById(id);
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  const allowed = ["name", "category", "dateOfPurchase", "warrantyDetails", "warrantyExpiryDate", "billUrl", "billPublicId"];
  for (const key of allowed) {
    if (key in body) {
      if ((key === "dateOfPurchase" || key === "warrantyExpiryDate") && body[key]) {
        (asset as unknown as Record<string, unknown>)[key] = new Date(body[key] as string);
      } else {
        (asset as unknown as Record<string, unknown>)[key] = body[key];
      }
    }
  }

  await asset.save();
  await logActivity({
    userId: session.user.id,
    userName: session.user.name,
    action: "UPDATE",
    module: "Assets",
    resourceId: id,
    details: `Updated asset: ${asset.name}`,
  });

  return NextResponse.json({ success: true, data: asset });
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  await connectDB();

  const asset = await Asset.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  await logActivity({
    userId: session.user.id,
    userName: session.user.name,
    action: "DELETE",
    module: "Assets",
    resourceId: id,
    details: `Deleted asset: ${asset.name}`,
  });

  return NextResponse.json({ success: true });
}
