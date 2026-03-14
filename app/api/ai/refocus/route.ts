import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  buildFallbackAiPlan,
  focusPresetSchema,
  tasksSchema,
} from "@/lib/focus"
import { ollamaGenerate } from "@/lib/ollama"

const requestSchema = z.object({
  model: z.string().min(1),
  prompt: z.string().min(1),
  preset: focusPresetSchema,
  tasks: tasksSchema,
})

const responseSchema = z.object({
  summary: z.string(),
  nowIds: z.array(z.string()).max(1),
  nextIds: z.array(z.string()).max(2),
  notNowIds: z.array(z.string()),
  reasons: z.record(z.string(), z.string()),
})

export async function POST(request: NextRequest) {
  const parsed = requestSchema.safeParse(await request.json())

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid refocus request." }, { status: 400 })
  }

  const taskLines = parsed.data.tasks
    .filter((task) => task.completedAt === null)
    .map(
      (task) =>
        `- id=${task.id}; title=${task.title}; due=${task.dueBucket}; effort=${task.effort}; energy=${task.energy}; context=${task.context}; deferCount=${task.deferCount}; suggestedFirstStep=${task.suggestedFirstStep ?? "none"}`
    )
    .join("\n")

  const prompt = `
You are an ADHD-friendly focus assistant. Do not rewrite task titles.

Use the user's focus situation to choose:
- 1 task for now
- up to 2 tasks for next
- put the rest in notNow

Keep the reasoning brief, calm, and practical.

User situation:
${parsed.data.prompt}

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
      plan: buildFallbackAiPlan(parsed.data.tasks, parsed.data.preset, parsed.data.prompt),
    })
  }

  return NextResponse.json({ usedAi: true, plan: validated.data })
}
