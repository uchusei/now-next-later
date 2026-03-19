import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { detectAvoidanceFallback, tasksSchema } from "@/lib/focus"
import { ollamaGenerate } from "@/lib/ollama"
import { createServerAiDisabledResponse, isServerAiRouteEnabled } from "@/lib/server-ai"

const requestSchema = z.object({
  model: z.string().min(1),
  tasks: tasksSchema,
})

const responseSchema = z.object({
  insights: z.array(
    z.object({
      taskId: z.string(),
      taskTitle: z.string(),
      diagnosis: z.string(),
      suggestions: z.array(z.string()).max(4),
    })
  ),
})

export async function POST(request: NextRequest) {
  if (!isServerAiRouteEnabled()) {
    return createServerAiDisabledResponse()
  }

  const parsed = requestSchema.safeParse(await request.json())

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid avoidance request." }, { status: 400 })
  }

  const taskLines = parsed.data.tasks
    .filter((task) => task.completedAt === null && task.deferCount > 0)
    .map(
      (task) =>
        `- id=${task.id}; title=${task.title}; deferCount=${task.deferCount}; due=${task.dueBucket}; effort=${task.effort}; energy=${task.energy}; context=${task.context}`
    )
    .join("\n")

  const prompt = `
Analyze these repeatedly deferred tasks for an ADHD-friendly focus app.

For each task, suggest whether it seems:
- unclear
- too big
- blocked
- not actually important

Then suggest a few next moves like split, defer, delete, delegate, or schedule.

Tasks:
${taskLines}
`.trim()

  const aiResponse = await ollamaGenerate<z.infer<typeof responseSchema>>({
    model: parsed.data.model,
    prompt,
    schema: z.toJSONSchema(responseSchema),
  })

  const validated = responseSchema.safeParse(aiResponse)

  if (!validated.success) {
    return NextResponse.json({
      usedAi: false,
      insights: detectAvoidanceFallback(parsed.data.tasks),
    })
  }

  return NextResponse.json({ usedAi: true, insights: validated.data.insights })
}
