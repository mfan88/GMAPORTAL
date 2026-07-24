import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import {
    getAppConfig,
    resetAppConfig,
    updateAppConfig,
    hasValidAdminAccess,
} from "@/lib/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const config = await getAppConfig()
    return NextResponse.json(config)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load config"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  if (!(await hasValidAdminAccess(request.headers.get("cookie") ?? undefined))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as Record<string, unknown>
    const config = await updateAppConfig(body)
    return NextResponse.json(config)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update config"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await hasValidAdminAccess(request.headers.get("cookie") ?? undefined))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 401 })
  }

  try {
    const config = await resetAppConfig()
    return NextResponse.json(config)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not reset config"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
