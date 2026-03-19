import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { inngest } from "@/lib/inngest";

// POST /api/transcribe — 提交音频转写任务
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assetId, language, outputFormat } = await req.json();

  if (!assetId) {
    return NextResponse.json({ error: "Missing assetId" }, { status: 400 });
  }

  // 验证素材存在且属于当前用户的项目
  const asset = await db.asset.findFirst({
    where: {
      id: assetId,
      project: { userId: session.user.id },
    },
    include: { project: true },
  });

  if (!asset || asset.type !== "AUDIO") {
    return NextResponse.json({ error: "Audio asset not found" }, { status: 404 });
  }

  // 检查音频处理额度
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { audioMinutesUsed: true, audioMinutesLimit: true },
  });
  if (user && user.audioMinutesUsed >= user.audioMinutesLimit) {
    return NextResponse.json(
      { error: "Audio processing quota exceeded. Upgrade your plan." },
      { status: 403 }
    );
  }

  // 创建任务记录
  const task = await db.task.create({
    data: {
      type: "TRANSCRIBE",
      status: "PENDING",
      projectId: asset.projectId,
      assetId: asset.id,
      input: {
        blobUrl: asset.blobUrl,
        language: language || "auto", // auto = 自动检测语言
        outputFormat: outputFormat || "transcript", // transcript | subtitle
      },
    },
  });

  // 触发 Inngest 异步任务
  await inngest.send({
    name: "engine/transcribe",
    data: {
      taskId: task.id,
      userId: session.user.id,
      assetId: asset.id,
      projectId: asset.projectId,
      blobUrl: asset.blobUrl,
      language: language || "auto",
      outputFormat: outputFormat || "transcript",
    },
  });

  return NextResponse.json({
    taskId: task.id,
    status: "PENDING",
    message: "Transcription task submitted. Poll /api/tasks/{taskId} for progress.",
  }, { status: 202 });
}
