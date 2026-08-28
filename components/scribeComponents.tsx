type ScribeWalkthroughProps = {
  title: string;
  src: string;
};

function ScribeWalkthrough({ title, src }: ScribeWalkthroughProps) {
  return (
    <details className="rounded-sm border border-[#02182B]/15 bg-white">
      <summary className="cursor-pointer px-3 py-2.5 font-heading text-base font-semibold tracking-tight select-none">
        {title}
      </summary>
      <div className="overflow-hidden border-t border-[#02182B]/10">
        <iframe
          title={title}
          src={src}
          allow="fullscreen"
          className="block h-[640px] min-h-[480px] w-full border-none"
        />
      </div>
    </details>
  );
}

export function CreateLinkNowWalkthrough() {
  return (
    <ScribeWalkthrough
      title="Create a link to use now"
      src="https://scribehow.com/embed/How_To_Generate_A_New_Upload_Link_In_The_Console__2tZ50bhxTLCYIWBDGxMUgQ"
    />
  );
}

export function CreateScheduledLinkWalkthrough() {
  return (
    <ScribeWalkthrough
      title="Create a link to use later"
      src="https://scribehow.com/embed/How_to_Generate_a_New_Scheduled_Upload_Link__6aKRvPvQTQO-6GHXTzlO3A"
    />
  );
}
