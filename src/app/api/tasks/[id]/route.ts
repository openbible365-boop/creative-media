import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/tasks/:id — 查询任务状态（用于前端轮询）
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // 查找任务
  const task = await db.task.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      status: true,
      progress: true,
      output: true,
      error: true,
      projectId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // 验证任务所属项目属于当前用户
  const project = await db.project.findFirst({
    where: { id: task.projectId, userId: session.user.id },
  });

  if (!project) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(task);
}

