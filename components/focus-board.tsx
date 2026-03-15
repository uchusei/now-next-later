"use client"

import { startTransition, useCallback, useEffect, useRef, useState } from "react"
import {
  Plus,
  Brain,
  Download,
  FileDown,
  Info,
  ListTodo,
  LoaderCircle,
  Sparkles,
  SlidersHorizontal,
  TriangleAlert,
  WandSparkles,
} from "lucide-react"
import { z } from "zod"
import TaskColumn from "@/components/task-column"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  applyAiPlan,
  buildFallbackAiPlan,
  buildMorningTriagePlan,
  contextTagSchema,
  createTask,
  dueBucketSchema,
  detectAvoidanceFallback,
  effortSchema,
  energyLevelSchema,
  parseBrainDumpFallback,
  focusPresetSchema,
  presetMeta,
  tasksSchema,
  type AiPlan,
  type DueBucket,
  type FocusPreset,
  type Task,
} from "@/lib/focus"
import { useCopy } from "@/components/language-provider"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "now-next-later.smart-focus"
const AI_ENABLED_KEY = "now-next-later.ai-enabled"
const AI_MODEL_KEY = "now-next-later.ai-model"
const BROWSER_OLLAMA_URL = "http://127.0.0.1:11434"

const draftSchema = z.string().trim().min(1, "Write something").max(100, "Max 100 characters")

const statusSchema = z.object({
  reachable: z.boolean(),
  installed: z.boolean(),
  selectedModel: z.string().nullable(),
  modelPath: z.string(),
  storageExists: z.boolean(),
  storageBytes: z.number(),
  storageLabel: z.string(),
  localModelCount: z.number(),
  models: z.array(
    z.object({
      name: z.string(),
      size: z.number(),
      sizeLabel: z.string(),
      modifiedAt: z.string().nullable(),
      kind: z.enum(["local", "cloud"]),
    })
  ),
  runningModels: z.array(z.string()),
})

const aiPlanSchema = z.object({
  summary: z.string(),
  nowIds: z.array(z.string()),
  nextIds: z.array(z.string()),
  notNowIds: z.array(z.string()),
  reasons: z.record(z.string(), z.string()),
})

const avoidanceSchema = z.array(
  z.object({
    taskId: z.string(),
    taskTitle: z.string(),
    diagnosis: z.string(),
    suggestions: z.array(z.string()),
  })
)

type AiStatus = z.infer<typeof statusSchema>
type AvoidanceInsight = z.infer<typeof avoidanceSchema>[number]

const browserBrainDumpSchema = z.object({
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

const browserTagsSchema = z.object({
  models: z
    .array(
      z.object({
        name: z.string(),
        size: z.number().optional(),
        modified_at: z.string().optional(),
      })
    )
    .optional(),
})

const browserPsSchema = z.object({
  models: z.array(z.object({ name: z.string() })).optional(),
})

interface BrowserConnectHelp {
  title: string
  body: string
  command: string
  followUp: string
}

const defaultAiStatus: AiStatus = {
  reachable: false,
  installed: false,
  selectedModel: null,
  modelPath: "~/.ollama/models",
  storageExists: false,
  storageBytes: 0,
  storageLabel: "0 B",
  localModelCount: 0,
  models: [],
  runningModels: [],
}

const localStarterModels = [
  { name: "llama3.2:3b", badge: "Lighter" },
  { name: "gemma3:4b", badge: "Stronger" },
  { name: "qwen3:4b", badge: "Stronger" },
  { name: "qwen2.5:3b", badge: "Lighter" },
  { name: "phi4-mini", badge: "Lighter" },
] as const

const preferredCloudModels = [
  "glm-4.7:cloud",
  "minimax-m2.1:cloud",
  "qwen3.5:cloud",
  "gpt-oss:120b-cloud",
] as const

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? "Request failed.")
  }

  return data as T
}

async function requestBrowserOllamaJson<T>(pathname: string, init?: RequestInit) {
  const response = await fetch(`${BROWSER_OLLAMA_URL}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("Could not reach Ollama on this device.")
  }

  return (await response.json()) as T
}

function buildBrowserConnectHelp(origin: string): BrowserConnectHelp {
  return {
    title: "This site is blocked from reaching your local Ollama.",
    body:
      "Your browser can see this website, but Ollama has not allowed this website to talk to the local Ollama app yet.",
    command: `launchctl setenv OLLAMA_ORIGINS "http://localhost:3000,http://127.0.0.1:3000,${origin}"`,
    followUp:
      "Copy the command below, run it in the Terminal app, fully quit Ollama, open Ollama again, then press Try again.",
  }
}

export default function FocusBoard() {
  const t = useCopy()
  const [tasks, setTasks] = useState<Task[]>([])
  const [draft, setDraft] = useState("")
  const [bulkDraft, setBulkDraft] = useState("")
  const [focusPrompt, setFocusPrompt] = useState("")
  const [preset, setPreset] = useState<FocusPreset>("balanced")
  const [quickDueBucket, setQuickDueBucket] = useState<DueBucket>("soon")
  const [error, setError] = useState("")
  const [actionMessage, setActionMessage] = useState("")
  const [aiEnabled, setAiEnabled] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [aiStatus, setAiStatus] = useState<AiStatus>(defaultAiStatus)
  const [aiPlan, setAiPlan] = useState<AiPlan | null>(null)
  const [avoidanceInsights, setAvoidanceInsights] = useState<AvoidanceInsight[]>([])
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false)
  const [isRunningAi, setIsRunningAi] = useState(false)
  const [isCleaningStorage, setIsCleaningStorage] = useState(false)
  const [showStorageInstructions, setShowStorageInstructions] = useState(false)
  const [copiedAction, setCopiedAction] = useState<"signin" | "model" | "fix" | null>(null)
  const [aiModelTab, setAiModelTab] = useState<"local" | "cloud">("local")
  const [localInstallModel, setLocalInstallModel] = useState("llama3.2:3b")
  const [isHydrated, setIsHydrated] = useState(false)
  const [showBrainDump, setShowBrainDump] = useState(false)
  const [showRefocus, setShowRefocus] = useState(false)
  const [showNotNow, setShowNotNow] = useState(false)
  const [showAvoidance, setShowAvoidance] = useState(false)
  const [showMomentum, setShowMomentum] = useState(false)
  const [showAiSettings, setShowAiSettings] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showCaptureMenu, setShowCaptureMenu] = useState(false)
  const [showFocusMenu, setShowFocusMenu] = useState(false)
  const [showNowFullscreen, setShowNowFullscreen] = useState(false)
  const [isHostedDeployment, setIsHostedDeployment] = useState(false)
  const [browserAiStatus, setBrowserAiStatus] = useState<AiStatus>(defaultAiStatus)
  const [browserOllamaConnected, setBrowserOllamaConnected] = useState(false)
  const [isConnectingBrowserOllama, setIsConnectingBrowserOllama] = useState(false)
  const [browserConnectHelp, setBrowserConnectHelp] = useState<BrowserConnectHelp | null>(null)
  const hasSavedRef = useRef(false)

  useEffect(() => {
    if (!showNowFullscreen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowNowFullscreen(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [showNowFullscreen])

  useEffect(() => {
    document.body.style.overflow = showNowFullscreen ? "hidden" : ""

    return () => {
      document.body.style.overflow = ""
    }
  }, [showNowFullscreen])

  useEffect(() => {
    startTransition(() => {
      try {
        const savedTasks = window.localStorage.getItem(STORAGE_KEY)
        const savedAiEnabled = window.localStorage.getItem(AI_ENABLED_KEY)
        const savedModel = window.localStorage.getItem(AI_MODEL_KEY)

        if (savedTasks) {
          const parsed = tasksSchema.safeParse(JSON.parse(savedTasks))

          if (parsed.success) {
            setTasks(parsed.data)
          }
        }

        if (savedAiEnabled !== null) {
          setAiEnabled(savedAiEnabled === "true")
        }

        if (savedModel) {
          setSelectedModel(savedModel)
        }
      } finally {
        setIsHydrated(true)
      }
    })
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const host = window.location.hostname
    setIsHostedDeployment(host !== "localhost" && host !== "127.0.0.1")
  }, [])

  useEffect(() => {
    if (!isHydrated) {
      return
    }

    window.localStorage.setItem(AI_ENABLED_KEY, String(aiEnabled))
  }, [aiEnabled, isHydrated])

  useEffect(() => {
    if (!isHydrated) {
      return
    }

    if (!selectedModel) {
      window.localStorage.removeItem(AI_MODEL_KEY)
      return
    }

    window.localStorage.setItem(AI_MODEL_KEY, selectedModel)
  }, [selectedModel, isHydrated])

  useEffect(() => {
    if (!hasSavedRef.current) {
      hasSavedRef.current = true
      return
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  const refreshAiStatus = useCallback(async () => {
    if (browserOllamaConnected) {
      try {
        const tags = browserTagsSchema.parse(await requestBrowserOllamaJson("/api/tags"))
        const running = browserPsSchema.parse(await requestBrowserOllamaJson("/api/ps"))
        const localModels = (tags.models ?? []).sort((left, right) => (left.size ?? 0) - (right.size ?? 0))
        const models = [
          ...localModels.map((model) => ({
            name: model.name,
            size: model.size ?? 0,
            sizeLabel: model.size ? `${(model.size / 1024 ** 3).toFixed(1)} GB` : "0 B",
            modifiedAt: model.modified_at ?? null,
            kind: "local" as const,
          })),
          ...preferredCloudModels.map((name) => ({
            name,
            size: 0,
            sizeLabel: "Cloud",
            modifiedAt: null,
            kind: "cloud" as const,
          })),
        ]

        const status: AiStatus = {
          reachable: true,
          installed: true,
          selectedModel:
            localModels.find((model) => localStarterModels.some((candidate) => candidate.name === model.name))?.name ??
            localModels[0]?.name ??
            null,
          modelPath: "Available through this browser connection",
          storageExists: false,
          storageBytes: 0,
          storageLabel: "Unavailable here",
          localModelCount: localModels.length,
          models,
          runningModels: (running.models ?? []).map((model) => model.name),
        }

        setBrowserAiStatus(status)

        if (!selectedModel || !status.models.some((model) => model.name === selectedModel)) {
          setSelectedModel(status.selectedModel)
        }
      } catch {
        setBrowserOllamaConnected(false)
        setBrowserAiStatus(defaultAiStatus)
      }

      return
    }

    setIsRefreshingStatus(true)

    try {
      const data = statusSchema.parse(await requestJson("/api/ai/status"))
      setAiStatus(data)

      if (!selectedModel || !data.models.some((model) => model.name === selectedModel)) {
        setSelectedModel(data.selectedModel)
      }
    } catch {
      setAiStatus(defaultAiStatus)
    } finally {
      setIsRefreshingStatus(false)
    }
  }, [browserOllamaConnected, selectedModel])

  useEffect(() => {
    void refreshAiStatus()
  }, [refreshAiStatus])

  const connectBrowserOllama = async () => {
    setIsConnectingBrowserOllama(true)
    setError("")
    setBrowserConnectHelp(null)

    try {
      const tags = browserTagsSchema.parse(await requestBrowserOllamaJson("/api/tags"))
      const running = browserPsSchema.parse(await requestBrowserOllamaJson("/api/ps"))
      const localModels = (tags.models ?? []).sort((left, right) => (left.size ?? 0) - (right.size ?? 0))
      const status: AiStatus = {
        reachable: true,
        installed: true,
        selectedModel:
          localModels.find((model) => localStarterModels.some((candidate) => candidate.name === model.name))?.name ??
          localModels[0]?.name ??
          null,
        modelPath: "Available through this browser connection",
        storageExists: false,
        storageBytes: 0,
        storageLabel: "Unavailable here",
        localModelCount: localModels.length,
        models: [
          ...localModels.map((model) => ({
            name: model.name,
            size: model.size ?? 0,
            sizeLabel: model.size ? `${(model.size / 1024 ** 3).toFixed(1)} GB` : "0 B",
            modifiedAt: model.modified_at ?? null,
            kind: "local" as const,
          })),
          ...preferredCloudModels.map((name) => ({
            name,
            size: 0,
            sizeLabel: "Cloud",
            modifiedAt: null,
            kind: "cloud" as const,
          })),
        ],
        runningModels: (running.models ?? []).map((model) => model.name),
      }

      setBrowserAiStatus(status)
      setBrowserOllamaConnected(true)
      setBrowserConnectHelp(null)
      if (!selectedModel) {
        setSelectedModel(status.selectedModel)
      }
      setActionMessage("Connected to local Ollama through this browser.")
    } catch {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "https://now-next-later.netlify.app"
      setBrowserConnectHelp(buildBrowserConnectHelp(origin))
      setError("Could not connect to local Ollama from this browser.")
    } finally {
      setIsConnectingBrowserOllama(false)
    }
  }

  const clearFocusOverlay = () => {
    setAiPlan(null)
    setActionMessage("")
  }

  useEffect(() => {
    setAvoidanceInsights((current) =>
      current.filter((insight) =>
        tasks.some((task) => task.id === insight.taskId && task.completedAt === null)
      )
    )
  }, [tasks])

  const rankedTasks = applyAiPlan(tasks, preset, aiPlan)
  const nowTasks = rankedTasks.filter((task) => task.lane === "now")
  const nextTasks = rankedTasks.filter((task) => task.lane === "next")
  const notNowTasks = rankedTasks.filter((task) => task.lane === "notNow")
  const completedTasks = [...tasks]
    .filter((task) => task.completedAt !== null)
    .sort((left, right) => (right.completedAt ?? 0) - (left.completedAt ?? 0))
  const effectiveAiStatus = browserOllamaConnected ? browserAiStatus : aiStatus
  const activeModel = aiEnabled ? selectedModel : null
  const selectedModelInfo = effectiveAiStatus.models.find((model) => model.name === selectedModel) ?? null
  const formatCompletedAt = (timestamp: number | null) => {
    if (!timestamp) {
      return ""
    }

    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(timestamp)
  }

  const freezeCurrentLayout = () => {
    setAiPlan({
      summary: "Manual edit preserved the current layout.",
      nowIds: nowTasks.map((task) => task.id),
      nextIds: nextTasks.map((task) => task.id),
      notNowIds: notNowTasks.map((task) => task.id),
      reasons: Object.fromEntries(rankedTasks.map((task) => [task.id, task.reason])),
    })
  }

  const addQuickTask = () => {
    const result = draftSchema.safeParse(draft)

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Could not save")
      return
    }

    setTasks((current) => [createTask(result.data, { dueBucket: quickDueBucket }), ...current])
    setDraft("")
    setQuickDueBucket("soon")
    setError("")
    clearFocusOverlay()
  }

  const importBrainDump = async () => {
    if (!bulkDraft.trim()) {
      setError("Paste at least one task to import.")
      return
    }

    setIsRunningAi(true)
    setError("")
    setActionMessage("")

    try {
      if (activeModel && effectiveAiStatus.reachable) {
        if (browserOllamaConnected) {
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
${bulkDraft}
`.trim()

          const aiResponse = browserBrainDumpSchema.parse(
            JSON.parse(
              (
                await requestBrowserOllamaJson<{ response?: string }>("/api/generate", {
                  method: "POST",
                  body: JSON.stringify({
                    model: activeModel,
                    prompt,
                    stream: false,
                    format: z.toJSONSchema(browserBrainDumpSchema),
                    options: { temperature: 0.2 },
                  }),
                })
              ).response ?? "{}"
            )
          )

          const aiTasks = tasksSchema.parse(
            aiResponse.tasks.map((task) =>
              createTask(task.title, {
                dueBucket: task.dueBucket,
                effort: task.effort,
                energy: task.energy,
                context: task.context,
                suggestedFirstStep: task.suggestedFirstStep,
              })
            )
          )

          setTasks((current) => [...aiTasks, ...current])
        } else {
        const result = await requestJson<{ usedAi: boolean; tasks: Task[] }>("/api/ai/brain-dump", {
          method: "POST",
          body: JSON.stringify({
            model: activeModel,
            dump: bulkDraft,
          }),
        })

        setTasks((current) => [...result.tasks, ...current])
        }
      } else {
        const fallbackTasks = parseBrainDumpFallback(bulkDraft)

        setTasks((current) => [...fallbackTasks, ...current])
      }

      setBulkDraft("")
      clearFocusOverlay()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import with AI.")
    } finally {
      setIsRunningAi(false)
    }
  }

  const runRefocus = async (mode: "refocus" | "triage") => {
    if (tasks.filter((task) => task.completedAt === null).length === 0) {
      setError("Add a few active tasks first.")
      return
    }

    setIsRunningAi(true)
    setError("")

    try {
      if (activeModel && effectiveAiStatus.reachable) {
        if (browserOllamaConnected) {
          const prompt =
            mode === "refocus"
              ? `
You are an ADHD-friendly focus assistant. Do not rewrite task titles.

Use the user's focus situation to choose:
- 1 task for now
- up to 2 tasks for next
- put the rest in notNow

Keep the reasoning brief, calm, and practical.

User situation:
${focusPrompt || "Help me choose what matters most right now."}

Tasks:
${tasks
  .filter((task) => task.completedAt === null)
  .map(
    (task) =>
      `- id=${task.id}; title=${task.title}; due=${task.dueBucket}; effort=${task.effort}; energy=${task.energy}; context=${task.context}; deferCount=${task.deferCount}; suggestedFirstStep=${task.suggestedFirstStep ?? "none"}`
  )
  .join("\n")}
`.trim()
              : `
Create a morning triage for an ADHD-friendly focus app.

Choose:
- 1 main focus
- 2 backup tasks
- 3 things to ignore today if needed

Return JSON only.

Tasks:
${tasks
  .filter((task) => task.completedAt === null)
  .map(
    (task) =>
      `- id=${task.id}; title=${task.title}; due=${task.dueBucket}; effort=${task.effort}; energy=${task.energy}; context=${task.context}; deferCount=${task.deferCount}`
  )
  .join("\n")}
`.trim()

          const aiResponse = await requestBrowserOllamaJson<{ response?: string }>("/api/generate", {
            method: "POST",
            body: JSON.stringify({
              model: activeModel,
              prompt,
              stream: false,
              format: z.toJSONSchema(aiPlanSchema),
              options: { temperature: 0.2 },
            }),
          })

          setAiPlan(aiPlanSchema.parse(JSON.parse(aiResponse.response ?? "{}")))
          setActionMessage(
            mode === "triage"
              ? "Morning triage updated your focus using local Ollama from this browser."
              : "Refocus updated your list using local Ollama from this browser."
          )
        } else {
        const endpoint = mode === "refocus" ? "/api/ai/refocus" : "/api/ai/triage"
        const payload =
          mode === "refocus"
            ? {
                model: activeModel,
                prompt: focusPrompt || "Help me choose what matters most right now.",
                preset,
                tasks,
              }
            : {
                model: activeModel,
                tasks,
              }

        const result = await requestJson<{ usedAi: boolean; plan: AiPlan }>(endpoint, {
          method: "POST",
          body: JSON.stringify(payload),
        })

        setAiPlan(aiPlanSchema.parse(result.plan))
        setActionMessage(
          mode === "triage"
            ? "Morning triage updated your focus using local AI."
            : "Refocus updated your list using local AI."
        )
        }
      } else {
        const fallbackPlan =
          mode === "triage"
            ? buildMorningTriagePlan(tasks)
            : buildFallbackAiPlan(tasks, preset, focusPrompt)

        setAiPlan(fallbackPlan)
        setActionMessage(
          mode === "triage"
            ? "Morning triage updated your focus using built-in logic."
            : "Refocus updated your list using built-in logic."
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refocus your list.")
    } finally {
      setIsRunningAi(false)
    }
  }

  const runAvoidanceCheck = async () => {
    setIsRunningAi(true)
    setError("")
    setActionMessage("")

    try {
      if (activeModel && effectiveAiStatus.reachable) {
        if (browserOllamaConnected) {
          const prompt = `
Analyze these repeatedly deferred tasks for an ADHD-friendly focus app.

For each task, suggest whether it seems:
- unclear
- too big
- blocked
- not actually important

Then suggest a few next moves like split, defer, delete, delegate, or schedule.

Tasks:
${tasks
  .filter((task) => task.completedAt === null && task.deferCount > 0)
  .map(
    (task) =>
      `- id=${task.id}; title=${task.title}; deferCount=${task.deferCount}; due=${task.dueBucket}; effort=${task.effort}; energy=${task.energy}; context=${task.context}`
  )
  .join("\n")}
`.trim()

          const aiResponse = await requestBrowserOllamaJson<{ response?: string }>("/api/generate", {
            method: "POST",
            body: JSON.stringify({
              model: activeModel,
              prompt,
              stream: false,
              format: z.toJSONSchema(z.object({ insights: avoidanceSchema })),
              options: { temperature: 0.2 },
            }),
          })

          const parsed = z.object({ insights: avoidanceSchema }).parse(JSON.parse(aiResponse.response ?? "{}"))
          setAvoidanceInsights(parsed.insights)
          setActionMessage("Avoidance check finished using local Ollama from this browser.")
        } else {
        const result = await requestJson<{ usedAi: boolean; insights: AvoidanceInsight[] }>(
          "/api/ai/avoidance",
          {
            method: "POST",
            body: JSON.stringify({
              model: activeModel,
              tasks,
            }),
          }
        )

        setAvoidanceInsights(avoidanceSchema.parse(result.insights))
        setActionMessage("Avoidance check finished using local AI.")
        }
      } else {
        setAvoidanceInsights(detectAvoidanceFallback(tasks))
        setActionMessage("Avoidance check finished using built-in logic.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not inspect avoidance patterns.")
    } finally {
      setIsRunningAi(false)
    }
  }

  const updateTask = (taskId: string, updater: (task: Task) => Task) => {
    clearFocusOverlay()
    setTasks((current) => current.map((task) => (task.id === taskId ? updater(task) : task)))
  }

  const handleComplete = (taskId: string) => {
    updateTask(taskId, (task) => ({ ...task, completedAt: Date.now(), focusMode: "auto" }))
  }

  const handleDelete = (taskId: string) => {
    clearFocusOverlay()
    setTasks((current) => current.filter((task) => task.id !== taskId))
  }

  const handleStartNow = (taskId: string) => {
    clearFocusOverlay()
    setTasks((current) =>
      current.map((task) => {
        if (task.id === taskId) {
          return { ...task, focusMode: "pinned" as const }
        }

        return task.focusMode === "pinned" ? { ...task, focusMode: "auto" as const } : task
      })
    )
  }

  const handleSnooze = (taskId: string) => {
    updateTask(taskId, (task) => ({
      ...task,
      focusMode: "snoozed",
      deferCount: task.deferCount + 1,
    }))
  }

  const handleUpdateTitle = (taskId: string, title: string) => {
    freezeCurrentLayout()
    updateTask(taskId, (task) => ({ ...task, title }))
  }

  const handleUpdateMeta = (
    taskId: string,
    field: "dueBucket" | "effort" | "energy" | "context",
    value: Task[typeof field]
  ) => {
    freezeCurrentLayout()
    updateTask(taskId, (task) => ({ ...task, [field]: value }))
  }

  const handleClearCompleted = () => {
    clearFocusOverlay()
    setTasks((current) => current.filter((task) => task.completedAt === null))
  }

  const copyCommand = async (value: string, type: "signin" | "model" | "fix") => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedAction(type)
      window.setTimeout(() => setCopiedAction(null), 2000)
    } catch {
      setError("Could not copy the Ollama command.")
    }
  }

  const runStorageAction = async (action: "deleteAllLocalModels" | "clearLogs") => {
    const confirmMessage =
      action === "deleteAllLocalModels"
        ? "Delete all downloaded local Ollama models from this device?"
        : "Clear Ollama log files from this device?"

    if (!window.confirm(confirmMessage)) {
      return
    }

    setIsCleaningStorage(true)

    try {
      await requestJson("/api/ai/storage", {
        method: "POST",
        body: JSON.stringify({ action }),
      })

      if (action === "deleteAllLocalModels" && selectedModelInfo?.kind === "local") {
        setSelectedModel(null)
      }

      await refreshAiStatus()
      setActionMessage(
        action === "deleteAllLocalModels"
          ? "Downloaded local models were removed."
          : "Ollama logs were cleared."
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete storage cleanup.")
    } finally {
      setIsCleaningStorage(false)
    }
  }

  const closeFloatingMenus = () => {
    setShowCaptureMenu(false)
    setShowFocusMenu(false)
  }

  const closeFloatingPanels = () => {
    closeFloatingMenus()
    setShowQuickAdd(false)
    setShowBrainDump(false)
    setShowRefocus(false)
    setShowAiSettings(false)
  }

  const openPanel = (panel: "quick" | "dump" | "refocus" | "ai") => {
    closeFloatingPanels()

    if (panel === "quick") setShowQuickAdd(true)
    if (panel === "dump") setShowBrainDump(true)
    if (panel === "refocus") setShowRefocus(true)
    if (panel === "ai") setShowAiSettings(true)
  }

  return (
    <div className="w-full max-w-6xl space-y-6 pb-28">
      <div
        className={cn(
          "space-y-6",
          showNowFullscreen && "hidden"
        )}
        aria-hidden={showNowFullscreen}
      >
        {(error || actionMessage) ? (
          <Card className="border border-border/80 bg-card/80 backdrop-blur">
            <CardContent className="pt-5">
              {error ? <p className="text-sm text-rose-500">{error}</p> : null}
              {actionMessage ? <p className="text-sm text-emerald-600">{actionMessage}</p> : null}
            </CardContent>
          </Card>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                {t.sections.inFocus}
              </p>
              <h3 className="text-lg font-semibold tracking-tight">{t.sections.inFocusTitle}</h3>
            </div>
            <Badge variant="secondary">{presetMeta[preset].label}</Badge>
          </div>
          <TaskColumn
            status="now"
            tasks={nowTasks}
            isFullscreen={false}
            onToggleFullscreen={() => setShowNowFullscreen((current) => !current)}
            onComplete={handleComplete}
            onDelete={handleDelete}
            onStartNow={handleStartNow}
            onSnooze={handleSnooze}
            onUpdateTitle={handleUpdateTitle}
            onUpdateMeta={handleUpdateMeta}
          />
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
              {t.sections.supportQueue}
            </p>
            <h3 className="text-lg font-semibold tracking-tight">{t.sections.supportQueueTitle}</h3>
          </div>
          <TaskColumn
            status="next"
            tasks={nextTasks}
            onComplete={handleComplete}
            onDelete={handleDelete}
            onStartNow={handleStartNow}
            onSnooze={handleSnooze}
            onUpdateTitle={handleUpdateTitle}
            onUpdateMeta={handleUpdateMeta}
          />
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowNotNow((current) => !current)}>
              {showNotNow ? t.toggles.hideNotNow : `${t.toggles.showNotNow} (${notNowTasks.length})`}
            </Button>
            <Button variant="outline" onClick={() => setShowAvoidance((current) => !current)}>
              {showAvoidance ? t.toggles.hideAvoidance : t.toggles.showAvoidance}
            </Button>
            <Button variant="outline" onClick={() => setShowMomentum((current) => !current)}>
              {showMomentum ? t.toggles.hideDoneList : `${t.toggles.showDoneList} (${completedTasks.length})`}
            </Button>
          </div>

          {showNotNow ? (
            <div className="motion-section space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  {t.sections.notNow}
                </p>
                <h3 className="text-lg font-semibold tracking-tight">{t.sections.notNowTitle}</h3>
              </div>
              <TaskColumn
                status="notNow"
                tasks={notNowTasks}
                onComplete={handleComplete}
                onDelete={handleDelete}
                onStartNow={handleStartNow}
                onSnooze={handleSnooze}
                onUpdateTitle={handleUpdateTitle}
                onUpdateMeta={handleUpdateMeta}
              />
            </div>
          ) : null}

          {showAvoidance ? (
            <div className="motion-section space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  {t.sections.avoidance}
                </p>
                <h3 className="text-lg font-semibold tracking-tight">{t.sections.avoidanceTitle}</h3>
              </div>
              <Card className="border border-border/80 bg-card/80 backdrop-blur">
                <CardContent className="pt-5">
                  {avoidanceInsights.length > 0 ? (
                    <ul className="space-y-3">
                      {avoidanceInsights.map((insight) => (
                        <li key={insight.taskId} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-sm font-medium">{insight.taskTitle}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{insight.diagnosis}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" onClick={() => handleStartNow(insight.taskId)}>
                              {t.focusBoard.startNow}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleComplete(insight.taskId)}>
                              {t.focusBoard.markDone}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDelete(insight.taskId)}>
                              {t.focusBoard.delete}
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border bg-muted/35 p-5">
                      <p className="text-sm font-medium">No avoidance pattern detected yet</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.focusBoard.noAvoidanceDesc}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {showMomentum ? (
            <div className="motion-section space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                    {t.sections.momentum}
                  </p>
                  <h3 className="text-lg font-semibold tracking-tight">{t.sections.doneList}</h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearCompleted}
                  disabled={completedTasks.length === 0}
                >
                  {t.toggles.clearDoneList}
                </Button>
              </div>
              <Card className="border border-border/80 bg-card/80 backdrop-blur">
                <CardContent className="pt-5">
                  {completedTasks.length > 0 ? (
                    <ul className="space-y-3">
                      {completedTasks.map((task) => (
                        <li
                          key={task.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{task.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {t.focusBoard.doneOn} {formatCompletedAt(task.completedAt)}
                            </p>
                          </div>
                          <Badge variant="outline">Done</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border bg-muted/35 p-5">
                      <p className="text-sm font-medium">No done tasks yet</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t.focusBoard.noDoneDesc}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </section>
      </div>

      {showNowFullscreen ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close focus mode"
            className="absolute inset-0 bg-background/96 backdrop-blur-[44px] dark:bg-background/92"
            onClick={() => setShowNowFullscreen(false)}
          />
          <div className="absolute inset-x-3 top-22 bottom-3 md:inset-x-6 md:top-24 md:bottom-6">
            <div className="relative mx-auto h-full w-full max-w-6xl">
              <div className="relative z-10 h-full">
                <TaskColumn
                  status="now"
                  tasks={nowTasks}
                  isFullscreen
                  onToggleFullscreen={() => setShowNowFullscreen(false)}
                  onComplete={handleComplete}
                  onDelete={handleDelete}
                  onStartNow={handleStartNow}
                  onSnooze={handleSnooze}
                  onUpdateTitle={handleUpdateTitle}
                  onUpdateMeta={handleUpdateMeta}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed right-6 bottom-6 z-50 flex flex-col items-end gap-3 md:right-10">
        {showCaptureMenu ? (
          <Card className="w-[18rem] border border-border/80 bg-card/95 shadow-2xl backdrop-blur">
            <CardContent className="space-y-2 pt-4">
              <Button className="w-full justify-start" variant="outline" onClick={() => openPanel("quick")}>
                <ListTodo />
                Quick add
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => openPanel("dump")}>
                <FileDown />
                Paste messy list
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {showFocusMenu ? (
          <Card className="w-[21rem] border border-border/80 bg-card/95 shadow-2xl backdrop-blur">
            <CardHeader className="border-b border-border/70">
              <CardTitle className="text-base">Focus tools</CardTitle>
              <CardDescription>Choose a recommendation mode or run a focus action.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Modes</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(presetMeta) as FocusPreset[]).map((value) => (
                    <Button
                      key={value}
                      size="sm"
                      variant={preset === value ? "secondary" : "outline"}
                      onClick={() => {
                        setPreset(focusPresetSchema.parse(value))
                        clearFocusOverlay()
                        setShowFocusMenu(false)
                      }}
                    >
                      {presetMeta[value].label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Actions</p>
                <div className="space-y-2">
                  <Button className="w-full justify-start" variant="outline" onClick={() => openPanel("refocus")}>
                    <WandSparkles />
                    Refocus
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => {
                    closeFloatingPanels()
                    void runRefocus("triage")
                  }}>
                    <Sparkles />
                    Morning triage
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => {
                    closeFloatingPanels()
                    setShowAvoidance(true)
                    void runAvoidanceCheck()
                  }}>
                    <TriangleAlert />
                    Avoidance check
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {showQuickAdd ? (
          <Card className="w-[22rem] border border-border/80 bg-card/95 shadow-2xl backdrop-blur">
            <CardHeader className="border-b border-border/70">
              <CardTitle className="text-base">Quick add</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <Input
                placeholder="Add a task, note, or reminder"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    addQuickTask()
                    closeFloatingPanels()
                  }
                }}
              />
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Due
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["today", "soon", "someday"] as DueBucket[]).map((value) => (
                    <Button
                      key={value}
                      size="sm"
                      variant={quickDueBucket === value ? "secondary" : "outline"}
                      onClick={() => setQuickDueBucket(dueBucketSchema.parse(value))}
                    >
                      {value === "today" ? "Today" : value === "soon" ? "Soon" : "Someday"}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeFloatingPanels}>Close</Button>
                <Button onClick={() => {
                  addQuickTask()
                  closeFloatingPanels()
                }}>
                  Add to inbox
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {showBrainDump ? (
          <Card className="w-[24rem] border border-border/80 bg-card/95 shadow-2xl backdrop-blur">
            <CardHeader className="border-b border-border/70">
              <CardTitle className="text-base">Paste messy list</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <textarea
                className="min-h-36 w-full rounded-xl border border-input bg-transparent px-3 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                placeholder={"email Anna, maybe book dentist, fix homepage, return package, call insurance"}
                value={bulkDraft}
                onChange={(event) => setBulkDraft(event.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeFloatingPanels}>Close</Button>
                <Button variant="secondary" onClick={() => void importBrainDump()} disabled={isRunningAi}>
                  {isRunningAi ? <LoaderCircle className="animate-spin" /> : <FileDown />}
                  Import
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {showRefocus ? (
          <Card className="w-[24rem] border border-border/80 bg-card/95 shadow-2xl backdrop-blur">
            <CardHeader className="border-b border-border/70">
              <CardTitle className="text-base">Refocus</CardTitle>
              <CardDescription>
                {activeModel && effectiveAiStatus.reachable ? "Using local AI." : "Using built-in logic."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <Input
                placeholder='I have 20 minutes, low energy, and I’m at home.'
                value={focusPrompt}
                onChange={(event) => setFocusPrompt(event.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeFloatingPanels}>Close</Button>
                <Button variant="secondary" onClick={() => void runRefocus("refocus")} disabled={isRunningAi}>
                  {isRunningAi ? <LoaderCircle className="animate-spin" /> : <WandSparkles />}
                  Refocus now
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {showAiSettings ? (
          <Card className="w-[26rem] max-h-[78vh] overflow-y-auto border border-border/80 bg-card/95 shadow-2xl backdrop-blur">
            <CardHeader className="border-b border-border/70">
              <CardTitle className="text-base">AI settings</CardTitle>
              <CardDescription>Set up one model source and keep the rest hidden.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={aiEnabled ? "secondary" : "outline"}
                  className={aiEnabled ? "motion-success" : undefined}
                  onClick={() => setAiEnabled((current) => !current)}
                >
                  {aiEnabled ? "Turn off AI features" : "Turn on AI features"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void refreshAiStatus()}>
                  {isRefreshingStatus ? <LoaderCircle className="animate-spin" /> : "Refresh"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedModel(null)}
                  disabled={!selectedModel}
                >
                  Clear selected model
                </Button>
              </div>

              <div className="space-y-2 border-b border-border/60 pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={
                  effectiveAiStatus.reachable
                        ? "gap-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200"
                        : "gap-2 bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200"
                    }
                  >
                    <span
                      aria-hidden="true"
                      className={
                        effectiveAiStatus.reachable
                          ? "h-2 w-2 rounded-full bg-emerald-500 animate-pulse"
                          : "h-2 w-2 rounded-full bg-rose-500 animate-pulse"
                      }
                    />
                    {effectiveAiStatus.reachable ? "Ollama available" : "Ollama not installed"}
                  </Badge>
                  <Badge variant="outline">
                    {selectedModel
                      ? `${selectedModel}${selectedModelInfo?.kind === "cloud" ? " (Cloud)" : ""}`
                      : "No model selected"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pick one local or cloud model. If nothing is ready, the app falls back to built-in focus logic.
                </p>
                {isHostedDeployment && !browserOllamaConnected ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => void connectBrowserOllama()} disabled={isConnectingBrowserOllama}>
                        {isConnectingBrowserOllama ? <LoaderCircle className="animate-spin" /> : null}
                        Connect local Ollama on this device
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Only needed on the deployed app. This tries your browser&apos;s own `localhost:11434`.
                      </p>
                    </div>
                    {browserConnectHelp ? (
                      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                        <div className="flex items-start gap-2">
                          <TriangleAlert className="mt-0.5 size-4 text-amber-700 dark:text-amber-300" />
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                              {browserConnectHelp.title}
                            </p>
                            <p className="text-xs text-amber-800/90 dark:text-amber-100/80">
                              {browserConnectHelp.body}
                            </p>
                            <p className="text-xs text-amber-800/90 dark:text-amber-100/80">
                              {browserConnectHelp.followUp}
                            </p>
                            <div className="rounded-xl border border-amber-200/80 bg-background/80 px-3 py-2 font-mono text-[11px] text-foreground dark:border-amber-500/20 dark:bg-background/40">
                              {browserConnectHelp.command}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className={copiedAction === "fix" ? "motion-success" : undefined}
                                onClick={() => void copyCommand(browserConnectHelp.command, "fix")}
                              >
                                {copiedAction === "fix" ? "Copied fix command" : "Copy fix command"}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => void connectBrowserOllama()} disabled={isConnectingBrowserOllama}>
                                {isConnectingBrowserOllama ? <LoaderCircle className="animate-spin" /> : null}
                                Try again
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Button size="sm" variant="outline" onClick={() => setShowStorageInstructions((current) => !current)}>
                    {showStorageInstructions ? "Hide device details" : "Show device details"}
                  </Button>
                  {showStorageInstructions ? (
                    <div className="motion-section rounded-2xl bg-muted/25 p-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ollama on this device</p>
                          <p className="mt-1 text-sm font-medium">{effectiveAiStatus.reachable ? "Available" : "Not available"}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Downloaded local models</p>
                          <p className="mt-1 text-sm font-medium">{effectiveAiStatus.localModelCount > 0 ? String(effectiveAiStatus.localModelCount) : "None yet"}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Space used</p>
                          <p className="mt-1 text-sm font-medium">{effectiveAiStatus.storageLabel}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Local model folder</p>
                          <p className="mt-1 break-all text-sm font-medium">{effectiveAiStatus.modelPath}</p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Free up space</p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void runStorageAction("deleteAllLocalModels")}
                            disabled={isCleaningStorage || effectiveAiStatus.localModelCount === 0 || browserOllamaConnected}
                          >
                            Delete downloaded local models
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void runStorageAction("clearLogs")}
                            disabled={isCleaningStorage || browserOllamaConnected}
                          >
                            Clear Ollama logs
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Use these if you want to free up disk space on this device.
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Quick setup</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={aiModelTab === "local" ? "secondary" : "outline"}
                    className={aiModelTab === "local" ? "motion-success" : undefined}
                    onClick={() => setAiModelTab("local")}
                  >
                    Use local model
                  </Button>
                  <Button
                    size="sm"
                    variant={aiModelTab === "cloud" ? "secondary" : "outline"}
                    className={aiModelTab === "cloud" ? "motion-success" : undefined}
                    onClick={() => setAiModelTab("cloud")}
                  >
                    Use cloud model
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button size="sm" asChild>
                    <a href="https://ollama.com/download/mac" target="_blank" rel="noreferrer">
                      <Download />
                      Install Ollama
                    </a>
                  </Button>
                  {aiModelTab === "cloud" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className={copiedAction === "signin" ? "motion-success" : undefined}
                      onClick={() => void copyCommand("ollama signin", "signin")}
                    >
                      {copiedAction === "signin" ? "Copied sign-in command" : "Copy sign-in command"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className={copiedAction === "model" ? "motion-success" : undefined}
                      onClick={() => void copyCommand(`ollama run ${localInstallModel}`, "model")}
                    >
                      {copiedAction === "model" ? "Copied local model command" : "Copy local model command"}
                    </Button>
                  )}
                </div>
                {aiModelTab === "cloud" ? (
                  <div className="rounded-xl bg-muted/25 p-3 text-xs text-muted-foreground">
                    <ol className="space-y-1.5">
                      <li>1. Install Ollama if you have not already.</li>
                      <li>2. Open the `Terminal` app on your Mac.</li>
                      <li>3. Press “Copy sign-in command”.</li>
                      <li>4. Paste it into that Terminal window and press Enter.</li>
                      <li>5. Follow the Ollama sign-in flow that opens.</li>
                      <li>6. Come back here, press Refresh, and choose a cloud model below.</li>
                    </ol>
                    <p className="mt-3">
                      If Ollama accepts it, this app will use that cloud model through your Ollama app.
                    </p>
                    <div className="mt-3 flex items-start gap-2">
                      <Info className="mt-0.5 size-3.5 text-muted-foreground" />
                      <p>You can also browse and download cloud models in the Ollama app itself after signing in.</p>
                    </div>
                    <div className="mt-5">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Cloud starter options</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {effectiveAiStatus.models
                          .filter((model) => model.kind === "cloud")
                          .map((model) => (
                            <Button
                              key={model.name}
                              size="sm"
                              variant={selectedModel === model.name ? "secondary" : "outline"}
                              className={selectedModel === model.name ? "motion-success" : undefined}
                              onClick={() => setSelectedModel(model.name)}
                            >
                              {model.name}
                            </Button>
                          ))}
                      </div>
                    </div>
                    <p className="mt-3">
                      Browse the full Ollama cloud catalog here:{" "}
                      <a
                        className="underline underline-offset-4"
                        href="https://ollama.com/search"
                        target="_blank"
                        rel="noreferrer"
                      >
                        ollama.com/search
                      </a>
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-muted/25 p-3 text-xs text-muted-foreground">
                    <div className="mb-3 flex flex-wrap gap-2">
                      {localStarterModels.map((model) => (
                        <Button
                          key={model.name}
                          size="sm"
                          variant={localInstallModel === model.name ? "secondary" : "outline"}
                          className={localInstallModel === model.name ? "motion-success" : undefined}
                          onClick={() => setLocalInstallModel(model.name)}
                        >
                          {model.name}
                          <Badge variant="outline" className="ml-1">
                            {model.badge}
                          </Badge>
                        </Button>
                      ))}
                    </div>
                    <ol className="space-y-1.5">
                      <li>1. Install Ollama if you haven&apos;t already installed it.</li>
                      <li>2. Open the `Terminal` app on your Mac.</li>
                      <li>3. Choose a local model.</li>
                      <li>4. Press “Copy local model command”.</li>
                      <li>5. Paste it into that Terminal window and press Enter.</li>
                      <li>6. Come back here and press Refresh.</li>
                      <li>7. Turn on AI features if you haven&apos;t done that. Now you are ready.</li>
                    </ol>
                    <div className="mt-3 flex items-start gap-2">
                      <Info className="mt-0.5 size-3.5 text-muted-foreground" />
                      <p>You can also browse and download local models directly from the Ollama app on your Mac.</p>
                    </div>
                    <p className="mt-3">
                      Full model catalog:{" "}
                      <a
                        className="underline underline-offset-4"
                        href="https://ollama.com/search"
                        target="_blank"
                        rel="noreferrer"
                      >
                        ollama.com/search
                      </a>
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {aiModelTab === "local" ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {effectiveAiStatus.models
                        .filter((model) => model.kind === "local")
                        .map((model) => (
                          <Button
                            key={model.name}
                            size="sm"
                            variant={selectedModel === model.name ? "secondary" : "outline"}
                            onClick={() => setSelectedModel(model.name)}
                          >
                            {model.name} · {model.sizeLabel}
                          </Button>
                        ))}
                      {effectiveAiStatus.localModelCount === 0 ? null : null}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={closeFloatingPanels}>Close</Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex items-center gap-3">
          <Button
            size="icon-lg"
            variant={showAiSettings ? "secondary" : "default"}
            className="size-14 rounded-2xl shadow-[0_18px_40px_rgba(0,0,0,0.28)] hover:bg-primary data-[variant=secondary]:hover:bg-secondary"
            onClick={() => {
              const next = !showAiSettings
              closeFloatingPanels()
              setShowAiSettings(next)
            }}
            aria-label="Open AI settings"
          >
            <Brain />
          </Button>
          <Button
            size="icon-lg"
            variant={showFocusMenu ? "secondary" : "default"}
            className="size-14 rounded-2xl shadow-[0_18px_40px_rgba(0,0,0,0.28)] hover:bg-primary data-[variant=secondary]:hover:bg-secondary"
            onClick={() => {
              const next = !showFocusMenu
              closeFloatingPanels()
              setShowFocusMenu(next)
            }}
            aria-label="Open focus tools"
          >
            <SlidersHorizontal />
          </Button>
          <Button
            size="icon-lg"
            variant={showCaptureMenu ? "secondary" : "default"}
            className="size-14 rounded-2xl shadow-[0_18px_40px_rgba(0,0,0,0.28)] hover:bg-primary data-[variant=secondary]:hover:bg-secondary"
            onClick={() => {
              const next = !showCaptureMenu
              closeFloatingPanels()
              setShowCaptureMenu(next)
            }}
            aria-label="Open capture menu"
          >
            <Plus />
          </Button>
        </div>
      </div>
    </div>
  )
}
