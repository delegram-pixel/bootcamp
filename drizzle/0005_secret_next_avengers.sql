CREATE TABLE "earned_badge" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"badge_key" text NOT NULL,
	"earned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "earned_badge_user_key_uq" UNIQUE("user_id","badge_key")
);
--> statement-breakpoint
ALTER TABLE "earned_badge" ADD CONSTRAINT "earned_badge_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;