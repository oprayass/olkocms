import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const campaigns = await prisma.adCampaign.findMany({
      orderBy: { createdAt: "desc" },
      include: { expenses: true, orders: true },
    })
    return NextResponse.json(campaigns)
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, platform, budget, productId } = body
    if (!name || !budget) return NextResponse.json({ error: "Name and budget required" }, { status: 400 })
    const campaign = await prisma.adCampaign.create({
      data: { name, platform: platform || "facebook", budget, status: "Active", productId: productId || null }
    })
    return NextResponse.json(campaign)
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}