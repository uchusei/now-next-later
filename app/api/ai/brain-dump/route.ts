import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  createTask,
  parseBrainDumpFallback,
  tasksSchema,
  dueBucketSchema,
  effortSchema,
  energyLevelSchema,
  contextTagSchema,
} from "@/lib/focus"
import { ollamaGenerate } from "@/lib/ollama"
import { createServerAiDisabledResponse, isServerAiRouteEnabled } from "@/lib/server-ai"

const requestSchema = z.object({
  model: z.string().min(1),
  dump: z.string().min(1),
})

const responseSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string(),
      dueBucket: dueBucketSchema,
      effort: effortSchema,
      energy: energyLevelSchema,
      context: contextTagSchema,
      suggestedFirstStep: z.string(),
    })
  ),
})

export async function POST(request: NextRequest) {
  if (!isServerAiRouteEnabled()) {
    return createServerAiDisabledResponse()
  }

  const parsed = requestSchema.safeParse(await request.json())

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid brain-dump request." }, { status: 400 })
  }

  const prompt = `
You are helping organize an ADHD-friendly task inbox.

Rules:
- Do not rewrite the user's meaning.
- Split messy notes into separate tasks when needed.
- Keep task titles short and very close to the user's wording.
- Add metadata only.
- Provide one gentle first step for each task.

Return JSON with:
- tasks: array of { title, dueBucket, effort, energy, context, suggestedFirstStep }

Allowed values:
- dueBucket: today | soon | someday
- effort: quick | medium | deep
- energy: low | medium | high
- context: anywhere | computer | home | errands | calls

User dump:
${parsed.data.dump}
`.trim()

  const aiResponse = await ollamaGenerate<z.infer<typeof responseSchema>>({
    model: parsed.data.model,
    prompt,
    schema: z.toJSONSchema(responseSchema),
  })

  if (!aiResponse) {
    return NextResponse.json({
      usedAi: false,
      tasks: parseBrainDumpFallback(parsed.data.dump),
    })
  }

  const validated = responseSchema.safeParse(aiResponse)

  if (!validated.success) {
    return NextResponse.json({
      usedAi: false,
      tasks: parseBrainDumpFallback(parsed.data.dump),
    })
  }

  const tasks = validated.data.tasks.map((task) =>
    createTask(task.title, {
      dueBucket: task.dueBucket,
      effort: task.effort,
      energy: task.energy,
      context: task.context,
      suggestedFirstStep: task.suggestedFirstStep,
    })
  )

  const safeTasks = tasksSchema.parse(tasks)
  return NextResponse.json({ usedAi: true, tasks: safeTasks })
}
