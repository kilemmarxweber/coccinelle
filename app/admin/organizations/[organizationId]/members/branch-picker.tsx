"use client";

import { Building2 } from "lucide-react";
import { branchTypeLabel } from "@/lib/branch/hospitality";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

export type MemberBranchOption = {
  id: string;
  name: string;
  code: string;
  type: string;
};

type Props = {
  branches: MemberBranchOption[];
  value: string[];
  onChange: (branchIds: string[]) => void;
  disabled?: boolean;
  error?: string;
};

export function BranchPicker({ branches, value, onChange, disabled, error }: Props) {
  function toggle(id: string, checked: boolean) {
    if (checked) {
      onChange([...value, id]);
      return;
    }
    onChange(value.filter((x) => x !== id));
  }

  if (branches.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
        Aucune branche active dans cette organisation. Créez d’abord une branche.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {branches.map((b) => {
          const checked = value.includes(b.id);
          return (
            <label
              key={b.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                disabled && "pointer-events-none opacity-60",
              )}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => toggle(b.id, v === true)}
                disabled={disabled}
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-medium leading-snug">
                  <Building2 className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{b.name}</span>
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {branchTypeLabel(b.type)} · {b.code}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
