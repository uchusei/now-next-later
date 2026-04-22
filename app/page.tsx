"use client"

import { BrandWordmark } from "@/components/brand-wordmark"
import FocusBoard from "@/components/focus-board"
import { useCopy } from "@/components/language-provider"
import { LanguagePicker } from "@/components/language-picker"
import { ThemeToggle } from "@/components/theme-toggle"

export default function Home() {
  const t = useCopy()

  return (
    <main className="relative min-h-screen bg-background px-4 py-5 text-foreground md:px-10">
      <div className="pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2 md:left-auto md:right-10 md:top-5 md:translate-x-0">
        <div className="pointer-events-auto flex items-center gap-2 md:gap-3">
          <ThemeToggle />
          <LanguagePicker />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-6xl justify-end gap-3 opacity-0">
        <ThemeToggle />
        <LanguagePicker />
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 py-20 md:py-2">
        <section className="page-static-content w-full max-w-5xl text-center transition-[filter,opacity] duration-200">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-muted-foreground">
            {t.hero.eyebrow}
          </p>
          <h1 className="sr-only">
            {t.hero.title}
          </h1>
          <div className="mt-4 mb-3 flex justify-center md:mt-5 md:mb-2">
            <BrandWordmark className="max-w-[18rem] sm:max-w-[30rem] md:max-w-[60rem]" />
          </div>
          <p className="mx-auto mt-2 mb-5 max-w-3xl text-pretty text-base leading-[1.6] text-muted-foreground md:mt-3 md:mb-0 md:text-lg md:leading-[1.55]">
            {t.hero.description}
          </p>
        </section>
        <FocusBoard />
        <footer className="page-static-content w-full border-t border-border/60 pt-6 text-center text-sm text-muted-foreground transition-[filter,opacity] duration-200">
          <p>
            Built by{" "}
            <a
              className="underline underline-offset-4 transition-colors hover:text-foreground"
              href="https://github.com/uchusei"
              target="_blank"
              rel="noreferrer"
            >
              uchusei
            </a>
            {" "}/{" "}
            <a
              className="underline underline-offset-4 transition-colors hover:text-foreground"
              href="https://wowen.se"
              target="_blank"
              rel="noreferrer"
            >
              WOWEN
            </a>
            . 
            <br /> 
            Version: v0.0.1{" "}
            <a
              className="underline underline-offset-4 transition-colors hover:text-foreground"
              href="https://github.com/uchusei/now-next-later"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            .
          </p>
        </footer>
      </div>
    </main>
  )
}
