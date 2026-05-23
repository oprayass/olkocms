import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

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

export async function GET() {
  try {
    const staff = await prisma.staff.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(staff)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, email, phone, role, password, permissions } = body
    if (!name || !email) return NextResponse.json({ error: 'Name and email required' }, { status: 400 })
    const rolePerms = defaultPermissions[role as keyof typeof defaultPermissions] || defaultPermissions.Sales
    const finalPerms = permissions || rolePerms
    const staff = await prisma.staff.create({
      data: {
        name, email, phone,
        role: role || 'Sales',
        password: password || null,
        status: 'Active',
        joinDate: new Date().toISOString().split('T')[0],
        ...finalPerms
      }
    })
    return NextResponse.json(staff)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 })
  }
}