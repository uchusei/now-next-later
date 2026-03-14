"use client"

import { Check, Expand, Minimize2, MoonStar, Pencil, Play, Trash2 } from "lucide-react"
import { useState } from "react"
import { z } from "zod"
import { useCopy } from "@/components/language-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type {
  ContextTag,
  DueBucket,
  EnergyLevel,
  Effort,
  LaneStatus,
  RankedTask,
} from "@/lib/focus"

interface LaneConfig {
  label: string
  title: string
  description: string
  emptyTitle: string
  emptyDescription: string
  dotClassName: string
}

interface TaskColumnProps {
  status: LaneStatus
  tasks: RankedTask[]
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  onComplete: (taskId: string) => void
  onDelete: (taskId: string) => void
  onStartNow: (taskId: string) => void
  onSnooze: (taskId: string) => void
  onUpdateTitle: (taskId: string, title: string) => void
  onUpdateMeta: (
    taskId: string,
    field: "dueBucket" | "effort" | "energy" | "context",
    value: DueBucket | Effort | EnergyLevel | ContextTag
  ) => void
}

const titleSchema = z.string().trim().min(1, "Write something").max(100, "Max 100 characters")

const laneDots: Record<LaneStatus, string> = {
  now: "bg-rose-500",
  next: "bg-amber-400",
  notNow: "bg-sky-400",
}

const metaOptions = {
  dueBucket: ["today", "soon", "someday"] as DueBucket[],
  effort: ["quick", "medium", "deep"] as Effort[],
  energy: ["low", "medium", "high"] as EnergyLevel[],
  context: ["anywhere", "computer", "home", "errands", "calls"] as ContextTag[],
}

function TaskItem({
  task,
  status,
  isFullscreen = false,
  onComplete,
  onDelete,
  onStartNow,
  onSnooze,
  onUpdateTitle,
  onUpdateMeta,
}: {
  task: RankedTask
  status: LaneStatus
  isFullscreen?: boolean
  onComplete: TaskColumnProps["onComplete"]
  onDelete: TaskColumnProps["onDelete"]
  onStartNow: TaskColumnProps["onStartNow"]
  onSnooze: TaskColumnProps["onSnooze"]
  onUpdateTitle: TaskColumnProps["onUpdateTitle"]
  onUpdateMeta: TaskColumnProps["onUpdateMeta"]
}) {
  const t = useCopy()
  const [isEditing, setIsEditing] = useState(false)
  const [showMetaEditor, setShowMetaEditor] = useState(false)
  const [value, setValue] = useState(task.title)
  const [error, setError] = useState("")
  const metaLabel = {
    dueBucket: {
      today: t.taskColumn.tags.today,
      soon: t.taskColumn.tags.soon,
      someday: t.taskColumn.tags.someday,
    },
    effort: {
      quick: t.taskColumn.tags.quick,
      medium: t.taskColumn.tags.medium,
      deep: t.taskColumn.tags.deep,
    },
    energy: {
      low: t.taskColumn.tags.low,
      medium: t.taskColumn.tags.mediumEnergy,
      high: t.taskColumn.tags.high,
    },
    context: {
      anywhere: t.taskColumn.tags.anywhere,
      computer: t.taskColumn.tags.computer,
      home: t.taskColumn.tags.home,
      errands: t.taskColumn.tags.errands,
      calls: t.taskColumn.tags.calls,
    },
  }

  const handleSave = () => {
    const result = titleSchema.safeParse(value)

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Could not save")
      return
    }

    onUpdateTitle(task.id, result.data)
    setIsEditing(false)
    setError("")
  }

  return (
    <li
      className={cn(
        "rounded-2xl border border-border/80 bg-background/85 p-4 shadow-sm",
        status === "now" &&
          "rounded-[28px] border-white/65 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.78))] p-5 shadow-[0_12px_34px_rgba(15,23,42,0.08),0_1px_0_rgba(255,255,255,0.9)_inset] backdrop-blur-xl dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(36,36,40,0.88),rgba(28,28,32,0.76))] dark:shadow-[0_14px_32px_rgba(0,0,0,0.24),0_1px_0_rgba(255,255,255,0.03)_inset]"
      )}
    >
      {isEditing ? (
        <div className="space-y-3">
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleSave()
              }
            }}
            autoFocus
          />
          {error ? <p className="text-xs text-rose-500">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleSave}>
              {t.taskColumn.actions.save}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setValue(task.title)
                setError("")
                setIsEditing(false)
              }}
            >
              {t.taskColumn.actions.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <div className={cn("space-y-4", status === "now" && "space-y-5")}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <p
                className={cn(
                  "text-base font-medium leading-6",
                  status === "now" && "text-[1.7rem] leading-[1.12] font-semibold tracking-tight",
                  status === "now" && isFullscreen && "text-[2.7rem] leading-[0.96] md:text-[3rem]"
                )}
              >
                {task.title}
              </p>
              <p
                className={cn(
                  "text-sm text-muted-foreground",
                  status === "now" && "text-[0.95rem]",
                  status === "now" && isFullscreen && "text-base md:text-lg"
                )}
              >
                {task.reason}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Edit task"
                onClick={() => {
                  setValue(task.title)
                  setError("")
                  setIsEditing(true)
                }}
              >
                <Pencil />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Delete task" onClick={() => onDelete(task.id)}>
                <Trash2 />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{metaLabel.dueBucket[task.dueBucket]}</Badge>
              <Badge variant="outline">{metaLabel.effort[task.effort]}</Badge>
              <Badge variant="outline">{metaLabel.energy[task.energy]}</Badge>
              <Badge variant="outline">{metaLabel.context[task.context]}</Badge>
              {task.deferCount > 0 ? <Badge variant="secondary">{t.taskColumn.tags.snoozed} {task.deferCount}x</Badge> : null}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowMetaEditor((current) => !current)}
            >
              {showMetaEditor ? t.taskColumn.actions.hideDetails : t.taskColumn.actions.editDetails}
            </Button>
            {showMetaEditor ? (
              <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-3">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">{t.taskColumn.actions.when}</p>
                  <div className="flex flex-wrap gap-2">
                    {metaOptions.dueBucket.map((value) => (
                      <Button
                        key={value}
                        size="xs"
                        variant={task.dueBucket === value ? "secondary" : "outline"}
                        onClick={() => onUpdateMeta(task.id, "dueBucket", value)}
                      >
                        {metaLabel.dueBucket[value]}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">{t.taskColumn.actions.effort}</p>
                  <div className="flex flex-wrap gap-2">
                    {metaOptions.effort.map((value) => (
                      <Button
                        key={value}
                        size="xs"
                        variant={task.effort === value ? "secondary" : "outline"}
                        onClick={() => onUpdateMeta(task.id, "effort", value)}
                      >
                        {metaLabel.effort[value]}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">{t.taskColumn.actions.energy}</p>
                  <div className="flex flex-wrap gap-2">
                    {metaOptions.energy.map((value) => (
                      <Button
                        key={value}
                        size="xs"
                        variant={task.energy === value ? "secondary" : "outline"}
                        onClick={() => onUpdateMeta(task.id, "energy", value)}
                      >
                        {metaLabel.energy[value]}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">{t.taskColumn.actions.context}</p>
                  <div className="flex flex-wrap gap-2">
                    {metaOptions.context.map((value) => (
                      <Button
                        key={value}
                        size="xs"
                        variant={task.context === value ? "secondary" : "outline"}
                        onClick={() => onUpdateMeta(task.id, "context", value)}
                      >
                        {metaLabel.context[value]}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {status !== "now" ? (
              <Button size="sm" variant="secondary" onClick={() => onStartNow(task.id)}>
                <Play />
                {t.taskColumn.actions.startNow}
              </Button>
            ) : null}
            {status !== "notNow" ? (
              <Button size="sm" variant="outline" onClick={() => onSnooze(task.id)}>
                <MoonStar />
                {t.taskColumn.actions.cantDoNow}
              </Button>
            ) : null}
            <Button size="sm" onClick={() => onComplete(task.id)}>
              <Check />
              {t.taskColumn.actions.done}
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

export default function TaskColumn({
  status,
  tasks,
  isFullscreen = false,
  onToggleFullscreen,
  onComplete,
  onDelete,
  onStartNow,
  onSnooze,
  onUpdateTitle,
  onUpdateMeta,
}: TaskColumnProps) {
  const t = useCopy()
  const config: LaneConfig =
    status === "now"
      ? {
          label: t.taskColumn.now.label,
          title: t.taskColumn.now.title,
          description: t.taskColumn.now.description,
          emptyTitle: t.taskColumn.now.emptyTitle,
          emptyDescription: t.taskColumn.now.emptyDescription,
          dotClassName: laneDots.now,
        }
      : status === "next"
        ? {
            label: t.taskColumn.next.label,
            title: t.taskColumn.next.title,
            description: t.taskColumn.next.description,
            emptyTitle: t.taskColumn.next.emptyTitle,
            emptyDescription: t.taskColumn.next.emptyDescription,
            dotClassName: laneDots.next,
          }
        : {
            label: t.taskColumn.notNow.label,
            title: t.taskColumn.notNow.title,
            description: t.taskColumn.notNow.description,
            emptyTitle: t.taskColumn.notNow.emptyTitle,
            emptyDescription: t.taskColumn.notNow.emptyDescription,
            dotClassName: laneDots.notNow,
          }
  const isNow = status === "now"

  return (
    <Card
      className={cn(
        "border border-border/80 bg-card/80 backdrop-blur",
        isNow &&
          "relative overflow-hidden rounded-[34px] border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(255,255,255,0.64))] shadow-[0_24px_64px_rgba(15,23,42,0.09),0_1px_0_rgba(255,255,255,0.95)_inset] backdrop-blur-2xl dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(28,28,32,0.86),rgba(22,22,26,0.74))] dark:shadow-[0_24px_60px_rgba(0,0,0,0.28),0_1px_0_rgba(255,255,255,0.04)_inset]",
        isNow && isFullscreen &&
          "flex h-full flex-col rounded-[2.8rem] border-white/92 bg-[linear-gradient(180deg,rgba(255,255,255,0.998),rgba(255,255,255,0.988))] shadow-[0_40px_140px_rgba(15,23,42,0.18),0_1px_0_rgba(255,255,255,0.995)_inset] backdrop-blur-[42px] dark:border-white/12 dark:bg-[linear-gradient(180deg,rgba(20,20,24,0.99),rgba(16,16,20,0.985))] dark:shadow-[0_42px_140px_rgba(0,0,0,0.5),0_1px_0_rgba(255,255,255,0.04)_inset]"
      )}
    >
      {isNow ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-14 -top-10 h-20 rounded-full bg-white/70 blur-3xl dark:bg-white/6"
        />
      ) : null}
      {isNow ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-white/80 dark:bg-white/10"
        />
      ) : null}
      <CardHeader className={cn("space-y-3 border-b border-border/70", isNow && "border-b-white/40 pb-7 pt-6 dark:border-b-white/8", isNow && isFullscreen && "px-8 pb-8 pt-8 md:px-12 md:pb-10 md:pt-10")}>
        <div className="flex items-center gap-2">
          <span className={cn("h-3 w-3 rounded-full", config.dotClassName, isNow && "h-3.5 w-3.5 shadow-[0_0_24px_rgba(244,63,94,0.38)]")} />
          <CardTitle className={cn("text-sm font-bold tracking-[0.24em]", isNow && "text-base tracking-[0.3em]")}>
            {config.label}
          </CardTitle>
          <div className="ml-auto flex items-center gap-2">
            {isNow && onToggleFullscreen ? (
              <Button
                size="icon-sm"
                variant="ghost"
                className="rounded-full"
                onClick={onToggleFullscreen}
                aria-label={
                  isFullscreen ? t.taskColumn.actions.exitFocusMode : t.taskColumn.actions.enterFocusMode
                }
              >
                {isFullscreen ? <Minimize2 /> : <Expand />}
              </Button>
            ) : null}
            <Badge variant="outline">{tasks.length}</Badge>
          </div>
        </div>
        <div className="space-y-1">
          <p className={cn("text-sm font-medium", isNow && "text-xl font-semibold tracking-tight", isNow && isFullscreen && "text-[2.2rem] md:text-[2.8rem] md:leading-[1.02]")}>{config.title}</p>
          <CardDescription className={cn(isNow && "max-w-2xl text-base text-foreground/65", isNow && isFullscreen && "max-w-3xl text-lg md:text-xl")}>
            {config.description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className={cn("pt-5", isNow && "pt-6", isNow && isFullscreen && "flex-1 overflow-y-auto px-8 pt-8 pb-8 md:px-12 md:pt-10")}>
        {tasks.length > 0 ? (
          <ul className={cn("space-y-3", isNow && "space-y-5")}>
            {tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                status={status}
                isFullscreen={isFullscreen}
                onComplete={onComplete}
                onDelete={onDelete}
                onStartNow={onStartNow}
                onSnooze={onSnooze}
                onUpdateTitle={onUpdateTitle}
                onUpdateMeta={onUpdateMeta}
              />
            ))}
          </ul>
        ) : (
          <div
            className={cn(
              "rounded-2xl border border-dashed border-border bg-muted/35 p-5",
              isNow && "bg-background/80 px-6 py-7"
            )}
          >
            <p className={cn("text-sm font-medium", isNow && "text-base font-semibold")}>{config.emptyTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{config.emptyDescription}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
