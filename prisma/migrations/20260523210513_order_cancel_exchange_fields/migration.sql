-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "isCancelledAtDoor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isExchange" BOOLEAN NOT NULL DEFAULT false;
