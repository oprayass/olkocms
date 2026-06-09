import { PrismaClient } from '@prisma/client'
import { getSubscriptionId } from './tenant-context'

const ENFORCEMENT: 'warn' | 'strict' =
  process.env.TENANT_ENFORCEMENT === 'strict' ? 'strict' : 'warn'

const SCOPED_MODELS = new Set<string>([
  'Order', 'Message', 'Followup', 'Shipment', 'Content', 'Transaction',
  'DarazStore', 'DarazOrder', 'DarazOrderItem', 'ActivityLog', 'Product',
  'AdCampaign', 'AdExpense', 'AdOrder', 'AIConversation', 'DarazScan',
  'DarazAlert', 'DarazClaim',
])

const WHERE_OPS = new Set<string>([
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow',
  'findMany', 'count', 'aggregate', 'groupBy',
  'update', 'updateMany', 'delete', 'deleteMany',
])

function buildClients() {
  const base = new PrismaClient()

  const scoped = base.$extends({
    name: 'tenant-auto-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !SCOPED_MODELS.has(model)) {
            return query(args)
          }

          const subId = getSubscriptionId()

          if (!subId) {
            if (ENFORCEMENT === 'strict') {
              throw new Error(
                `[tenant] blocked "${operation}" on ${model}: no tenant context. ` +
                  `Wrap the handler in withTenant(), or use prismaUnscoped for an ` +
                  `intentional cross-tenant operation.`
              )
            }
            console.warn(
              `[tenant] WARN: "${operation}" on ${model} ran with no tenant context ` +
                `(passing through UNSCOPED). Wrap its route in withTenant().`
            )
            return query(args)
          }

          const a: any = args ?? {}

          if (WHERE_OPS.has(operation)) {
            a.where = { ...(a.where ?? {}), subscriptionId: subId }
          }
          if (operation === 'create') {
            a.data = { ...(a.data ?? {}), subscriptionId: subId }
          }
          if (operation === 'createMany' || operation === 'createManyAndReturn') {
            if (Array.isArray(a.data)) {
              a.data = a.data.map((d: any) => ({ ...d, subscriptionId: subId }))
            } else if (a.data) {
              a.data = { ...a.data, subscriptionId: subId }
            }
          }
          if (operation === 'upsert') {
            a.where = { ...(a.where ?? {}), subscriptionId: subId }
            a.create = { ...(a.create ?? {}), subscriptionId: subId }
          }

          return query(a)
        },
      },
    },
  })

  return { base, scoped }
}

const globalForPrisma = globalThis as unknown as {
  __prismaBase?: PrismaClient
  __prismaScoped?: ReturnType<typeof buildClients>['scoped']
}

const clients =
  globalForPrisma.__prismaBase && globalForPrisma.__prismaScoped
    ? { base: globalForPrisma.__prismaBase, scoped: globalForPrisma.__prismaScoped }
    : buildClients()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prismaBase = clients.base
  globalForPrisma.__prismaScoped = clients.scoped
}

export const prisma = clients.scoped
export const prismaUnscoped = clients.base