/*
  Warnings:

  - A unique constraint covering the columns `[user_id,group_id]` on the table `user_group_level` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "user_group_level_user_id_group_id_key" ON "user_group_level"("user_id", "group_id");
