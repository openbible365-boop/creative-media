import { Inngest } from "inngest";

// Inngest 客户端实例
export const inngest = new Inngest({
  id: "creative-media",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
