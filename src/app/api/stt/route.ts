import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyC_MU-HVApJPEOrANKnXzashMkNtDnd9bs";
const GEMINI_MODEL = "gemini-2.5-flash";

// POST /api/stt — 代理 Gemini 语音转文字请求
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { audioBase64, mimeType } = await req.json();

  if (!audioBase64) {
    return NextResponse.json({ error: "Missing audio data" }, { status: 400 });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  // 最多重试3次（处理429限流）
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Transcribe the following audio recording into text. Output ONLY the transcribed text, nothing else. Detect the language automatically (supports Chinese, Korean, English, Japanese, and other languages). Do NOT translate — keep the original language as spoken.",
                },
                {
                  inline_data: {
                    mime_type: mimeType || "audio/webm",
                    data: audioBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
          },
        }),
      });

      if (response.status === 429) {
        // 限流 — 等待后重试
        const waitMs = (attempt + 1) * 3000;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      if (!response.ok) {
        const errorData = await response.text();
        return NextResponse.json(
          { error: `Gemini API error: ${response.status}`, details: errorData },
          { status: response.status }
        );
      }

      const data = await response.json();
      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      return NextResponse.json({ text });
    } catch (error) {
      if (attempt === 2) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Transcription failed" },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ error: "Max retries exceeded" }, { status: 429 });
}
