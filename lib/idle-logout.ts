"use client"

import { useEffect, useRef } from "react"
import { authClient } from "@/lib/auth-client"

const INACTIVE_TIME = 15 * 60 * 1000

export function IdleLogout() {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const resetTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(async () => {
        try {
          await authClient.revokeOtherSessions()
          await authClient.signOut()

          window.location.href = "/auth/sign-in"
        } catch (error) {
          console.error(error)
        }
      }, INACTIVE_TIME)
    }

    const events = [
      "mousemove",
      "keydown",
      "click",
      "scroll",
      "touchstart",
    ]

    events.forEach((event) => {
      window.addEventListener(event, resetTimer)
    })

    resetTimer()

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      events.forEach((event) => {
        window.removeEventListener(event, resetTimer)
      })
    }
  }, [])

  return null
}