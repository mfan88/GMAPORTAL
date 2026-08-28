"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type ComboboxItem = { label: string; value: string };

type ComboboxSharedProps = {
  items: ComboboxItem[];
  placeholder?: string;
  emptyText?: string;
  id?: string;
  disabled?: boolean;
};

type ComboboxProps =
  | (ComboboxSharedProps & {
      multiple?: false;
      value: string | null;
      onValueChange: (value: string | null) => void;
    })
  | (ComboboxSharedProps & {
      multiple: true;
      value: string[];
      onValueChange: (value: string[]) => void;
    });

const popupClassName =
  "isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 animate-none! relative bg-popover/70 before:pointer-events-none before:absolute before:inset-0 before:-z-1 before:rounded-[inherit] before:backdrop-blur-2xl before:backdrop-saturate-150";

const itemClassName =
  "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-foreground/10 data-disabled:pointer-events-none data-disabled:opacity-50";

function ComboboxPopup({ emptyText }: Readonly<{ emptyText: string }>) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side="bottom"
        sideOffset={4}
        align="start"
        className="isolate z-50"
      >
        <ComboboxPrimitive.Popup className={popupClassName}>
          <ComboboxPrimitive.Empty className="px-2 py-1.5 text-sm text-muted-foreground">
            {emptyText}
          </ComboboxPrimitive.Empty>
          <ComboboxPrimitive.List className="p-1">
            {(item: ComboboxItem) => (
              <ComboboxPrimitive.Item
                key={item.value}
                value={item}
                className={itemClassName}
              >
                {item.label}
                <ComboboxPrimitive.ItemIndicator
                  render={
                    <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
                  }
                >
                  <CheckIcon className="size-4" />
                </ComboboxPrimitive.ItemIndicator>
              </ComboboxPrimitive.Item>
            )}
          </ComboboxPrimitive.List>
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

function Combobox(props: ComboboxProps) {
  const {
    items,
    placeholder = "Select…",
    emptyText = "No matches.",
    id,
    disabled,
  } = props;
  const filter = ComboboxPrimitive.useFilter({ sensitivity: "base" });
  const selectedItems = props.multiple
    ? props.value
        .map((value) => items.find((item) => item.value === value))
        .filter((item): item is ComboboxItem => item != null)
    : (items.find((item) => item.value === props.value) ?? null);

  return (
    <ComboboxPrimitive.Root
      id={id}
      items={items}
      multiple={props.multiple === true}
      value={selectedItems}
      onValueChange={(next) => {
        if (props.multiple) {
          const selected = Array.isArray(next) ? next : [];
          props.onValueChange(selected.map((item) => item.value));
          return;
        }
        const selected = Array.isArray(next) ? next[0] : next;
        props.onValueChange(selected?.value ?? null);
      }}
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(item, current) => item.value === current.value}
      filter={filter.contains}
      autoHighlight
      disabled={disabled}
    >
      {props.multiple ? (
        <ComboboxPrimitive.Chips
          className={cn(
            "flex min-h-9 w-full min-w-0 flex-wrap items-center gap-1 rounded-md border border-input bg-transparent py-1 pr-1 pl-1.5 shadow-xs transition-[color,box-shadow] outline-none focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
            disabled && "pointer-events-none cursor-not-allowed opacity-50"
          )}
        >
          <ComboboxPrimitive.Value>
            {(selected: ComboboxItem[]) => (
              <>
                {selected.map((item) => (
                  <ComboboxPrimitive.Chip
                    key={item.value}
                    className="flex max-w-full items-center gap-1 rounded-md bg-foreground/10 py-0.5 pr-0.5 pl-1.5 text-xs"
                  >
                    <span className="min-w-0 truncate">{item.label}</span>
                    <ComboboxPrimitive.ChipRemove
                      className="flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-foreground/10"
                      aria-label={`Remove ${item.label}`}
                    >
                      <XIcon className="size-3" />
                    </ComboboxPrimitive.ChipRemove>
                  </ComboboxPrimitive.Chip>
                ))}
                <ComboboxPrimitive.Input
                  placeholder={
                    selected.length === 0 ? placeholder : "Add another…"
                  }
                  className="h-6 min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </>
            )}
          </ComboboxPrimitive.Value>
          <ComboboxPrimitive.Trigger
            className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-foreground/5"
            aria-label="Open list"
          >
            <ComboboxPrimitive.Icon
              render={
                <ChevronDownIcon className="pointer-events-none size-4" />
              }
            />
          </ComboboxPrimitive.Trigger>
        </ComboboxPrimitive.Chips>
      ) : (
        <ComboboxPrimitive.InputGroup
          className={cn(
            "flex h-9 w-full min-w-0 items-center rounded-md border border-input bg-transparent pr-1 shadow-xs transition-[color,box-shadow] outline-none focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
            disabled && "pointer-events-none cursor-not-allowed opacity-50"
          )}
        >
          <ComboboxPrimitive.Input
            placeholder={placeholder}
            className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <ComboboxPrimitive.Trigger
            className="flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-foreground/5"
            aria-label="Open list"
          >
            <ComboboxPrimitive.Icon
              render={
                <ChevronDownIcon className="pointer-events-none size-4" />
              }
            />
          </ComboboxPrimitive.Trigger>
        </ComboboxPrimitive.InputGroup>
      )}
      <ComboboxPopup emptyText={emptyText} />
    </ComboboxPrimitive.Root>
  );
}

export { Combobox };
