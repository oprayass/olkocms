import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { campaignId, type, amount, description } = body
    if (!campaignId || !amount) return NextResponse.json({ error: "Required fields missing" }, { status: 400 })

    const expense = await prisma.adExpense.create({
      data: { campaignId, type, amount, description: description || null }
    })

    // Campaign spent amount update गर्ने
    await prisma.adCampaign.update({
      where: { id: campaignId },
      data: { spent: { increment: amount } }
    })

    return NextResponse.json(expense)
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}