import { inngest } from "@/lib/inngest";
import { db } from "@/lib/db";
import { put } from "@vercel/blob";
import OpenAI from "openai";

// 延迟初始化，避免构建时缺少 API KEY 报错
let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

// ═══════════════════════════════════════
// 引擎 B 核心：音频转写异步任务
// 通过 Inngest 编排，突破 Serverless 超时限制
// ═══════════════════════════════════════

export const transcribeFunction = inngest.createFunction(
  {
    id: "engine-transcribe",
    retries: 2,
  },
  { event: "engine/transcribe" },
  async ({ event, step }) => {
    const { taskId, userId, assetId, projectId, blobUrl, language, outputFormat } = event.data;

    // Step 1: 更新任务状态为处理中
    await step.run("update-status-processing", async () => {
      await db.task.update({
        where: { id: taskId },
        data: { status: "PROCESSING", progress: 10 },
      });
    });

    // Step 2: 下载音频文件并调用 Whisper API
    const transcription = await step.run("call-whisper-api", async () => {
      // 从 Vercel Blob 获取音频
      const audioResponse = await fetch(blobUrl);
      const audioBuffer = await audioResponse.arrayBuffer();
      const audioFile = new File([audioBuffer], "audio.mp3", { type: "audio/mpeg" });

      // 调用 OpenAI Whisper API
      const result = await getOpenAI().audio.transcriptions.create({
        model: "whisper-1",
        file: audioFile,
        language: language === "auto" ? undefined : language,
        response_format: outputFormat === "subtitle" ? "srt" : "verbose_json",
        timestamp_granularities: outputFormat === "subtitle" ? ["segment"] : undefined,
      });

      return result;
    });

    // Step 3: 更新进度
    await step.run("update-progress-60", async () => {
      await db.task.update({
        where: { id: taskId },
        data: { progress: 60 },
      });
    });

    // Step 4: 保存转写结果到 Vercel Blob + 创建 Asset
    const resultAsset = await step.run("save-result", async () => {
      const isSubtitle = outputFormat === "subtitle";
      const content = isSubtitle
        ? (transcription as unknown as string) // SRT 格式是纯文本
        : JSON.stringify(transcription, null, 2);

      const fileName = isSubtitle ? "transcript.srt" : "transcript.json";
      const mimeType = isSubtitle ? "application/x-subrip" : "application/json";

      // 上传结果文件
      const blob = await put(
        `projects/${projectId}/${Date.now()}_${fileName}`,
        content,
        { access: "public", contentType: mimeType }
      );

      // 创建素材记录，关联父素材
      const asset = await db.asset.create({
        data: {
          name: fileName,
          type: isSubtitle ? "SUBTITLE" : "TRANSCRIPT",
          mimeType,
          size: BigInt(Buffer.byteLength(content)),
          blobUrl: blob.url,
          sourceEngine: "AUDIO_TO_TEXT",
          parentId: assetId,
          projectId,
          metadata: {
            language: language === "auto" ? (transcription as any).language : language,
            duration: (transcription as any).duration || null,
          },
        },
      });

      return asset;
    });

    // Step 5: 更新音频处理额度
    await step.run("update-quota", async () => {
      // 估算音频时长（分钟），从 Whisper 响应中获取
      const durationMinutes = Math.ceil(
        ((transcription as any).duration || 60) / 60
      );

      await db.user.update({
        where: { id: userId },
        data: {
          audioMinutesUsed: { increment: durationMinutes },
        },
      });
    });

    // Step 6: 标记任务完成
    await step.run("complete-task", async () => {
      await db.task.update({
        where: { id: taskId },
        data: {
          status: "COMPLETED",
          progress: 100,
          output: {
            assetId: resultAsset.id,
            blobUrl: resultAsset.blobUrl,
          },
        },
      });
    });

    return { success: true, assetId: resultAsset.id };
  }
);
