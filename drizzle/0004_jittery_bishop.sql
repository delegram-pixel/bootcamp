CREATE TABLE "note_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"note_id" text NOT NULL,
	"kind" "attachment_kind" NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"file_key" text,
	"mime" text,
	"size" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "note_attachment" ADD CONSTRAINT "note_attachment_note_id_note_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."note"("id") ON DELETE cascade ON UPDATE no action;