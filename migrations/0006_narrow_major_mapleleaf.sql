ALTER TABLE "payslips" ADD COLUMN "time_deduction" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN "time_deduction_minutes" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN "deduction_details" jsonb DEFAULT '[]'::jsonb;