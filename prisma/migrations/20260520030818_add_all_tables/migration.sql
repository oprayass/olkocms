/*
  Warnings:

  - A unique constraint covering the columns `[orderId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `orderId` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "replied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "replyText" TEXT,
ADD COLUMN     "staffId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "orderId" TEXT NOT NULL,
ADD COLUMN     "platform" TEXT,
ADD COLUMN     "staffId" TEXT,
ALTER COLUMN "address" DROP NOT NULL,
ALTER COLUMN "quantity" SET DEFAULT 1,
ALTER COLUMN "status" SET DEFAULT 'Pending';

-- CreateTable
CREATE TABLE "Followup" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "lastMsg" TEXT,
    "followupDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Upcoming',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Followup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "courier" TEXT NOT NULL,
    "tracking" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending Pickup',
    "charge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimated" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'Sales',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "password" TEXT,
    "joinDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Staff_email_key" ON "Staff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderId_key" ON "Order"("orderId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
