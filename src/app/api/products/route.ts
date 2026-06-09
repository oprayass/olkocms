import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { withTenant } from '@/lib/with-tenant'

export const GET = withTenant(async () => {
  try {
    const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(products)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
})

export const POST = withTenant(async (req: Request) => {
  try {
    const body = await req.json()
    const product = await prisma.product.create({ data: body })
    return NextResponse.json(product)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
})