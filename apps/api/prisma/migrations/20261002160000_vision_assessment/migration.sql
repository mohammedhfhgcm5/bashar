-- CreateEnum
CREATE TYPE "VisionStatus" AS ENUM ('READY', 'UNAVAILABLE', 'FAILED');

-- CreateTable
CREATE TABLE "VisionAssessment" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "status" "VisionStatus" NOT NULL,
    "modelName" TEXT NOT NULL,
    "suggestedLevel" "DamageLevel",
    "confidence" DOUBLE PRECISION,
    "summary" TEXT NOT NULL DEFAULT '',
    "findings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisionAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisionAssessment_reportId_key" ON "VisionAssessment"("reportId");

-- AddForeignKey
ALTER TABLE "VisionAssessment" ADD CONSTRAINT "VisionAssessment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
