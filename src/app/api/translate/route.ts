import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { inngest } from "@/lib/inngest";

// POST /api/translate — 提交独立翻译任务
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assetId, targetLanguage } = await req.json();

  if (!assetId || !targetLanguage) {
    return NextResponse.json(
      { error: "Missing assetId or targetLanguage" },
      { status: 400 }
    );
  }

  // 验证素材存在、属于当前用户的项目、且类型为 TRANSCRIPT 或 SUBTITLE
  const asset = await db.asset.findFirst({
    where: {
      id: assetId,
      project: { userId: session.user.id },
    },
    include: { project: true },
  });

  if (!asset || (asset.type !== "TRANSCRIPT" && asset.type !== "SUBTITLE")) {
    return NextResponse.json(
      { error: "Transcript or subtitle asset not found" },
      { status: 404 }
    );
  }

  // 从 metadata 中获取源语言
  const sourceLanguage =
    (asset.metadata as Record<string, unknown>)?.language || "auto";

  // 创建翻译任务记录
  const task = await db.task.create({
    data: {
      type: "TRANSLATE",
      status: "PENDING",
      projectId: asset.projectId,
      assetId: asset.id,
      input: {
        sourceAssetId: asset.id,
        blobUrl: asset.blobUrl,
        sourceLanguage,
        targetLanguage,
      },
    },
  });

  // 触发 Inngest 异步任务
  await inngest.send({
    name: "engine/translate",
    data: {
      taskId: task.id,
      userId: session.user.id,
      assetId: asset.id,
      projectId: asset.projectId,
      blobUrl: asset.blobUrl,
      sourceLanguage,
      targetLanguage,
      contentType: asset.type,
    },
  });

  return NextResponse.json(
    {
      taskId: task.id,
      status: "PENDING",
      message:
        "Translation task submitted. Poll /api/tasks/{taskId} for progress.",
    },
    { status: 202 }
  );
}
