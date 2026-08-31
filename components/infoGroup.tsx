"use client";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import DatePicker, { MobileDatePicker } from "./datePicker";
import { useFileProviderContext } from "@/app/fileprovider";

export { InfoGroup, MobileInfoGroup };
export default InfoGroup;

function InfoGroup() {
  const { date, setDate } = useFileProviderContext();

  return (
    <div className="box-border flex w-full flex-col gap-2">
      <Field className="w-full">
        <FieldLabel>Date recorded</FieldLabel>
        <DatePicker
          className="w-full max-w-sm rounded-sm border border-[#02182B]/20"
          date={date}
          setDate={setDate}
        />
        <FieldDescription>
          Please pick the date on which the video was taken
        </FieldDescription>
      </Field>
    </div>
  );
}

function MobileInfoGroup() {
  const { date, setDate } = useFileProviderContext();

  return (
    <div className="box-border flex min-w-0 w-full max-w-full flex-col gap-3">
      <Field className="min-w-0 w-full max-w-full">
        <FieldLabel>Date recorded</FieldLabel>
        <MobileDatePicker date={date} setDate={setDate} />
        <FieldDescription>
          Please pick the date on which the video was taken
        </FieldDescription>
      </Field>
    </div>
  );
}
