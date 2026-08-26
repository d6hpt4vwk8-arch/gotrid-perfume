-- CreateTable
CREATE TABLE "ScentNotePhoto" (
    "id" TEXT NOT NULL,
    "noteName" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'unsplash',
    "sourcePhotoId" TEXT,
    "attributionName" TEXT,
    "attributionUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScentNotePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScentNotePhoto_noteName_key" ON "ScentNotePhoto"("noteName");

