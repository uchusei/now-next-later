import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { clearOllamaLogs, deleteAllLocalModels } from "@/lib/ollama"
import { createServerAiDisabledResponse, isServerAiRouteEnabled } from "@/lib/server-ai"

const requestSchema = z.object({
  action: z.enum(["deleteAllLocalModels", "clearLogs"]),
})

export async function POST(request: NextRequest) {
  if (!isServerAiRouteEnabled()) {
    return createServerAiDisabledResponse()
  }

  const parsed = requestSchema.safeParse(await request.json())

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid storage action." }, { status: 400 })
  }

  if (parsed.data.action === "deleteAllLocalModels") {
    const ok = await deleteAllLocalModels()

    if (!ok) {
      return NextResponse.json({ error: "Could not delete local models." }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  }

  const ok = await clearOllamaLogs()

  if (!ok) {
    return NextResponse.json({ error: "Could not clear Ollama logs." }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
