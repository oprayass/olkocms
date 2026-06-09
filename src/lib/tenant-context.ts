import { AsyncLocalStorage } from 'async_hooks'

export type TenantContext = {
  subscriptionId: string
}

const storage = new AsyncLocalStorage<TenantContext>()

export function runWithTenant<T>(subscriptionId: string, fn: () => T): T {
  if (!subscriptionId) {
    throw new Error('[tenant] runWithTenant called without a subscriptionId')
  }
  return storage.run({ subscriptionId }, fn)
}

export function getTenantContext(): TenantContext | undefined {
  return storage.getStore()
}

export function getSubscriptionId(): string | undefined {
  return storage.getStore()?.subscriptionId
}