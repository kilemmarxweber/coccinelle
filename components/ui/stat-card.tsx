import * as React from "react"
import { cn } from "@/lib/utils"
import { type LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  variant?: "default" | "primary" | "success" | "warning"
  className?: string
}

const variantStyles = {
  default: {
    card: "bg-card border",
    icon: "bg-muted text-muted-foreground",
  },
  primary: {
    card: "bg-primary text-primary-foreground",
    icon: "bg-primary-foreground/20 text-primary-foreground",
  },
  success: {
    card: "bg-success text-success-foreground",
    icon: "bg-success-foreground/20 text-success-foreground",
  },
  warning: {
    card: "bg-warning text-warning-foreground",
    icon: "bg-warning-foreground/20 text-warning-foreground",
  },
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: StatCardProps) {
  const styles = variantStyles[variant]

  return (
    <div className={cn(
      "rounded-xl p-4 flex flex-col gap-3",
      styles.card,
      className
    )}>
      <div className="flex items-start justify-between">
        <span className={cn(
          "text-sm font-medium",
          variant === "default" ? "text-muted-foreground" : "opacity-90"
        )}>
          {title}
        </span>
        {Icon && (
          <div className={cn(
            "rounded-lg p-2",
            styles.icon
          )}>
            <Icon className="size-4" />
          </div>
        )}
      </div>
      
      <div>
        <span className="text-2xl font-bold tracking-tight">
          {value}
        </span>
        {trend && (
          <span className={cn(
            "ml-2 text-sm font-medium",
            trend.isPositive ? "text-success" : "text-destructive",
            variant !== "default" && "opacity-90"
          )}>
            {trend.isPositive ? "+" : ""}{trend.value}%
          </span>
        )}
      </div>

      {subtitle && (
        <span className={cn(
          "text-sm",
          variant === "default" ? "text-muted-foreground" : "opacity-80"
        )}>
          {subtitle}
        </span>
      )}
    </div>
  )
}

interface StatGridProps {
  children: React.ReactNode
  className?: string
}

export function StatGrid({ children, className }: StatGridProps) {
  return (
    <div className={cn(
      "grid grid-cols-2 gap-3 md:grid-cols-4",
      className
    )}>
      {children}
    </div>
  )
}
