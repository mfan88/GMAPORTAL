"use client"
import { cn } from "@/lib/utils"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import { format } from "date-fns"
import { Dispatch, SetStateAction } from "react"

interface DateProps {
  date: Date | undefined
  setDate: Dispatch<SetStateAction<Date | undefined>>
  className?: string
}

export default function DatePicker({
  className,
  date,
  setDate,
}: Readonly<DateProps>) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
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
          onSelect={setDate}
          defaultMonth={date}
        />
      </PopoverContent>
    </Popover>
  )
}
