import { AsyncLocalStorage } from 'async_hooks'

export type TenantContext = {
  subscriptionId: string
}

const storage = new AsyncLocalStorage<TenantContext>()

export function runWithTenant<T>(subscriptionId: string, fn: () => T | Promise<T>): Promise<T> {
  if (!subscriptionId) {
    throw new Error('[tenant] runWithTenant called without a subscriptionId')
  }
  // Await INSIDE the ALS frame so lazy PrismaPromises dispatch while tenant
  // context is still active. Returning an un-awaited promise out of storage.run()
  // unwinds the frame before Prisma's query hook reads getSubscriptionId(),
  // which silently ran queries UNSCOPED in warn mode and throws in strict mode.
  return storage.run({ subscriptionId }, async () => await fn())
}

export function getTenantContext(): TenantContext | undefined {
  return storage.getStore()
}

export function getSubscriptionId(): string | undefined {
  return storage.getStore()?.subscriptionId
}