import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const scans = await prisma.darazScan.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    })
    return NextResponse.json(scans)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { darazOrderId, productName, scanType, quantity, scannedBy, notes } = await req.json()
    if (!darazOrderId || !productName || !scanType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const scan = await prisma.darazScan.create({
      data: { darazOrderId, productName, scanType, quantity: quantity || 1, scannedBy, notes }
    })

    // Auto alert for returns and failed delivery
    if (scanType === 'return' || scanType === 'failed') {
      await prisma.darazAlert.create({
        data: {
          darazOrderId,
          productName,
          alertType: scanType === 'return' ? 'Customer Return' : 'Failed Delivery',
          status: 'unresolved'
        }
      })
    }

    return NextResponse.json(scan)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to scan' }, { status: 500 })
  }
}
