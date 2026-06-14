CREATE TABLE "quick_reply_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'general',
	"body" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "quick_reply_templates_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "quote_dispute_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"detail" text,
	"actor_type" text DEFAULT 'system',
	"actor_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "timing_mode" text DEFAULT 'continuous';--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "dismantle_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "dismantle_time_window" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "reinstall_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "reinstall_time_window" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "after_office_involved" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "after_office_surcharge_applied" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "after_office_surcharge_amount" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "after_office_waived" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "after_office_waiver_reason" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "additional_trip_charge" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "special_remarks" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "own_mover_involved" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "deposit_refundable" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "cancellation_notice_hours" integer DEFAULT 48;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "terms_accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "terms_accepted_ip" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "terms_accepted_amount" numeric;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "terms_accepted_version" integer;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "terms_accepted_pdf_ref" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "superseded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "cancellation_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "refund_approved_amount" numeric;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "refund_reason" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "refund_method" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "refund_details_received_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "refund_due_by_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "refund_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "refund_internal_note" text;--> statement-breakpoint
ALTER TABLE "quote_dispute_events" ADD CONSTRAINT "quote_dispute_events_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quote_dispute_events_quote_id_idx" ON "quote_dispute_events" USING btree ("quote_id");