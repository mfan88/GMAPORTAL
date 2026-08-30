import Link from "next/link";
import { DocArticle } from "@/components/docsChrome";
import {
  CreateAzureCommunicationServicesWalkthrough,
  CreateEmailCommunicationServiceWalkthrough,
} from "@/components/scribeComponents";

export default function AzureEmailPage() {
  return (
    <DocArticle
      title="Azure email setup"
      lead="Create the Azure Communication Services resources that send upload notification emails."
    >
      <p>
        The portal reads{" "}
        <code>AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING</code> from the
        Communication Services resource and{" "}
        <code>AZURE_EMAIL_SENDER_ADDRESS</code> from a domain on the Email
        Communication Service. See{" "}
        <Link href="/docs/technical/environment-variables">
          Environment variables
        </Link>{" "}
        after you finish these walkthroughs.
      </p>

      <h2>Walkthroughs</h2>
      <div className="space-y-3">
        <CreateEmailCommunicationServiceWalkthrough />
        <CreateAzureCommunicationServicesWalkthrough />
      </div>
    </DocArticle>
  );
}
