import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { put } from "@vercel/blob";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AssetType } from "@prisma/client";

// POST /api/assets — 上传文件到 Vercel Blob 并创建 Asset 记录
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const projectId = formData.get("projectId") as string | null;
  const assetType = formData.get("type") as AssetType | null;

  if (!file || !projectId) {
    return NextResponse.json(
      { error: "Missing file or projectId" },
      { status: 400 }
    );
  }

  // 验证项目属于当前用户
  const project = await db.project.findFirst({
    where: { id: projectId, userId: session.user.id },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // 检查存储额度
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { storageUsed: true, storageLimit: true },
  });
  if (user && user.storageUsed + BigInt(file.size) > user.storageLimit) {
    return NextResponse.json(
      { error: "Storage limit exceeded. Upgrade your plan for more space." },
      { status: 403 }
    );
  }

  // 上传到 Vercel Blob
  const blob = await put(`projects/${projectId}/${file.name}`, file, {
    access: "public",
  });

  // 推断素材类型
  const type = assetType || inferAssetType(file.name);

  // 创建 Asset 记录
  const asset = await db.asset.create({
    data: {
      name: file.name,
      type,
      mimeType: file.type,
      size: BigInt(file.size),
      blobUrl: blob.url,
      projectId,
    },
  });

  // 更新用户已用存储
  await db.user.update({
    where: { id: session.user.id },
    data: { storageUsed: { increment: BigInt(file.size) } },
  });

  return NextResponse.json({
    id: asset.id,
    name: asset.name,
    type: asset.type,
    url: blob.url,
    size: Number(asset.size),
  }, { status: 201 });
}

function inferAssetType(filename: string): AssetType {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "mp3": case "wav": case "m4a": case "ogg": case "flac":
      return "AUDIO";
    case "mp4": case "webm": case "mov":
      return "VIDEO";
    case "srt": case "vtt":
      return "SUBTITLE";
    case "png": case "jpg": case "jpeg": case "gif": case "webp":
      return "IMAGE";
    case "pdf": case "txt": case "md":
      return "DOCUMENT";
    default:
      return "DOCUMENT";
  }
}
