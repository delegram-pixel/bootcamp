ALTER TABLE "group" ADD COLUMN "join_code" text;--> statement-breakpoint
ALTER TABLE "group" ADD CONSTRAINT "group_join_code_unique" UNIQUE("join_code");