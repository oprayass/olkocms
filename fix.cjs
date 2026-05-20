const fs = require('fs');
fs.mkdirSync('src/app/api/orders/[id]', { recursive: true });
const route = [
"import { NextRequest, NextResponse } from 'next/server'",
"import { prisma } from '@/lib/prisma'",
"",
"export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {",
"  try {",
"    const body = await req.json()",
"    const order = await prisma.order.update({",
"      where: { id: params.id },",
"      data: body",
"    })",
"    return NextResponse.json(order)",
"  } catch (error) {",
"    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })",
"  }",
"}",
"",
"export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {",
"  try {",
"    await prisma.order.delete({ where: { id: params.id } })",
"    return NextResponse.json({ success: true })",
"  } catch (error) {",
"    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 })",
"  }",
"}",
].join('\n');
fs.writeFileSync('src/app/api/orders/[id]/route.ts', route, 'utf8');
console.log('Orders PATCH route done!');