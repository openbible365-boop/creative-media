import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { transcribeFunction, translateFunction } from "@/lib/inngest-functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    transcribeFunction,
    translateFunction,
    // 后续在此添加更多引擎函数:
    // ttsFunction,       // 引擎 C: 文字转语音
    // pdfParseFunction,  // PDF 解析
  ],
});
