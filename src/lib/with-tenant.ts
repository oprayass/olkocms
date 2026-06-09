import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { runWithTenant } from './tenant-context'

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export function withTenant<Args extends any[]>(
  handler: (...args: Args) => Promise<Response> | Response
) {
  return async (...args: Args): Promise<Response> => {
    const session = await getServerSession(authOptions)
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }
    const subscriptionId = (session.user as any)?.subscriptionId as string | null | undefined
    if (!subscriptionId) {
      return jsonResponse({ error: 'No subscription bound to this account' }, 403)
    }
    return runWithTenant(subscriptionId, () => handler(...args))
  }
}

export async function withTenantFromSession<T>(fn: () => Promise<T> | T): Promise<T> {
  const session = await getServerSession(authOptions)
  const subscriptionId = (session?.user as any)?.subscriptionId as string | undefined
  if (!subscriptionId) {
    throw new Error('[tenant] withTenantFromSession: no subscriptionId in session')
  }
  return runWithTenant(subscriptionId, fn)
}

export function withExplicitTenant<T>(subscriptionId: string, fn: () => Promise<T> | T): Promise<T> | T {
  if (!subscriptionId) {
    throw new Error('[tenant] withExplicitTenant: subscriptionId is required')
  }
  return runWithTenant(subscriptionId, fn)
}