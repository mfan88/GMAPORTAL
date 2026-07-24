"use client"
import {
    Field,
    FieldDescription,
    FieldLabel,
} from "@/components/ui/field"
import DatePicker from "./datePicker"
import { useFileProviderContext } from "@/app/fileprovider"

export default function InfoGroup() {
    const { date, setDate } = useFileProviderContext()

    return (
        <div className="box-border flex flex-col gap-6 pr-4 pb-4 sm:flex-row">
            <Field className="w-[80%]">
                <FieldLabel>Date Recorded</FieldLabel>
                <DatePicker
                    className="border border-gray-500 sm:border-none"
                    date={date}
                    setDate={setDate}
                />
                <FieldDescription>
                    Please pick the date on which the video was taken
                </FieldDescription>
            </Field>
        </div>
    )
}
