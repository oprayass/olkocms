-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "darazOrderId" TEXT,
ADD COLUMN     "darazPlatform" TEXT,
ADD COLUMN     "darazStatus" TEXT;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "canConfirmOrders" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canCreateContent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageCourier" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageDaraz" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageStaff" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canPostContent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReplyMessages" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canViewCourier" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canViewDashboard" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canViewMessages" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canViewOrders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canViewPnL" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canViewReports" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canViewSettings" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canViewStaff" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DarazStore" (
    "id" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "sellerId" TEXT,
    "accessToken" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DarazStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DarazOrder" (
    "id" TEXT NOT NULL,
    "darazOrderId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "trackingNo" TEXT,
    "returnStatus" TEXT,
    "paymentStatus" TEXT,
    "storeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DarazOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DarazOrder_darazOrderId_key" ON "DarazOrder"("darazOrderId");
