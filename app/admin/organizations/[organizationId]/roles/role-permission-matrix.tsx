"use client";

import { organizationProductStatements } from "@/lib/permissions";
import { PERMISSION_MATRIX_SECTIONS } from "@/lib/org/permission-matrix-sections";
import { permissionLabelFr, resourceLabelFr } from "@/lib/permission-labels-fr";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type PermissionMap = Record<string, string[]>;

function hasAction(
  map: PermissionMap,
  resource: string,
  action: string,
): boolean {
  return map[resource]?.includes(action) ?? false;
}

function toggleAction(
  map: PermissionMap,
  resource: string,
  action: string,
  enabled: boolean,
): PermissionMap {
  const current = new Set(map[resource] ?? []);
  if (enabled) current.add(action);
  else current.delete(action);
  const next = { ...map };
  if (current.size === 0) delete next[resource];
  else next[resource] = [...current];
  return next;
}

type RolePermissionMatrixProps = {
  value: PermissionMap;
  onChange?: (next: PermissionMap) => void;
  readOnly?: boolean;
  className?: string;
};

export function RolePermissionMatrix({
  value,
  onChange,
  readOnly = false,
  className,
}: RolePermissionMatrixProps) {
  return (
    <Tabs defaultValue="organisation" className={cn("flex flex-col gap-4", className)}>
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
        {PERMISSION_MATRIX_SECTIONS.map((section) => (
          <TabsTrigger key={section.id} value={section.id} className="text-xs sm:text-sm">
            {section.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {PERMISSION_MATRIX_SECTIONS.map((section) => (
        <TabsContent
          key={section.id}
          value={section.id}
          className="flex flex-col gap-5 outline-none"
        >
          {section.resources.map((resource) => {
            const actions =
              organizationProductStatements[resource] as readonly string[];
            return (
              <div key={resource} className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {resourceLabelFr(resource)}
                </h3>
                <ul className="flex flex-col gap-2">
                  {actions.map((action) => {
                    const checked = hasAction(value, resource, action);
                    const id = `${resource}-${action}`;
                    return (
                      <li
                        key={id}
                        className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2"
                      >
                        <label
                          htmlFor={id}
                          className="min-w-0 flex-1 text-sm leading-snug"
                        >
                          {permissionLabelFr(resource, action)}
                        </label>
                        <Switch
                          id={id}
                          checked={checked}
                          disabled={readOnly}
                          onCheckedChange={(v) => {
                            if (readOnly || !onChange) return;
                            onChange(
                              toggleAction(value, resource, action, Boolean(v)),
                            );
                          }}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function countPermissions(map: PermissionMap): number {
  return Object.values(map).reduce((n, actions) => n + actions.length, 0);
}
