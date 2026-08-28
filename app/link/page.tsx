import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ParentUploadView from "@/components/parentUploadView";
import {
  checkUploadLink,
  cookieHeaderFromStore,
  getPortalAccessTokenFromRequest,
} from "@/lib/server/index";

export const dynamic = "force-dynamic";

export default async function ParentUploadPage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieHeaderFromStore(cookieStore);
  const token = getPortalAccessTokenFromRequest({
    headers: { cookie: cookieHeader },
  });

  if (!token) {
    redirect("/?needLink=1");
  }

  const result = await checkUploadLink(token);
  if (result.status === "pending") {
    const params = new URLSearchParams({
      reason: "pending",
      availableAt: String(result.availableAt),
      token,
    });
    redirect(`/link-expired?${params.toString()}`);
  }
  if (result.status !== "active") {
    redirect("/link-expired");
  }

  return <ParentUploadView />;
}
