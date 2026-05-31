import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const defaultPermissions = {
  Sales: {
    canViewDashboard: true, canViewOrders: true, canConfirmOrders: true,
    canViewMessages: true, canReplyMessages: true, canViewStaff: false,
    canManageStaff: false, canViewCourier: true, canManageCourier: false,
    canViewReports: false, canViewPnL: false, canCreateContent: true,
    canPostContent: false, canViewSettings: false, canManageDaraz: false,
  },
  Support: {
    canViewDashboard: true, canViewOrders: false, canConfirmOrders: false,
    canViewMessages: true, canReplyMessages: true, canViewStaff: false,
    canManageStaff: false, canViewCourier: false, canManageCourier: false,
    canViewReports: false, canViewPnL: false, canCreateContent: false,
    canPostContent: false, canViewSettings: false, canManageDaraz: false,
  },
  Manager: {
    canViewDashboard: true, canViewOrders: true, canConfirmOrders: true,
    canViewMessages: true, canReplyMessages: true, canViewStaff: true,
    canManageStaff: true, canViewCourier: true, canManageCourier: true,
    canViewReports: true, canViewPnL: false, canCreateContent: true,
    canPostContent: true, canViewSettings: false, canManageDaraz: true,
  },
  Admin: {
    canViewDashboard: true, canViewOrders: true, canConfirmOrders: true,
    canViewMessages: true, canReplyMessages: true, canViewStaff: true,
    canManageStaff: true, canViewCourier: true, canManageCourier: true,
    canViewReports: true, canViewPnL: true, canCreateContent: true,
    canPostContent: true, canViewSettings: true, canManageDaraz: true,
  },
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const subscriptionId = searchParams.get('subscriptionId')
    const where = subscriptionId ? { subscriptionId } : {}
    const staff = await prisma.staff.findMany({ where, orderBy: { createdAt: 'desc' } })
    return NextResponse.json(staff)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, email, phone, role, password, permissions, subscriptionId } = body
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null
    if (!name || !email) return NextResponse.json({ error: 'Name and email required' }, { status: 400 })
    const rolePerms = defaultPermissions[role as keyof typeof defaultPermissions] || defaultPermissions.Sales
    const finalPerms = permissions || rolePerms
    const staff = await prisma.staff.create({
      data: {
        name, email, phone,
        role: role || 'Sales',
        password: hashedPassword,
        status: 'Active',
        joinDate: new Date().toISOString().split('T')[0],
        subscriptionId: subscriptionId || null,
        ...finalPerms
      }
    })
    return NextResponse.json(staff)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    if (role !== 'ADMIN' && role !== 'admin' && role !== 'subscriber_admin') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }
    const { staffId } = await req.json()
    if (!staffId) return NextResponse.json({ error: 'staffId required' }, { status: 400 })
    const temp = Math.random().toString(36).slice(-8) + 'A1'
    const hash = await bcrypt.hash(temp, 10)
    await prisma.staff.update({ where: { id: staffId }, data: { password: hash, passwordChangedAt: new Date() } })
    return NextResponse.json({ success: true, tempPassword: temp })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}