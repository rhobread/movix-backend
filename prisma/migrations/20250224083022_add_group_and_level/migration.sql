/*
  Warnings:

  - Added the required column `email` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "password" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "group" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_group_level" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "level" INTEGER,

    CONSTRAINT "user_group_level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "excercise_group" (
    "id" SERIAL NOT NULL,
    "excercise_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    "difficulty" INTEGER,

    CONSTRAINT "excercise_group_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "user_group_level" ADD CONSTRAINT "user_group_level_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_level" ADD CONSTRAINT "user_group_level_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excercise_group" ADD CONSTRAINT "excercise_group_excercise_id_fkey" FOREIGN KEY ("excercise_id") REFERENCES "exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excercise_group" ADD CONSTRAINT "excercise_group_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
