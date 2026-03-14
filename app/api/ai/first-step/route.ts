import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { buildTemplateFirstStep, taskSchema } from "@/lib/focus"
import { ollamaGenerate } from "@/lib/ollama"

const requestSchema = z.object({
  model: z.string().min(1),
  task: taskSchema,
})

const responseSchema = z.object({
  smallest: z.string(),
  tenMinute: z.string(),
  lowEnergy: z.string(),
  deepWork: z.string(),
})

export async function POST(request: NextRequest) {
  const parsed = requestSchema.safeParse(await request.json())

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid first-step request." }, { status: 400 })
  }

  const prompt = `
You are helping with task initiation for ADHD.

Do not rewrite the original task title.
Instead, suggest four ways to start it:
- smallest
- tenMinute
- lowEnergy
- deepWork

Original task:
${parsed.data.task.title}
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
      suggestions: {
        smallest: buildTemplateFirstStep(parsed.data.task.title),
        tenMinute: `Spend 10 minutes making a rough start on: ${parsed.data.task.title}`,
        lowEnergy: `Do the easiest low-energy part of: ${parsed.data.task.title}`,
        deepWork: `Block 30 focused minutes for: ${parsed.data.task.title}`,
      },
    })
  }

  return NextResponse.json({ usedAi: true, suggestions: validated.data })
}
