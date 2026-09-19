import { createServerFn } from "@tanstack/react-start"
import { auth } from "@clerk/tanstack-react-start/server"

import {
  chat,
  toServerSentEventsResponse,
  type UIMessage,
} from "@tanstack/ai"

import { createGeminiChat } from "@tanstack/ai-gemini"

const adapter = createGeminiChat(
  "gemini-3.1-pro-preview",
  process.env.GEMINI_API_KEY!,
)

export const chatFn = createServerFn({ method: "POST" })
  .inputValidator((data: { messages: UIMessage[] }) => data)
  .handler(async ({ data }) => {
    const { isAuthenticated, userId } = await auth()

    console.log("isAuthenticated:", isAuthenticated, "userId:", userId)

    if (!isAuthenticated || !userId) {
      return new Response("Unauthorized", {
        status: 401,
      })
    }

    const stream = chat({
      adapter,
      messages: data.messages,
    })

    return toServerSentEventsResponse(stream)
  })