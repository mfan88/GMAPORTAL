export function encodeDrivePath(drivePath: string) {
  return drivePath.split("/").map(encodeURIComponent).join("/")
}

export function driveBaseFromId(driveId: string) {
  return `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}`
}

export async function parseGraphError(res: Response) {
  const details = await res.text()
  if (details.includes("SPO license")) {
    throw new Error(
      "This Microsoft account cannot write to SharePoint (missing license). Use an org site the app can access."
    )
  }
  if (res.status === 403 || /accessDenied/i.test(details)) {
    throw new Error(
      "SharePoint access denied (403). In Entra, grant application Sites.Selected + admin consent, then grant this app the write role on the target site via Graph POST /sites/{siteId}/permissions. Connecting the site only verifies the site exists — uploads need an explicit site write grant."
    )
  }
  throw new Error(
    `Upload failed (${res.status}): ${details || res.statusText}`
  )
}

export async function fetchGraphJson<T>(
  url: string,
  accessToken: string
): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!res.ok) {
    await parseGraphError(res)
  }
  return (await res.json()) as T
}

export type GraphDriveItem = {
  id?: string
  name?: string
  folder?: Record<string, unknown>
  file?: Record<string, unknown>
}

export async function getDriveItemByPath(
  driveId: string,
  itemPath: string,
  accessToken: string
): Promise<GraphDriveItem | null> {
  const encoded = encodeDrivePath(itemPath)
  const res = await fetch(
    `${driveBaseFromId(driveId)}/root:/${encoded}?$select=id,name,file,folder`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  )
  if (res.status === 404) return null
  if (!res.ok) await parseGraphError(res)
  return (await res.json()) as GraphDriveItem
}
