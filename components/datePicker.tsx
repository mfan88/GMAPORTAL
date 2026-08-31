"use client";

import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { format } from "date-fns";
import {
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";

interface DateProps {
  date: Date | undefined;
  setDate: Dispatch<SetStateAction<Date | undefined>>;
  className?: string;
}

function toDateInputValue(date: Date | undefined) {
  if (!date) return "";
  return format(date, "yyyy-MM-dd");
}

function parseDateInputValue(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  const next = new Date(year, month - 1, day);
  return Number.isNaN(next.getTime()) ? undefined : next;
}

export default function DatePicker({
  className,
  date,
  setDate,
}: Readonly<DateProps>) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            data-empty={!date}
            className={cn(
              "w-[212px] touch-manipulation justify-between text-left font-normal data-[empty=true]:text-muted-foreground",
              className
            )}
          />
        }
      >
        {date ? format(date, "PPP") : <span>Pick a date</span>}
        <CalendarIcon />
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 opacity-100"
        align="start"
        sideOffset={8}
        style={{ animation: "none" }}
      >
        <Calendar
          mode="single"
          selected={date}
          onSelect={(next) => {
            setDate(next);
            setOpen(false);
          }}
          defaultMonth={date}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Native date control — reliable on iOS/Android touch. */
export function MobileDatePicker({
  className,
  date,
  setDate,
}: Readonly<DateProps>) {
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDate(parseDateInputValue(event.target.value));
  };

  return (
    <div className={cn("relative min-w-0 w-full max-w-full", className)}>
      <div
        className={cn(
          "pointer-events-none box-border flex h-11 min-w-0 w-full max-w-full items-center justify-between gap-2 overflow-hidden rounded-sm border border-[#02182B]/20 bg-white px-3 py-2 text-base",
          date ? "text-[#02182B]" : "text-[#02182B]/45"
        )}
        aria-hidden
      >
        <span className="min-w-0 truncate">
          {date ? format(date, "EEEE, MMMM d, yyyy") : "YYYY-MM-DD"}
        </span>
        <CalendarIcon className="size-4 shrink-0 text-[#02182B]/50" />
      </div>
      <input
        type="date"
        value={toDateInputValue(date)}
        onChange={onChange}
        aria-label="Date recorded"
        className="absolute inset-0 z-10 h-full w-full max-w-full cursor-pointer touch-manipulation opacity-0"
      />
    </div>
  );
}
