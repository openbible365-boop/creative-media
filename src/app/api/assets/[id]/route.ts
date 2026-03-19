import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { del } from "@vercel/blob";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/assets/:id — 获取单个资产详情
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const asset = await db.asset.findFirst({
    where: {
      id,
      project: { userId: session.user.id },
    },
    include: {
      children: {
        select: { id: true, name: true, type: true, blobUrl: true },
      },
    },
  });

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...asset,
    size: Number(asset.size),
  });
}

// DELETE /api/assets/:id — 删除资产
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const asset = await db.asset.findFirst({
    where: {
      id,
      project: { userId: session.user.id },
    },
  });

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  // 从 Vercel Blob 删除文件
  try {
    await del(asset.blobUrl);
  } catch {
    // Blob 删除失败不阻塞，可能文件已不存在
    console.warn(`Failed to delete blob: ${asset.blobUrl}`);
  }

  // 删除数据库记录
  await db.asset.delete({ where: { id } });

  // 更新用户已用存储
  await db.user.update({
    where: { id: session.user.id },
    data: { storageUsed: { decrement: asset.size } },
  });

  return NextResponse.json({ success: true });
}
