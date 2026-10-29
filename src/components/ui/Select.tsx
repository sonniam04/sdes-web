"use client";

import * as RSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { useId } from "react";

export type SelectOption = { value: string; label: string };

export function Select({
  label,
  value,
  onValueChange,
  options,
  disabled,
  placeholder,
}: {
  label: string;
  value?: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-0.5">
      <label htmlFor={id} className="text-label text-text-muted">
        {label}
      </label>
      <RSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <RSelect.Trigger
          id={id}
          className="inline-flex w-full items-center justify-between gap-2 rounded-sm border border-rule bg-surface px-2 py-[3px] text-left text-text outline-none focus:border-focus focus:outline-2 focus:outline-focus data-[disabled]:bg-surface-sunken data-[disabled]:text-text-muted"
        >
          <RSelect.Value placeholder={placeholder} />
          <RSelect.Icon>
            <ChevronDown aria-hidden className="size-4" />
          </RSelect.Icon>
        </RSelect.Trigger>
        <RSelect.Portal>
          <RSelect.Content
            position="popper"
            sideOffset={2}
            className="z-50 min-w-[var(--radix-select-trigger-width)] border-[1.5px] border-rule-strong bg-surface font-sans text-body text-text"
          >
            <RSelect.Viewport className="py-1">
              {options.map((o) => (
                <RSelect.Item
                  key={o.value}
                  value={o.value}
                  className="relative flex cursor-pointer items-center py-1 pr-3 pl-7 outline-none select-none data-[highlighted]:bg-canvas"
                >
                  <RSelect.ItemIndicator className="absolute left-2">
                    <Check aria-hidden className="size-4" />
                  </RSelect.ItemIndicator>
                  <RSelect.ItemText>{o.label}</RSelect.ItemText>
                </RSelect.Item>
              ))}
            </RSelect.Viewport>
          </RSelect.Content>
        </RSelect.Portal>
      </RSelect.Root>
    </div>
  );
}
