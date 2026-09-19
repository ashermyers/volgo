import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import {
  clerkClient,
  auth,
} from "@clerk/tanstack-react-start/server"

import Navigation from "#/components/navigation"

import { useState } from "react"
import { ArrowUp, HandHeart, Sparkles, Square } from "lucide-react"
import {chatFn} from "#/server/chat"
import {
  chat,
  toServerSentEventsResponse,
  type UIMessage,
} from "@tanstack/ai"
import { geminiText } from "@tanstack/ai-gemini"
import { useChat } from "@tanstack/ai-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

/* -------------------------------------------------------------------------- */
/* Auth                                                                        */
/* -------------------------------------------------------------------------- */

const authStateFn = createServerFn().handler(async () => {
  const { isAuthenticated, userId } = await auth()

  if (!isAuthenticated || !userId) {
    return {
      userId: null,
      firstName: null,
    }
  }

  const user = await clerkClient().users.getUser(userId)

  return {
    userId,
    firstName: user.firstName,
  }
})

/* -------------------------------------------------------------------------- */
/* Gemini                                                                      */
/* -------------------------------------------------------------------------- */


/* -------------------------------------------------------------------------- */
/* Route                                                                       */
/* -------------------------------------------------------------------------- */

export const Route = createFileRoute("/")({
  component: Home,

  beforeLoad: () => authStateFn(),

  loader: async ({ context }) => {
    return {
      userId: context.userId,
      firstName: context.firstName,
    }
  },
})

/* -------------------------------------------------------------------------- */
/* Suggestion                                                                  */
/* -------------------------------------------------------------------------- */

function Suggestion({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-full text-muted-foreground"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

/* -------------------------------------------------------------------------- */
/* Home                                                                        */
/* -------------------------------------------------------------------------- */

function Home() {
  const [prompt, setPrompt] = useState("")

  const state = Route.useLoaderData()

  const {
    messages,
    sendMessage,
    isLoading,
    stop,
  } = useChat({
    fetcher: ({ messages }, { signal }) =>
      chatFn({
        data: { messages },
        signal,
      }),
  })

  function submitPrompt() {
    const value = prompt.trim()

    if (!value || isLoading) {
      return
    }

    sendMessage(value)
    setPrompt("")
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-3xl">

          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex size-10 items-center justify-center rounded-xl border bg-muted">
                <HandHeart className="size-5" />
              </div>
            </div>

            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              {state.firstName
                ? `How can we help, ${state.firstName}?`
                : "How can we help?"}
            </h1>

            <p className="mt-3 text-base text-muted-foreground">
              Tell us what you need, or how you'd like to help someone else.
            </p>
          </div>

          {/* Conversation */}
          {messages.length > 0 && (
            <div className="mb-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "flex justify-end"
                      : "flex justify-start"
                  }
                >
                  <div
                    className={
                      message.role === "user"
                        ? "max-w-[80%] rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground"
                        : "max-w-[80%] rounded-2xl bg-muted px-4 py-3 text-sm text-foreground"
                    }
                  >
                    {message.parts.map((part, index) => {
                      if (part.type !== "text") {
                        return null
                      }

                      return (
                        <span key={index}>
                          {part.content}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                    <Sparkles className="size-4 animate-pulse" />
                    Volgo is thinking...
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Prompt */}
          <div className="rounded-2xl border bg-card p-2 shadow-sm">
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault()
                  submitPrompt()
                }
              }}
              placeholder="I need help moving a desk this afternoon..."
              className="min-h-28 resize-none border-0 bg-transparent px-4 py-3 text-base shadow-none focus-visible:ring-0"
            />

            <div className="flex items-center justify-between px-2 pb-1">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  disabled
                >
                  <Sparkles className="size-4" />
                  Ask Volgo
                </Button>
              </div>

              {isLoading ? (
                <Button
                  size="icon"
                  variant="secondary"
                  className="rounded-xl"
                  onClick={stop}
                >
                  <Square className="size-4 fill-current" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="rounded-xl"
                  disabled={!prompt.trim()}
                  onClick={submitPrompt}
                >
                  <ArrowUp className="size-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Suggestions */}
          {messages.length === 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Suggestion
                onClick={() =>
                  setPrompt(
                    "I need help studying for calculus this week.",
                  )
                }
              >
                Help me study
              </Suggestion>

              <Suggestion
                onClick={() =>
                  setPrompt(
                    "I have an hour free and want to help someone.",
                  )
                }
              >
                I have an hour to give
              </Suggestion>

              <Suggestion
                onClick={() =>
                  setPrompt(
                    "I need someone to help me move something.",
                  )
                }
              >
                Help me move
              </Suggestion>

              <Suggestion
                onClick={() =>
                  setPrompt(
                    "I can help someone with programming.",
                  )
                }
              >
                Offer programming help
              </Suggestion>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}