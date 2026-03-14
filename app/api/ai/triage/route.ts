import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { buildMorningTriagePlan, tasksSchema } from "@/lib/focus"
import { ollamaGenerate } from "@/lib/ollama"

const requestSchema = z.object({
  model: z.string().min(1),
  tasks: tasksSchema,
})

const responseSchema = z.object({
  summary: z.string(),
  nowIds: z.array(z.string()).max(1),
  nextIds: z.array(z.string()).max(2),
  notNowIds: z.array(z.string()).max(3),
  reasons: z.record(z.string(), z.string()),
})

export async function POST(request: NextRequest) {
  const parsed = requestSchema.safeParse(await request.json())

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid triage request." }, { status: 400 })
  }

  const taskLines = parsed.data.tasks
    .filter((task) => task.completedAt === null)
    .map(
      (task) =>
        `- id=${task.id}; title=${task.title}; due=${task.dueBucket}; effort=${task.effort}; energy=${task.energy}; context=${task.context}; deferCount=${task.deferCount}`
    )
    .join("\n")

  const prompt = `
Create a morning triage for an ADHD-friendly focus app.

Choose:
- 1 main focus
- 2 backup tasks
- 3 things to ignore today if needed

Return JSON only.

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
      plan: buildMorningTriagePlan(parsed.data.tasks),
    })
  }

  return NextResponse.json({ usedAi: true, plan: validated.data })
}
