/*
  Warnings:

  - You are about to drop the column `level` on the `exercise` table. All the data in the column will be lost.
  - You are about to drop the column `level_done` on the `exercise_progress` table. All the data in the column will be lost.
  - You are about to drop the column `level` on the `workout_exercise` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "equipment" ADD COLUMN     "image" TEXT;

-- AlterTable
ALTER TABLE "exercise" DROP COLUMN "level",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "image" TEXT;

-- AlterTable
ALTER TABLE "exercise_progress" DROP COLUMN "level_done";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "days_of_workout" INTEGER;

-- AlterTable
ALTER TABLE "workout_exercise" DROP COLUMN "level";
