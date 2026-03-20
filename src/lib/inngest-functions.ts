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
    const {
      taskId,
      userId,
      assetId,
      projectId,
      blobUrl,
      language,
      outputFormat,
      subtitleFormat,
      targetLanguages,
    } = event.data;

    try {
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

        // 从 URL 推断文件扩展名
        const urlPath = new URL(blobUrl).pathname;
        const ext = urlPath.split(".").pop() || "mp3";
        const mimeMap: Record<string, string> = {
          mp3: "audio/mpeg",
          wav: "audio/wav",
          m4a: "audio/mp4",
          ogg: "audio/ogg",
          flac: "audio/flac",
          mp4: "video/mp4",
          webm: "video/webm",
        };
        const mimeType = mimeMap[ext] || "audio/mpeg";
        const audioFile = new File([audioBuffer], `audio.${ext}`, {
          type: mimeType,
        });

        // 确定 response_format
        const isSubtitle = outputFormat === "subtitle";
        const format = isSubtitle
          ? subtitleFormat === "vtt"
            ? "vtt"
            : "srt"
          : "verbose_json";

        // 调用 OpenAI Whisper API
        const result = await getOpenAI().audio.transcriptions.create({
          model: "whisper-1",
          file: audioFile,
          language: language === "auto" ? undefined : language,
          response_format: format,
          timestamp_granularities: isSubtitle ? ["segment"] : undefined,
        });

        return result;
      });

      // Step 3: 更新进度
      await step.run("update-progress-50", async () => {
        await db.task.update({
          where: { id: taskId },
          data: { progress: 50 },
        });
      });

      // Step 4: 保存转写结果到 Vercel Blob + 创建 Asset
      const resultAsset = await step.run("save-result", async () => {
        const isSubtitle = outputFormat === "subtitle";
        const subFmt = subtitleFormat === "vtt" ? "vtt" : "srt";
        const content = isSubtitle
          ? (transcription as unknown as string) // SRT/VTT 格式是纯文本
          : JSON.stringify(transcription, null, 2);

        const fileName = isSubtitle
          ? `transcript.${subFmt}`
          : "transcript.json";
        const mimeType = isSubtitle
          ? subFmt === "vtt"
            ? "text/vtt"
            : "application/x-subrip"
          : "application/json";

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
              language:
                language === "auto"
                  ? (transcription as any).language
                  : language,
              duration: (transcription as any).duration || null,
              format: isSubtitle ? subFmt : "json",
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

      // Step 7: 如果指定了目标翻译语言，自动触发翻译任务
      if (
        targetLanguages &&
        Array.isArray(targetLanguages) &&
        targetLanguages.length > 0
      ) {
        await step.run("trigger-translations", async () => {
          for (const targetLang of targetLanguages) {
            // 跳过与源语言相同的目标语言
            const sourceLang =
              language === "auto"
                ? (transcription as any).language
                : language;
            if (targetLang === sourceLang) continue;

            // 创建翻译任务记录
            const translateTask = await db.task.create({
              data: {
                type: "TRANSLATE",
                status: "PENDING",
                projectId,
                assetId: resultAsset.id,
                input: {
                  sourceAssetId: resultAsset.id,
                  targetLanguage: targetLang,
                },
              },
            });

            // 触发翻译 Inngest 事件
            await inngest.send({
              name: "engine/translate",
              data: {
                taskId: translateTask.id,
                userId,
                assetId: resultAsset.id,
                projectId,
                blobUrl: resultAsset.blobUrl,
                sourceLanguage: sourceLang,
                targetLanguage: targetLang,
                contentType: resultAsset.type, // TRANSCRIPT or SUBTITLE
              },
            });
          }
        });
      }

      return { success: true, assetId: resultAsset.id };
    } catch (error) {
      // 标记任务失败
      await step.run("mark-failed", async () => {
        await db.task.update({
          where: { id: taskId },
          data: {
            status: "FAILED",
            error:
              error instanceof Error ? error.message : "Unknown error occurred",
          },
        });
      });
      throw error;
    }
  }
);

// ═══════════════════════════════════════
// 引擎 B 扩展：翻译异步任务
// 使用 GPT-4o 进行分段翻译，保留时间戳
// ═══════════════════════════════════════

const LANG_NAMES: Record<string, string> = {
  en: "English",
  zh: "Chinese (Simplified)",
  ko: "Korean",
  ja: "Japanese",
  es: "Spanish",
  fr: "French",
};

export const translateFunction = inngest.createFunction(
  {
    id: "engine-translate",
    retries: 2,
  },
  { event: "engine/translate" },
  async ({ event, step }) => {
    const {
      taskId,
      userId,
      assetId,
      projectId,
      blobUrl,
      sourceLanguage,
      targetLanguage,
      contentType,
    } = event.data;

    try {
      // Step 1: 更新任务状态为处理中
      await step.run("update-status-processing", async () => {
        await db.task.update({
          where: { id: taskId },
          data: { status: "PROCESSING", progress: 10 },
        });
      });

      // Step 2: 下载源文件内容
      const sourceContent = await step.run("download-source", async () => {
        const response = await fetch(blobUrl);
        return await response.text();
      });

      // Step 3: 翻译内容
      const translatedContent = await step.run("translate-content", async () => {
        const sourceLangName = LANG_NAMES[sourceLanguage] || sourceLanguage;
        const targetLangName = LANG_NAMES[targetLanguage] || targetLanguage;

        const isSubtitle =
          contentType === "SUBTITLE" ||
          blobUrl.endsWith(".srt") ||
          blobUrl.endsWith(".vtt");

        let systemPrompt: string;
        let userContent: string;

        if (isSubtitle) {
          // SRT/VTT 翻译 — 保留时间戳格式
          systemPrompt = `You are a professional subtitle translator. Translate the following subtitle file from ${sourceLangName} to ${targetLangName}. 
IMPORTANT RULES:
- Keep ALL timestamp lines and formatting EXACTLY as they are
- Only translate the text content lines
- Keep subtitle numbering intact
- Maintain the same line breaks within each subtitle block
- Output ONLY the translated subtitle file, nothing else`;
          userContent = sourceContent;
        } else {
          // JSON transcript 翻译
          systemPrompt = `You are a professional translator. Translate the following transcript from ${sourceLangName} to ${targetLangName}.
IMPORTANT RULES:
- The input is a JSON transcript from Whisper ASR
- Translate the "text" field of each segment and the top-level "text" field
- Keep ALL other fields (timestamps, IDs, etc.) exactly as they are
- Output ONLY valid JSON, nothing else`;
          userContent = sourceContent;
        }

        const response = await getOpenAI().chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          temperature: 0.3,
        });

        return response.choices[0]?.message?.content || "";
      });

      // Step 4: 更新进度
      await step.run("update-progress-70", async () => {
        await db.task.update({
          where: { id: taskId },
          data: { progress: 70 },
        });
      });

      // Step 5: 保存翻译结果
      const resultAsset = await step.run("save-translated", async () => {
        const isSubtitle = contentType === "SUBTITLE";

        // 确定文件扩展名
        let ext = "json";
        let mimeType = "application/json";
        if (isSubtitle) {
          if (blobUrl.endsWith(".vtt")) {
            ext = "vtt";
            mimeType = "text/vtt";
          } else {
            ext = "srt";
            mimeType = "application/x-subrip";
          }
        }

        const fileName = `transcript_${targetLanguage}.${ext}`;

        // 上传翻译后的文件
        const blob = await put(
          `projects/${projectId}/${Date.now()}_${fileName}`,
          translatedContent,
          { access: "public", contentType: mimeType }
        );

        // 创建素材记录
        const asset = await db.asset.create({
          data: {
            name: fileName,
            type: isSubtitle ? "SUBTITLE" : "TRANSCRIPT",
            mimeType,
            size: BigInt(Buffer.byteLength(translatedContent)),
            blobUrl: blob.url,
            sourceEngine: "AUDIO_TO_TEXT",
            parentId: assetId,
            projectId,
            metadata: {
              language: targetLanguage,
              translatedFrom: sourceLanguage,
            },
          },
        });

        return asset;
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
    } catch (error) {
      await step.run("mark-failed", async () => {
        await db.task.update({
          where: { id: taskId },
          data: {
            status: "FAILED",
            error:
              error instanceof Error ? error.message : "Translation failed",
          },
        });
      });
      throw error;
    }
  }
);
