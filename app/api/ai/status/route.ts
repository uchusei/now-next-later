import { NextResponse } from "next/server"
import { getOllamaStatus } from "@/lib/ollama"
import { createServerAiDisabledStatus, isServerAiRouteEnabled } from "@/lib/server-ai"

export async function GET() {
  if (!isServerAiRouteEnabled()) {
    return createServerAiDisabledStatus()
  }

  const status = await getOllamaStatus()
  return NextResponse.json(status)
}
