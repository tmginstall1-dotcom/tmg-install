CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"author" text NOT NULL,
	"location" text,
	"rating" integer DEFAULT 5 NOT NULL,
	"text" text NOT NULL,
	"review_date" text,
	"source" text DEFAULT 'google',
	"featured" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
