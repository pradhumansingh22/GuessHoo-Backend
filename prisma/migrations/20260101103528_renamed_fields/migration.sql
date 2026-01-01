/*
  Warnings:

  - The primary key for the `game` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `gameId` on the `game` table. All the data in the column will be lost.
  - The primary key for the `image` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `imageId` on the `image` table. All the data in the column will be lost.
  - The primary key for the `imagePool` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `poolId` on the `imagePool` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[id]` on the table `game` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `image` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `imagePool` will be added. If there are existing duplicate values, this will fail.
  - The required column `id` was added to the `game` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `id` was added to the `image` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `id` was added to the `imagePool` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropForeignKey
ALTER TABLE "image" DROP CONSTRAINT "image_imageId_fkey";

-- DropIndex
DROP INDEX "game_gameId_key";

-- DropIndex
DROP INDEX "image_imageId_key";

-- DropIndex
DROP INDEX "imagePool_poolId_key";

-- AlterTable
ALTER TABLE "game" DROP CONSTRAINT "game_pkey",
DROP COLUMN "gameId",
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "game_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "image" DROP CONSTRAINT "image_pkey",
DROP COLUMN "imageId",
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "image_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "imagePool" DROP CONSTRAINT "imagePool_pkey",
DROP COLUMN "poolId",
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "imagePool_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "game_id_key" ON "game"("id");

-- CreateIndex
CREATE UNIQUE INDEX "image_id_key" ON "image"("id");

-- CreateIndex
CREATE UNIQUE INDEX "imagePool_id_key" ON "imagePool"("id");

-- AddForeignKey
ALTER TABLE "image" ADD CONSTRAINT "image_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "imagePool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
