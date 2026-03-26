import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Asset from "@/lib/models/Asset";
import { logActivity } from "@/lib/activityLogger";

// GET /api/assets
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";

  await connectDB();

  const query: Record<string, unknown> = { isActive: true };
  if (search) query.$text = { $search: search };
  if (category) query.category = category;

  const assets = await Asset.find(query)
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ success: true, data: assets });
}

// POST /api/assets
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    name: string;
    category: string;
    dateOfPurchase: string;
    warrantyDetails?: string;
    warrantyExpiryDate?: string;
    billUrl?: string;
    billPublicId?: string;
  };

  const { name, category, dateOfPurchase, warrantyDetails, warrantyExpiryDate, billUrl, billPublicId } = body;

  if (!name || !category || !dateOfPurchase) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  await connectDB();

  const asset = await Asset.create({
    name,
    category,
    dateOfPurchase: new Date(dateOfPurchase),
    warrantyDetails: warrantyDetails ?? "",
    warrantyExpiryDate: warrantyExpiryDate ? new Date(warrantyExpiryDate) : undefined,
    billUrl,
    billPublicId,
    createdBy: session.user.id,
  });

  await logActivity({
    userId: session.user.id,
    userName: session.user.name,
    action: "CREATE",
    module: "Assets",
    resourceId: asset._id.toString(),
    details: `Created asset: ${name}`,
  });

  return NextResponse.json({ success: true, data: asset }, { status: 201 });
}
