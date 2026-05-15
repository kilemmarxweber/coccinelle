"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface ListItemProps {
  title: string
  subtitle?: string
  description?: string
  leading?: React.ReactNode
  trailing?: React.ReactNode
  href?: string
  onClick?: () => void
  showChevron?: boolean
  className?: string
  disabled?: boolean
}

export function ListItem({
  title,
  subtitle,
  description,
  leading,
  trailing,
  href,
  onClick,
  showChevron = true,
  className,
  disabled = false,
}: ListItemProps) {
  const content = (
    <>
      {leading && (
        <div className="flex items-center justify-center shrink-0">
          {leading}
        </div>
      )}
      
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
          <span className="font-medium leading-snug wrap-break-word sm:truncate">{title}</span>
          {subtitle && (
            <span className="text-sm leading-relaxed text-muted-foreground break-all sm:max-w-[min(100%,18rem)] sm:truncate">
              {subtitle}
            </span>
          )}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {description}
          </p>
        )}
      </div>

      {trailing && (
        <div className="flex shrink-0 items-center self-center pt-0.5 sm:self-auto sm:pt-0">
          {trailing}
        </div>
      )}

      {(href || onClick) && showChevron && !trailing && (
        <ChevronRight className="size-5 shrink-0 self-center text-muted-foreground" />
      )}
    </>
  )

  const baseClassName = cn(
    "flex items-start gap-3 px-4 py-3 min-h-[56px] touch-manipulation sm:items-center sm:gap-4",
    "transition-colors",
    !disabled && (href || onClick) && "active:bg-muted/50 cursor-pointer",
    disabled && "opacity-50 pointer-events-none",
    className
  )

  if (href && !disabled) {
    return (
      <Link href={href} className={baseClassName}>
        {content}
      </Link>
    )
  }

  if (onClick && !disabled) {
    return (
      <button 
        type="button" 
        onClick={onClick} 
        className={cn(baseClassName, "w-full text-left")}
        disabled={disabled}
      >
        {content}
      </button>
    )
  }

  return (
    <div className={baseClassName}>
      {content}
    </div>
  )
}

interface ListGroupProps {
  children: React.ReactNode
  title?: string
  className?: string
}

export function ListGroup({ children, title, className }: ListGroupProps) {
  return (
    <div className={cn("bg-card rounded-xl border overflow-hidden", className)}>
      {title && (
        <div className="px-4 py-2.5 bg-muted/30 border-b">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </h3>
        </div>
      )}
      <div className="divide-y">
        {children}
      </div>
    </div>
  )
}
