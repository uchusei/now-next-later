import { z } from "zod"

export const dueBucketSchema = z.enum(["today", "soon", "someday"])
export const effortSchema = z.enum(["quick", "medium", "deep"])
export const energyLevelSchema = z.enum(["low", "medium", "high"])
export const contextTagSchema = z.enum(["anywhere", "computer", "home", "errands", "calls"])
export const focusModeSchema = z.enum(["auto", "pinned", "snoozed"])
export const focusPresetSchema = z.enum([
  "balanced",
  "quickWins",
  "lowEnergy",
  "fifteenMin",
  "deepWork",
])
export const laneStatusSchema = z.enum(["now", "next", "notNow"])

export type DueBucket = z.infer<typeof dueBucketSchema>
export type Effort = z.infer<typeof effortSchema>
export type EnergyLevel = z.infer<typeof energyLevelSchema>
export type ContextTag = z.infer<typeof contextTagSchema>
export type FocusMode = z.infer<typeof focusModeSchema>
export type FocusPreset = z.infer<typeof focusPresetSchema>
export type LaneStatus = z.infer<typeof laneStatusSchema>

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.number(),
  dueBucket: dueBucketSchema,
  effort: effortSchema,
  energy: energyLevelSchema,
  context: contextTagSchema,
  focusMode: focusModeSchema,
  deferCount: z.number(),
  completedAt: z.number().nullable(),
  suggestedFirstStep: z.string().nullable(),
})

export const tasksSchema = z.array(taskSchema)

export type Task = z.infer<typeof taskSchema>

export interface RankedTask extends Task {
  score: number
  reason: string
  lane: LaneStatus
}

export interface AiPlan {
  summary: string
  nowIds: string[]
  nextIds: string[]
  notNowIds: string[]
  reasons: Record<string, string>
}

const morningAnchorScore = (task: Task) => {
  const dueBoost = task.dueBucket === "today" ? 55 : task.dueBucket === "soon" ? 28 : 8
  const effortBoost = task.effort === "quick" ? 24 : task.effort === "medium" ? 18 : -10
  const energyBoost = task.energy === "low" ? 18 : task.energy === "medium" ? 12 : -8
  const contextBoost =
    task.context === "anywhere" ? 16 : task.context === "computer" ? 12 : task.context === "home" ? 10 : 4
  const avoidanceBoost = task.deferCount > 0 ? 10 : 0

  return dueBoost + effortBoost + energyBoost + contextBoost + avoidanceBoost
}

const morningBackupScore = (task: Task) => {
  const dueBoost = task.dueBucket === "today" ? 42 : task.dueBucket === "soon" ? 24 : 8
  const effortBoost = task.effort === "medium" ? 18 : task.effort === "quick" ? 15 : -4
  const energyBoost = task.energy === "medium" ? 16 : task.energy === "low" ? 10 : 0
  return dueBoost + effortBoost + energyBoost + task.deferCount * 6
}

const morningIgnoreScore = (task: Task) => {
  const somedayBoost = task.dueBucket === "someday" ? 30 : 0
  const deepBoost = task.effort === "deep" ? 24 : 0
  const highEnergyBoost = task.energy === "high" ? 20 : 0
  const snoozeBoost = task.focusMode === "snoozed" ? 40 : 0
  return somedayBoost + deepBoost + highEnergyBoost + snoozeBoost
}

const buildMorningAnchorReason = (task: Task) => {
  if (task.dueBucket === "today" && task.effort === "quick") {
    return "A timely task that is light enough to start without a lot of friction."
  }

  if (task.dueBucket === "today") {
    return "Time-sensitive enough to anchor the day before other tasks get louder."
  }

  if (task.effort === "quick" || task.energy === "low") {
    return "A realistic starting point that should lower resistance early in the day."
  }

  return "A solid anchor task that gives the day structure without asking too much at once."
}

const buildMorningBackupReason = (task: Task) => {
  if (task.dueBucket === "today") {
    return "Worth keeping close in case the main focus is done sooner than expected."
  }

  if (task.deferCount > 0) {
    return "This has been postponed before, so it stays visible as a backup."
  }

  return "A reasonable follow-up if you want one more meaningful step today."
}

const buildMorningIgnoreReason = (task: Task) => {
  if (task.focusMode === "snoozed") {
    return "Already pushed out of focus, so it stays off today's mental stage."
  }

  if (task.dueBucket === "someday" && task.effort === "deep") {
    return "Important maybe, but too heavy and too unspecific for today's focus window."
  }

  if (task.energy === "high") {
    return "Likely to demand more energy than a calm morning plan should assume."
  }

  return "Safe to ignore for today so it stops competing for attention."
}

const dueScores: Record<FocusPreset, Record<DueBucket, number>> = {
  balanced: { today: 90, soon: 55, someday: 20 },
  quickWins: { today: 88, soon: 50, someday: 18 },
  lowEnergy: { today: 85, soon: 52, someday: 18 },
  fifteenMin: { today: 90, soon: 48, someday: 15 },
  deepWork: { today: 82, soon: 58, someday: 22 },
}

const effortScores: Record<FocusPreset, Record<Effort, number>> = {
  balanced: { quick: 18, medium: 14, deep: 10 },
  quickWins: { quick: 30, medium: 10, deep: 0 },
  lowEnergy: { quick: 24, medium: 10, deep: 2 },
  fifteenMin: { quick: 34, medium: 6, deep: -10 },
  deepWork: { quick: 4, medium: 16, deep: 30 },
}

const energyScores: Record<FocusPreset, Record<EnergyLevel, number>> = {
  balanced: { low: 10, medium: 12, high: 10 },
  quickWins: { low: 12, medium: 10, high: 4 },
  lowEnergy: { low: 30, medium: 8, high: -8 },
  fifteenMin: { low: 14, medium: 9, high: 2 },
  deepWork: { low: -4, medium: 10, high: 22 },
}

const contextScores: Record<FocusPreset, Record<ContextTag, number>> = {
  balanced: { anywhere: 12, computer: 10, home: 8, errands: 6, calls: 8 },
  quickWins: { anywhere: 14, computer: 8, home: 8, errands: 10, calls: 12 },
  lowEnergy: { anywhere: 12, computer: 9, home: 12, errands: 3, calls: 8 },
  fifteenMin: { anywhere: 16, computer: 10, home: 8, errands: 2, calls: 12 },
  deepWork: { anywhere: 8, computer: 16, home: 10, errands: -8, calls: -6 },
}

export const presetMeta: Record<FocusPreset, { label: string; description: string }> = {
  balanced: {
    label: "Pick for me",
    description: "A balanced recommendation using urgency, effort, energy, and avoidance.",
  },
  quickWins: {
    label: "Quick wins",
    description: "Surface small tasks that are easy to start and finish.",
  },
  lowEnergy: {
    label: "Low energy",
    description: "Choose tasks that still count when your brain feels tired.",
  },
  fifteenMin: {
    label: "15 minutes",
    description: "Favor tasks that fit into a short burst of attention.",
  },
  deepWork: {
    label: "Deep work",
    description: "Favor tasks that need more concentration and momentum.",
  },
}

export const createTask = (
  title: string,
  fields?: Partial<
    Pick<
      Task,
      | "dueBucket"
      | "effort"
      | "energy"
      | "context"
      | "focusMode"
      | "deferCount"
      | "completedAt"
      | "suggestedFirstStep"
    >
  >
): Task => ({
  id: crypto.randomUUID(),
  title,
  createdAt: Date.now(),
  dueBucket: fields?.dueBucket ?? "soon",
  effort: fields?.effort ?? "medium",
  energy: fields?.energy ?? "medium",
  context: fields?.context ?? "anywhere",
  focusMode: fields?.focusMode ?? "auto",
  deferCount: fields?.deferCount ?? 0,
  completedAt: fields?.completedAt ?? null,
  suggestedFirstStep: fields?.suggestedFirstStep ?? null,
})

export const inferDueBucket = (line: string): DueBucket => {
  const normalized = line.toLowerCase()

  if (/(today|asap|urgent|tonight|right away)/.test(normalized)) {
    return "today"
  }

  if (/(tomorrow|this week|soon|upcoming|later this week)/.test(normalized)) {
    return "soon"
  }

  return "someday"
}

export const inferEffort = (line: string): Effort => {
  const normalized = line.toLowerCase()

  if (/(reply|email|call|pay|book|send|text|order|buy)/.test(normalized)) {
    return "quick"
  }

  if (/(plan|write|design|build|research|study|organize|prepare)/.test(normalized)) {
    return "deep"
  }

  return "medium"
}

export const inferEnergy = (line: string): EnergyLevel => {
  const normalized = line.toLowerCase()

  if (/(reply|email|call|pay|laundry|dishes|tidy|book|order)/.test(normalized)) {
    return "low"
  }

  if (/(write|design|code|study|research|presentation|plan)/.test(normalized)) {
    return "high"
  }

  return "medium"
}

export const inferContext = (line: string): ContextTag => {
  const normalized = line.toLowerCase()

  if (/(call|phone|ring)/.test(normalized)) {
    return "calls"
  }

  if (/(buy|pick up|store|post office|pharmacy|errand)/.test(normalized)) {
    return "errands"
  }

  if (/(clean|laundry|kitchen|home)/.test(normalized)) {
    return "home"
  }

  if (/(email|spreadsheet|deck|code|computer|website|document)/.test(normalized)) {
    return "computer"
  }

  return "anywhere"
}

export const buildTemplateFirstStep = (title: string) => {
  const cleaned = title.trim()
  return `Open a note and write the smallest possible first action for: ${cleaned}`
}

export const parseBrainDumpFallback = (dump: string) =>
  dump
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.replace(/^[-*[\]0-9.\s]+/, "").trim())
    .flatMap((line) => line.split(","))
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      createTask(line, {
        dueBucket: inferDueBucket(line),
        effort: inferEffort(line),
        energy: inferEnergy(line),
        context: inferContext(line),
        suggestedFirstStep: buildTemplateFirstStep(line),
      })
    )

const ageScore = (createdAt: number) => {
  const hoursOld = Math.floor((Date.now() - createdAt) / (1000 * 60 * 60))
  return Math.min(18, Math.max(0, Math.floor(hoursOld / 12)))
}

export const buildReason = (task: Task, preset: FocusPreset) => {
  if (task.focusMode === "pinned") {
    return "You pinned this, so it overrides the automatic ranking."
  }

  if (task.focusMode === "snoozed") {
    return "You snoozed this earlier, so it stays quieter until it needs to come back."
  }

  if (preset === "quickWins" && task.effort === "quick") {
    return "This is fast to finish, so it is useful for building momentum."
  }

  if (preset === "lowEnergy" && task.energy === "low") {
    return "This should be doable even on a lower-energy brain day."
  }

  if (preset === "fifteenMin" && task.effort === "quick") {
    return "This fits a shorter attention window."
  }

  if (preset === "deepWork" && task.effort === "deep") {
    return "This deserves a more concentrated work block."
  }

  if (task.dueBucket === "today") {
    return "It looks time-sensitive, so it should stay near the front."
  }

  if (task.deferCount > 0) {
    return "You have postponed this before, so the app is surfacing it again."
  }

  return "It is one of the strongest current candidates from your inbox."
}

export const rankTasks = (tasks: Task[], preset: FocusPreset): RankedTask[] => {
  const activeTasks = tasks.filter((task) => task.completedAt === null)

  const ranked = activeTasks
    .map((task) => {
      const score =
        dueScores[preset][task.dueBucket] +
        effortScores[preset][task.effort] +
        energyScores[preset][task.energy] +
        contextScores[preset][task.context] +
        ageScore(task.createdAt) +
        task.deferCount * 8 +
        (task.focusMode === "pinned" ? 1000 : 0) -
        (task.focusMode === "snoozed" ? 1000 : 0)

      return {
        ...task,
        score,
        reason: buildReason(task, preset),
        lane: "notNow" as const,
      }
    })
    .sort((left, right) => right.score - left.score || left.createdAt - right.createdAt)

  const activeNonSnoozedCount = activeTasks.filter((task) => task.focusMode !== "snoozed").length

  return ranked.map((task, index) => {
    if (task.focusMode === "snoozed" && index >= activeNonSnoozedCount) {
      if (index === 0) {
        return { ...task, lane: "now" as const }
      }

      if (index <= 2) {
        return { ...task, lane: "next" as const }
      }

      return { ...task, lane: "notNow" as const }
    }

    if (task.focusMode === "snoozed") {
      return { ...task, lane: "notNow" as const }
    }

    if (index === 0) {
      return { ...task, lane: "now" as const }
    }

    if (index <= 2) {
      return { ...task, lane: "next" as const }
    }

    return { ...task, lane: "notNow" as const }
  })
}

export const applyAiPlan = (tasks: Task[], preset: FocusPreset, plan: AiPlan | null): RankedTask[] => {
  const locallyRanked = rankTasks(tasks, preset)

  if (!plan) {
    return locallyRanked
  }

  const order = [...plan.nowIds, ...plan.nextIds, ...plan.notNowIds]
  const orderMap = new Map(order.map((id, index) => [id, index]))

  return locallyRanked
    .map((task) => {
      if (plan.nowIds.includes(task.id)) {
        return { ...task, lane: "now" as const, reason: plan.reasons[task.id] ?? task.reason }
      }

      if (plan.nextIds.includes(task.id)) {
        return { ...task, lane: "next" as const, reason: plan.reasons[task.id] ?? task.reason }
      }

      if (plan.notNowIds.includes(task.id)) {
        return { ...task, lane: "notNow" as const, reason: plan.reasons[task.id] ?? task.reason }
      }

      return task
    })
    .sort((left, right) => {
      const leftIndex = orderMap.get(left.id)
      const rightIndex = orderMap.get(right.id)

      if (leftIndex !== undefined && rightIndex !== undefined) {
        return leftIndex - rightIndex
      }

      if (leftIndex !== undefined) {
        return -1
      }

      if (rightIndex !== undefined) {
        return 1
      }

      return right.score - left.score
    })
}

export const buildFallbackAiPlan = (tasks: Task[], preset: FocusPreset, prompt?: string): AiPlan => {
  const ranked = rankTasks(tasks, preset)
  const summary = prompt
    ? `Used your prompt "${prompt}" as a local fallback and combined it with task signals.`
    : "Using the built-in focus logic because local AI is not available."

  return {
    summary,
    nowIds: ranked.filter((task) => task.lane === "now").map((task) => task.id),
    nextIds: ranked.filter((task) => task.lane === "next").map((task) => task.id),
    notNowIds: ranked.filter((task) => task.lane === "notNow").map((task) => task.id),
    reasons: Object.fromEntries(ranked.map((task) => [task.id, task.reason])),
  }
}

export const buildMorningTriagePlan = (tasks: Task[]): AiPlan => {
  const activeTasks = tasks.filter((task) => task.completedAt === null)

  if (activeTasks.length === 0) {
    return {
      summary: "No active tasks yet, so there is nothing to triage this morning.",
      nowIds: [],
      nextIds: [],
      notNowIds: [],
      reasons: {},
    }
  }

  const anchor = [...activeTasks]
    .filter((task) => task.focusMode !== "snoozed")
    .sort((left, right) => morningAnchorScore(right) - morningAnchorScore(left) || left.createdAt - right.createdAt)[0]

  const remaining = activeTasks.filter((task) => task.id !== anchor?.id)

  const next = [...remaining]
    .filter((task) => task.focusMode !== "snoozed")
    .sort((left, right) => morningBackupScore(right) - morningBackupScore(left) || left.createdAt - right.createdAt)
    .slice(0, 2)

  const nextIds = new Set(next.map((task) => task.id))
  const ignored = [...remaining]
    .filter((task) => !nextIds.has(task.id))
    .sort((left, right) => morningIgnoreScore(right) - morningIgnoreScore(left) || left.createdAt - right.createdAt)
    .slice(0, Math.min(3, Math.max(0, remaining.length - next.length)))

  const ignoredIds = new Set(ignored.map((task) => task.id))
  const leftover = remaining.filter((task) => !nextIds.has(task.id) && !ignoredIds.has(task.id))
  const orderedNotNow = [...ignored, ...leftover]

  const reasons: Record<string, string> = {}

  if (anchor) {
    reasons[anchor.id] = buildMorningAnchorReason(anchor)
  }

  for (const task of next) {
    reasons[task.id] = buildMorningBackupReason(task)
  }

  for (const task of orderedNotNow) {
    reasons[task.id] = buildMorningIgnoreReason(task)
  }

  return {
    summary:
      "Morning triage chose one realistic anchor, two backups, and a few tasks to intentionally ignore today.",
    nowIds: anchor ? [anchor.id] : [],
    nextIds: next.map((task) => task.id),
    notNowIds: orderedNotNow.map((task) => task.id),
    reasons,
  }
}

export const detectAvoidanceFallback = (tasks: Task[]) =>
  tasks
    .filter((task) => task.completedAt === null && task.deferCount >= 2)
    .map((task) => ({
      taskId: task.id,
      taskTitle: task.title,
      diagnosis:
        task.deferCount >= 4
          ? "This has been snoozed a lot and may be too unclear, too heavy, or not worth carrying right now."
          : "This keeps getting pushed away, which often means it is either too big or badly timed.",
      suggestions: ["Start now", "Done", "Delete"],
    }))
