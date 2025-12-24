-- CreateTable
CREATE TABLE "game" (
    "gameId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "player1Image" TEXT,
    "player2Image" TEXT,

    CONSTRAINT "game_pkey" PRIMARY KEY ("gameId")
);

-- CreateTable
CREATE TABLE "image" (
    "imageId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageName" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,

    CONSTRAINT "image_pkey" PRIMARY KEY ("imageId")
);

-- CreateTable
CREATE TABLE "imagePool" (
    "poolId" TEXT NOT NULL,
    "poolName" TEXT NOT NULL,

    CONSTRAINT "imagePool_pkey" PRIMARY KEY ("poolId")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_gameId_key" ON "game"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "image_imageId_key" ON "image"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "image_imageUrl_key" ON "image"("imageUrl");

-- CreateIndex
CREATE UNIQUE INDEX "imagePool_poolId_key" ON "imagePool"("poolId");

-- CreateIndex
CREATE UNIQUE INDEX "imagePool_poolName_key" ON "imagePool"("poolName");

-- AddForeignKey
ALTER TABLE "image" ADD CONSTRAINT "image_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "imagePool"("poolId") ON DELETE RESTRICT ON UPDATE CASCADE;
