import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { withTenant } from "@/lib/with-tenant"

export const PATCH = withTenant(async (req: NextRequest, { params }: { params: { id: string } }) => {
  try {
    const body = await req.json()
    const message = await prisma.message.update({
      where: { id: params.id },
      data: body
    })
    return NextResponse.json(message)
  } catch (error) {
    return NextResponse.json({ error: "Failed to update message" }, { status: 500 })
  }
})

export const DELETE = withTenant(async (req: NextRequest, { params }: { params: { id: string } }) => {
  try {
    await prisma.message.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete message" }, { status: 500 })
  }
})