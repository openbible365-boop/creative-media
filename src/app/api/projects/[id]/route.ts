import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/projects/:id — 获取单个项目详情及其所有资产
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: session.user.id },
    include: {
      assets: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          type: true,
          mimeType: true,
          size: true,
          blobUrl: true,
          sourceEngine: true,
          parentId: true,
          metadata: true,
          createdAt: true,
        },
      },
      _count: { select: { assets: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // BigInt → Number for JSON serialization
  const serialized = {
    ...project,
    assets: project.assets.map((a) => ({
      ...a,
      size: Number(a.size),
    })),
  };

  return NextResponse.json(serialized);
}

// DELETE /api/projects/:id — 删除项目（级联删除资产）
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // 计算项目内所有资产大小，用于更新用户存储额度
  const totalSize = await db.asset.aggregate({
    where: { projectId: id },
    _sum: { size: true },
  });

  // 级联删除项目（schema 中已定义 onDelete: Cascade）
  await db.project.delete({ where: { id } });

  // 更新用户已用存储
  if (totalSize._sum.size) {
    await db.user.update({
      where: { id: session.user.id },
      data: { storageUsed: { decrement: totalSize._sum.size } },
    });
  }

  return NextResponse.json({ success: true });
}
