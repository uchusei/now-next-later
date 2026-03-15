"use client"

import * as React from "react"

export type AppLanguage = "en" | "sv"

const STORAGE_KEY = "now-next-later.language"

export const copy = {
  en: {
    theme: {
      system: "Follow System",
      light: "Light Mode",
      dark: "Dark Mode",
    },
    hero: {
      eyebrow: "Focus Dashboard",
      title: "Now / Next / Later",
      description:
        "Bring in tasks from your bigger list and let the app suggest what deserves your attention now, what should queue up next, and what can stay quiet.",
    },
    sections: {
      inFocus: "In focus",
      inFocusTitle: "One main task, chosen for this moment",
      overview: "Overview",
      overviewTitle: "Everything in one place",
      supportQueue: "Support queue",
      supportQueueTitle: "The next two tasks worth keeping close",
      notNow: "Not now",
      notNowTitle: "Tasks that stay out of your way for now",
      avoidance: "Avoidance",
      avoidanceTitle: "Patterns worth checking before they keep draining attention",
      momentum: "Momentum",
      doneList: "Done list",
    },
    toggles: {
      showNotNow: "Show not now",
      hideNotNow: "Hide not now",
      showAvoidance: "Show avoidance",
      hideAvoidance: "Hide avoidance",
      showDoneList: "Show done list",
      hideDoneList: "Hide done list",
      clearDoneList: "Clear done list",
    },
    taskColumn: {
      now: {
        label: "NOW",
        title: "The best task to start right now",
        description: "One recommended focus task, chosen from your full inbox.",
        emptyTitle: "Nothing in focus yet",
        emptyDescription: "Add tasks to your inbox and use a focus mode to get a recommendation.",
      },
      next: {
        label: "NEXT",
        title: "Backup tasks that still make sense today",
        description: "A short adaptive queue so you do not have to reconsider everything.",
        emptyTitle: "No backups yet",
        emptyDescription: "Once your inbox has a few tasks, the next best options will appear here.",
      },
      notNow: {
        label: "NOT NOW",
        title: "Hidden from focus, still safely stored",
        description: "These tasks are quieter for now so they stop competing for attention.",
        emptyTitle: "No hidden tasks",
        emptyDescription: "Defer a task when it is real, but not realistic for right now.",
      },
      tags: {
        today: "Today",
        soon: "Soon",
        someday: "Someday",
        quick: "Quick",
        medium: "Medium",
        deep: "Deep",
        low: "Low energy",
        mediumEnergy: "Medium energy",
        high: "High energy",
        anywhere: "Anywhere",
        computer: "Computer",
        home: "Home",
        errands: "Errands",
        calls: "Calls",
        snoozed: "Snoozed",
      },
      actions: {
        save: "Save",
        cancel: "Cancel",
        editDetails: "Edit details",
        hideDetails: "Hide details",
        enterFocusMode: "Enter focus mode",
        exitFocusMode: "Exit focus mode",
        startNow: "Start now",
        cantDoNow: "Can't do now",
        done: "Done",
        when: "When",
        effort: "Effort",
        energy: "Energy",
        context: "Context",
      },
    },
    focusBoard: {
      overviewTitle: "Task overview",
      overviewDescription: "See the full picture without losing sight of what matters now.",
      overviewNow: "Now",
      overviewNext: "Next",
      overviewNotNow: "Not now",
      overviewDone: "Done",
      overviewEmpty: "No tasks yet",
      overviewEmptyDesc: "Add a few tasks and the overview will line them up here.",
      noAvoidance: "No avoidance pattern detected yet",
      noAvoidanceDesc: "Tasks that keep getting snoozed will show up here with gentle suggestions.",
      noDone: "No done tasks yet",
      noDoneDesc: "Finished tasks will land here so the day feels less invisible.",
      doneOn: "Done on",
      startNow: "Start now",
      markDone: "Mark done",
      delete: "Delete",
      avoidanceBuiltIn: "Avoidance check finished using built-in logic.",
      avoidanceLocal: "Avoidance check finished using local AI.",
    },
    language: {
      label: "Language",
      english: "English",
      swedish: "Swedish",
    },
  },
  sv: {
    theme: {
      system: "Folj systemet",
      light: "Ljust lage",
      dark: "Morkt lage",
    },
    hero: {
      eyebrow: "Fokuspanel",
      title: "Nu / Sen / Senare",
      description:
        "Samla uppgifter fran din storre lista och lat appen foresla vad som fortjanar din uppmarksamhet nu, vad som ska sta pa tur och vad som kan vara tyst.",
    },
    sections: {
      inFocus: "I fokus",
      inFocusTitle: "En huvuduppgift, vald for den har stunden",
      overview: "Oversikt",
      overviewTitle: "Allt pa ett stalle",
      supportQueue: "Stodko",
      supportQueueTitle: "De tva nasta uppgifterna som ar vard att ha nara",
      notNow: "Inte nu",
      notNowTitle: "Uppgifter som kan ligga ur vagen just nu",
      avoidance: "Undvikande",
      avoidanceTitle: "Monster som ar bra att se innan de fortsatter dra energi",
      momentum: "Momentum",
      doneList: "Klar-lista",
    },
    toggles: {
      showNotNow: "Visa inte nu",
      hideNotNow: "Dolj inte nu",
      showAvoidance: "Visa undvikande",
      hideAvoidance: "Dolj undvikande",
      showDoneList: "Visa klar-lista",
      hideDoneList: "Dolj klar-lista",
      clearDoneList: "Rensa klar-lista",
    },
    taskColumn: {
      now: {
        label: "NU",
        title: "Den basta uppgiften att borja med just nu",
        description: "En rekommenderad fokusuppgift, vald fran hela din inkorg.",
        emptyTitle: "Inget i fokus an",
        emptyDescription: "Lagg till uppgifter i inkorgen och anvand ett fokuslage for att fa en rekommendation.",
      },
      next: {
        label: "SEN",
        title: "Reservuppgifter som fortfarande ar rimliga idag",
        description: "En kort adaptiv ko sa att du inte behover omvardera allt.",
        emptyTitle: "Inga reservuppgifter an",
        emptyDescription: "Nar inkorgen innehaller nagra uppgifter kommer de basta nasta alternativen att visas har.",
      },
      notNow: {
        label: "SENARE",
        title: "Gomt fran fokus, men tryggt sparat",
        description: "De har uppgifterna ar tystare just nu sa att de slutar konkurrera om uppmarksamhet.",
        emptyTitle: "Inga dolda uppgifter",
        emptyDescription: "Skjut upp en uppgift nar den ar verklig, men inte realistisk just nu.",
      },
      tags: {
        today: "Idag",
        soon: "Snart",
        someday: "Senare",
        quick: "Snabb",
        medium: "Mellan",
        deep: "Djup",
        low: "Lag energi",
        mediumEnergy: "Medelenergi",
        high: "Hog energi",
        anywhere: "Var som helst",
        computer: "Dator",
        home: "Hemma",
        errands: "Arenden",
        calls: "Samtal",
        snoozed: "Pausad",
      },
      actions: {
        save: "Spara",
        cancel: "Avbryt",
        editDetails: "Redigera detaljer",
        hideDetails: "Dolj detaljer",
        enterFocusMode: "Oppna fokuslage",
        exitFocusMode: "Lamna fokuslage",
        startNow: "Borja nu",
        cantDoNow: "Kan inte nu",
        done: "Klar",
        when: "Nar",
        effort: "Insats",
        energy: "Energi",
        context: "Kontext",
      },
    },
    focusBoard: {
      overviewTitle: "Uppgiftsoversikt",
      overviewDescription: "Se hela bilden utan att tappa bort vad som ar viktigast nu.",
      overviewNow: "Nu",
      overviewNext: "Sen",
      overviewNotNow: "Senare",
      overviewDone: "Klart",
      overviewEmpty: "Inga uppgifter an",
      overviewEmptyDesc: "Lagg till nagra uppgifter sa visas oversikten har.",
      noAvoidance: "Inget undvikandemonster upptackt an",
      noAvoidanceDesc: "Uppgifter som fortsatter att skjutas upp visas har med forsiktiga forslag.",
      noDone: "Inga klara uppgifter an",
      noDoneDesc: "Fardiga uppgifter hamnar har sa att dagen inte kanns osynlig.",
      doneOn: "Klar",
      startNow: "Borja nu",
      markDone: "Markera klar",
      delete: "Ta bort",
      avoidanceBuiltIn: "Undvikandekontrollen ar klar med inbyggd logik.",
      avoidanceLocal: "Undvikandekontrollen ar klar med lokal AI.",
    },
    language: {
      label: "Sprak",
      english: "Engelska",
      swedish: "Svenska",
    },
  },
} as const

type LanguageContextValue = {
  language: AppLanguage
  setLanguage: (language: AppLanguage) => void
}

const LanguageContext = React.createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<AppLanguage>("en")

  React.useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === "en" || saved === "sv") {
      setLanguageState(saved)
      document.documentElement.lang = saved
    } else {
      document.documentElement.lang = "en"
    }
  }, [])

  const setLanguage = React.useCallback((next: AppLanguage) => {
    setLanguageState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
    document.documentElement.lang = next
  }, [])

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = React.useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider")
  }
  return context
}

export function useCopy() {
  const { language } = useLanguage()
  return copy[language]
}
