/*
  Warnings:

  - You are about to drop the column `content` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `customerId` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `customerName` on the `Message` table. All the data in the column will be lost.
  - Added the required column `message` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `senderId` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `senderName` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Message" DROP COLUMN "content",
DROP COLUMN "customerId",
DROP COLUMN "customerName",
ADD COLUMN     "message" TEXT NOT NULL,
ADD COLUMN     "pageId" TEXT,
ADD COLUMN     "senderId" TEXT NOT NULL,
ADD COLUMN     "senderName" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'new',
ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
