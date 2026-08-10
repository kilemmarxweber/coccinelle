"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

export type SearchComboboxOption = {
  value: string;
  label: string;
};

type SearchComboboxProps = {
  items: SearchComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  showClear?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
};

export function SearchCombobox({
  items,
  value,
  onValueChange,
  placeholder = "Rechercher…",
  emptyText = "Aucun résultat.",
  showClear = false,
  disabled,
  id,
  className,
}: SearchComboboxProps) {
  const selected = items.find((item) => item.value === value) ?? null;

  return (
    <Combobox
      items={items}
      value={selected}
      onValueChange={(next) => {
        onValueChange(next?.value ?? "");
      }}
      isItemEqualToValue={(a, b) => a.value === b.value}
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        showClear={showClear}
        disabled={disabled}
        className={cn("w-full", className)}
      />
      <ComboboxContent>
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
