type ScribeWalkthroughProps = {
  title: string;
  src: string;
};

function ScribeWalkthrough({ title, src }: Readonly<ScribeWalkthroughProps>) {
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

export function ChangeReferenceWorkbookWalkthrough() {
  return (
    <ScribeWalkthrough
      title="Change the reference workbook"
      src="https://scribehow.com/embed/How_to_change_the_reference_excel_sheet__cytOH6SqTWOU8vDe8TX2sA"
    />
  );
}

export function ChangeLinkDurationsWalkthrough() {
  return (
    <ScribeWalkthrough
      title="Change the duration of the buffer and link availability"
      src="https://scribehow.com/o/LeNvgJTXTPast-1US8vBcQ/viewer/How_to_Configure_Link_Buffer_and_Availability_Settings__cF5Gi8vcRIGZgJZZb9v-ug"
    />
  );
}

export function AddorRemoveAdminEmailWalkthrough() {
  return (
    <ScribeWalkthrough
      title="Add or Remove an Admin Email"
      src="https://scribehow.com/o/LeNvgJTXTPast-1US8vBcQ/viewer/How_to_Add_a_New_Admin_Email_Address__iYuHmK8hQGWWmuv3X21Q1w"
    />
  );
}

export function AddorRemoveNotificationEmailWalkthrough() {
  return (
    <ScribeWalkthrough
      title="Add or Remove a Notification Email"
      src="https://scribehow.com/o/LeNvgJTXTPast-1US8vBcQ/viewer/Managing_Notification_Emails_in_the_Admin_Console__QcT3KlSTSKOnw-1IgZdlYA"
    />
  );
}

export function AccesstheConsoleWalkthrough() {
  return (
    <ScribeWalkthrough
      title="Access the Admin Console"
      src="https://scribehow.com/o/LeNvgJTXTPast-1US8vBcQ/viewer/How_to_Access_the_Staff_Sign_In_Portal__WreTH6GhTGq3p8cPNoB7bQ"
    />
  );
}

export function CreateEmailCommunicationServiceWalkthrough() {
  return (
    <ScribeWalkthrough
      title="Create and Provision an Email Communication Service"
      src="https://scribehow.com/o/LeNvgJTXTPast-1US8vBcQ/viewer/Create_and_Provision_an_Email_Communication_Service__q9_i6MeEQf69FId5H7B2Yw"
    />
  );
}

export function CreateAzureCommunicationServicesWalkthrough() {
  return (
    <ScribeWalkthrough
      title="Create and Configure Azure Communication Services"
      src="https://scribehow.com/o/LeNvgJTXTPast-1US8vBcQ/viewer/How_To_Create_And_Configure_Azure_Communication_Services__pz_ziPtJR-OPFSx-ZwlVIg"
    />
  );
}
