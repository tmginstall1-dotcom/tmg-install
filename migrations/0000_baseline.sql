CREATE TABLE "ai_ad_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" text,
	"action" text NOT NULL,
	"risk_level" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"target_name" text,
	"reason" text,
	"source_data" jsonb,
	"confidence" numeric(5, 2),
	"expected_effect" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by" text,
	"approved_at" timestamp,
	"applied_at" timestamp,
	"rollback_info" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_ads_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"snapshot_date" text NOT NULL,
	"campaign_id" text,
	"campaign_name" text,
	"ad_set_id" text,
	"ad_set_name" text,
	"ad_id" text,
	"ad_name" text,
	"keyword" text,
	"match_type" text,
	"spend" numeric(10, 2),
	"impressions" integer,
	"clicks" integer,
	"conversions" numeric(10, 2),
	"conversion_value" numeric(10, 2),
	"ctr" numeric(10, 4),
	"cpc" numeric(10, 4),
	"cpl" numeric(10, 4),
	"quality_score" integer,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_approval_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"queue_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"risk_level" text NOT NULL,
	"confidence" numeric(5, 2),
	"expected_impact" text,
	"proposed_action" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"review_note" text,
	"ref_type" text,
	"ref_id" integer,
	"rollback_path" text,
	"execution_status" text,
	"executed_at" timestamp,
	"executed_by" text,
	"execution_result" jsonb,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ai_attribution_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_id" integer,
	"reference_no" text,
	"event_type" text NOT NULL,
	"source" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"landing_page" text,
	"quote_value" numeric(10, 2),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"action_type" text NOT NULL,
	"actor" text,
	"module" text,
	"summary" text,
	"detail" jsonb,
	"outcome" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_connector_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"last_sync_at" timestamp,
	"last_sync_status" text DEFAULT 'never' NOT NULL,
	"sync_error" text,
	"account_id" text,
	"extra_config" jsonb,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "ai_connector_configs_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "ai_feature_flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" boolean DEFAULT false NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" text,
	CONSTRAINT "ai_feature_flags_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "ai_llm_calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent" text NOT NULL,
	"model" text NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"cost_sgd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"success" boolean DEFAULT false NOT NULL,
	"error_message" text,
	"schema_repaired" boolean DEFAULT false NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_pagespeed_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"strategy" text DEFAULT 'mobile' NOT NULL,
	"performance_score" integer,
	"accessibility_score" integer,
	"seo_score" integer,
	"best_practices_score" integer,
	"fcp_ms" integer,
	"lcp_ms" integer,
	"cls_score" numeric(10, 4),
	"ttfb_ms" integer,
	"raw_audits" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_platform_executions" (
	"id" serial PRIMARY KEY NOT NULL,
	"approval_queue_id" integer NOT NULL,
	"recommendation_id" integer,
	"platform" text NOT NULL,
	"action_type" text NOT NULL,
	"target_object_ids" jsonb,
	"proposed_change" jsonb,
	"executed_change" jsonb,
	"actor" text DEFAULT 'system' NOT NULL,
	"result_status" text DEFAULT 'pending' NOT NULL,
	"platform_response_summary" text,
	"platform_response_raw" jsonb,
	"rollback_path" text,
	"rollback_payload" jsonb,
	"error_message" text,
	"test_mode" boolean DEFAULT false NOT NULL,
	"rolled_back_at" timestamp,
	"rolled_back_by" text,
	"rollback_status" text,
	"rollback_error" text,
	"baseline_metric" jsonb,
	"self_healing_checked_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_search_console_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"sync_id" text,
	"date" text NOT NULL,
	"query" text,
	"page" text,
	"country" text,
	"device" text,
	"clicks" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"ctr" numeric(10, 4),
	"position" numeric(10, 2),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_site_audits" (
	"id" serial PRIMARY KEY NOT NULL,
	"audit_type" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"score" integer,
	"summary" text,
	"findings" jsonb,
	"triggered_by" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ai_site_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"audit_id" integer,
	"category" text NOT NULL,
	"priority" text NOT NULL,
	"page" text,
	"title" text NOT NULL,
	"description" text,
	"suggested_change" text,
	"risk_level" text DEFAULT 'low' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"approved_by" text,
	"applied_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_spend_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"sgd_delta" numeric(12, 2) DEFAULT '0' NOT NULL,
	"execution_id" integer,
	"action_type" text,
	"campaign_name" text,
	"decision" text DEFAULT 'allowed' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_whatsapp_followups" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"followup_type" text NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"sent_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"message_preview" text,
	"skip_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_whatsapp_handoffs" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"reason" text NOT NULL,
	"handed_at" timestamp DEFAULT now(),
	"handed_by" text DEFAULT 'ai',
	"notes" text,
	"resumed_at" timestamp,
	"resumed_by" text
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "attendance_amendments" (
	"id" serial PRIMARY KEY NOT NULL,
	"attendance_log_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"original_clock_in" timestamp,
	"original_clock_out" timestamp,
	"requested_clock_in" timestamp,
	"requested_clock_out" timestamp,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "attendance_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"clock_in_at" timestamp NOT NULL,
	"clock_out_at" timestamp,
	"clock_in_lat" numeric,
	"clock_in_lng" numeric,
	"clock_out_lat" numeric,
	"clock_out_lng" numeric,
	"notes" text,
	"deduction_minutes" integer DEFAULT 0 NOT NULL,
	"deduction_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "blocked_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"time_slot" text,
	"reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "canned_replies" (
	"id" serial PRIMARY KEY NOT NULL,
	"shortcut" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "canned_replies_shortcut_unique" UNIQUE("shortcut")
);
--> statement-breakpoint
CREATE TABLE "catalog_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"category" text,
	"service_type" text NOT NULL,
	"base_price" numeric NOT NULL,
	"volume_m3" numeric,
	"active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "customer_ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_id" integer,
	"phone" text NOT NULL,
	"rating" integer,
	"comment" text,
	"source" text DEFAULT 'whatsapp' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"prompted_at" timestamp DEFAULT now(),
	"answered_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "customer_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"company_name" text,
	"company_uen" text,
	"billing_address" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "faq_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ggv_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"vehicle_group" text DEFAULT 'TMG1 GGV 029' NOT NULL,
	"vehicle_type" text DEFAULT 'EV VAN' NOT NULL,
	"job_no" text,
	"booking_ref" text,
	"time_start" text,
	"time_end" text,
	"listed_price" numeric,
	"deduction" numeric DEFAULT '0',
	"actual_price" numeric,
	"service_type" text,
	"remarks" text,
	"address" text,
	"postal_code" text,
	"distance_km" numeric,
	"rate_per_km" numeric,
	"flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gps_track_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"lat" numeric(10, 7) NOT NULL,
	"lng" numeric(10, 7) NOT NULL,
	"accuracy" numeric,
	"speed" numeric,
	"heading" numeric,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_checklists" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_id" integer NOT NULL,
	"item" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"done_at" timestamp,
	"done_by_user_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_subcontracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_id" integer NOT NULL,
	"subcontractor_id" integer NOT NULL,
	"agreed_cost" numeric NOT NULL,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"paid_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_id" integer NOT NULL,
	"status_change" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" integer,
	"note" text,
	"photo_url" text,
	"gps_lat" numeric,
	"gps_lng" numeric,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"leave_type" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"total_days" numeric NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partial_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"resume_token" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"phone" text,
	"services" jsonb,
	"service_address" text,
	"pickup_address" text,
	"dropoff_address" text,
	"items" jsonb,
	"slot_date_str" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"email_sent_at" timestamp,
	"whatsapp_sent_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"last_active_at" timestamp DEFAULT now(),
	CONSTRAINT "partial_leads_resume_token_unique" UNIQUE("resume_token")
);
--> statement-breakpoint
CREATE TABLE "payslips" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"regular_hours" numeric DEFAULT '0',
	"overtime_hours" numeric DEFAULT '0',
	"basic_pay" numeric DEFAULT '0',
	"regular_pay" numeric DEFAULT '0',
	"overtime_pay" numeric DEFAULT '0',
	"meal_allowance" numeric DEFAULT '0',
	"transport_allowance" numeric DEFAULT '0',
	"leave_deduction" numeric DEFAULT '0',
	"loan_deduction" numeric DEFAULT '0',
	"gross_pay" numeric DEFAULT '0',
	"notes" text,
	"generated_by" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pricing_corrections" (
	"id" serial PRIMARY KEY NOT NULL,
	"detected_description" text NOT NULL,
	"corrected_name" text NOT NULL,
	"catalog_item_name" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"auto_learned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"discount_amount" numeric DEFAULT '50' NOT NULL,
	"max_uses" integer DEFAULT 100 NOT NULL,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"min_order_amount" numeric DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_id" integer NOT NULL,
	"catalog_item_id" integer,
	"original_description" text NOT NULL,
	"detected_name" text,
	"remark" text,
	"service_type" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric DEFAULT '0' NOT NULL,
	"subtotal" numeric DEFAULT '0' NOT NULL,
	"from_stop_id" text,
	"to_stop_id" text
);
--> statement-breakpoint
CREATE TABLE "quote_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"quote_id" integer NOT NULL,
	"amount" numeric NOT NULL,
	"method" text DEFAULT 'cash' NOT NULL,
	"note" text,
	"paid_at" timestamp DEFAULT now() NOT NULL,
	"recorded_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference_no" text NOT NULL,
	"legacy_reference_nos" text[],
	"customer_id" integer,
	"service_address" text NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"source_channel" text DEFAULT 'web',
	"customer_whatsapp_phone" text,
	"subtotal" numeric DEFAULT '0',
	"discount" numeric DEFAULT '0',
	"transport_fee" numeric DEFAULT '0',
	"volumetric_fee" numeric DEFAULT '0',
	"total" numeric DEFAULT '0',
	"ai_confidence_score" integer,
	"requires_manual_review" boolean DEFAULT true,
	"pickup_address" text,
	"dropoff_address" text,
	"stops" jsonb DEFAULT '[]'::jsonb,
	"access_difficulty" text,
	"floors_info" text,
	"selected_services" text,
	"assigned_staff_id" integer,
	"assigned_team_id" integer,
	"scheduled_at" timestamp,
	"time_window" text,
	"booking_requested_at" timestamp,
	"rescheduled_count" integer DEFAULT 0,
	"preferred_date" text,
	"preferred_time_window" text,
	"slot_held_until" timestamp,
	"deposit_amount" numeric DEFAULT '0',
	"deposit_paid_at" timestamp,
	"final_amount" numeric DEFAULT '0',
	"final_paid_at" timestamp,
	"payment_status" text DEFAULT 'unpaid',
	"distance_km" numeric,
	"promo_code" text,
	"promo_discount" numeric DEFAULT '0',
	"additional_charge" numeric DEFAULT '0',
	"additional_charge_note" text,
	"notes" text,
	"detection_photo_url" text,
	"loyalty_discount" numeric DEFAULT '0',
	"goodwill_discount" numeric DEFAULT '0',
	"goodwill_reason" text,
	"relocation_mode" text,
	"same_property_move" boolean DEFAULT false NOT NULL,
	"day_before_reminder_at" timestamp,
	"staff_transport_allowance" boolean DEFAULT false,
	"second_day_continuation" boolean DEFAULT false,
	"second_day_hours" numeric DEFAULT '0',
	"second_day_crew_size" integer DEFAULT 2,
	"site_visits" jsonb DEFAULT '[]'::jsonb,
	"invoice_type" text DEFAULT 'residential',
	"billing_address" text,
	"billing_company_name" text,
	"billing_company_uen" text,
	"po_number" text,
	"commercial_invoice_sent_at" timestamp,
	"phase_completions" jsonb DEFAULT '[]'::jsonb,
	"completion_signature_url" text,
	"completion_signed_name" text,
	"completion_signed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "quotes_reference_no_unique" UNIQUE("reference_no")
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"receipt_date" text NOT NULL,
	"amount" numeric NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"file_data" text NOT NULL,
	"file_type" text NOT NULL,
	"file_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_note" text,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "site_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"page" text,
	"label" text,
	"referrer" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"session_id" text,
	"country" text,
	"country_code" text,
	"city" text,
	"latitude" text,
	"longitude" text,
	"device_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text NOT NULL,
	"previous_value" text,
	"page" text,
	"field" text,
	"source" text DEFAULT 'ai_agent',
	"updated_at" timestamp DEFAULT now(),
	"updated_by" text,
	CONSTRAINT "site_settings_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
CREATE TABLE "staff_loans" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"description" text NOT NULL,
	"total_amount" numeric NOT NULL,
	"monthly_repayment" numeric NOT NULL,
	"remaining_balance" numeric NOT NULL,
	"start_date" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subcontractors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"company" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"name" text NOT NULL,
	"team_id" integer,
	"phone" text,
	"email" text,
	"nric_fin" text,
	"start_date" text,
	"emergency_name" text,
	"emergency_phone" text,
	"pay_type" text DEFAULT 'hourly',
	"monthly_rate" numeric DEFAULT '0',
	"hourly_rate" numeric DEFAULT '0',
	"overtime_rate" numeric DEFAULT '0',
	"annual_leave_entitlement" integer DEFAULT 14,
	"fcm_token" text,
	"clock_in_time" text,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"direction" text NOT NULL,
	"body" text NOT NULL,
	"media_type" text,
	"media_url" text,
	"wamid" text,
	"sent_by" text DEFAULT 'bot',
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "whatsapp_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"state" text DEFAULT 'awaiting_name' NOT NULL,
	"collected_name" text,
	"collected_email" text,
	"collected_address" text,
	"collected_items" text,
	"previous_items" text,
	"preferred_date" text,
	"preferred_date_iso" text,
	"preferred_time_window" text,
	"is_relocation" boolean DEFAULT false,
	"collected_to_address" text,
	"distance_km" numeric,
	"floor_level" integer DEFAULT 1,
	"has_lift" boolean DEFAULT true,
	"access_difficulty" text DEFAULT 'easy',
	"conversation_history" text,
	"special_remarks" text,
	"structured_state" text,
	"bot_paused" boolean DEFAULT false,
	"bot_paused_at" timestamp,
	"ai_state" text DEFAULT 'new_lead',
	"ai_ownership" text DEFAULT 'ai',
	"last_inbound_at" timestamp,
	"window_open" boolean DEFAULT true,
	"template_mode_only" boolean DEFAULT false,
	"confidence_score" numeric(4, 2),
	"case_facts" text,
	"missing_facts" text,
	"handoff_reason" text,
	"followup_scheduled" boolean DEFAULT false,
	"lead_score" integer DEFAULT 0,
	"lead_score_reasons" text,
	"hot_lead_alerted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "whatsapp_sessions_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "attendance_amendments" ADD CONSTRAINT "attendance_amendments_attendance_log_id_attendance_logs_id_fk" FOREIGN KEY ("attendance_log_id") REFERENCES "public"."attendance_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_amendments" ADD CONSTRAINT "attendance_amendments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_amendments" ADD CONSTRAINT "attendance_amendments_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gps_track_points" ADD CONSTRAINT "gps_track_points_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_checklists" ADD CONSTRAINT "job_checklists_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_checklists" ADD CONSTRAINT "job_checklists_done_by_user_id_users_id_fk" FOREIGN KEY ("done_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_subcontracts" ADD CONSTRAINT "job_subcontracts_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_subcontracts" ADD CONSTRAINT "job_subcontracts_subcontractor_id_subcontractors_id_fk" FOREIGN KEY ("subcontractor_id") REFERENCES "public"."subcontractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_updates" ADD CONSTRAINT "job_updates_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_payments" ADD CONSTRAINT "quote_payments_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_payments" ADD CONSTRAINT "quote_payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_assigned_team_id_teams_id_fk" FOREIGN KEY ("assigned_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_loans" ADD CONSTRAINT "staff_loans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_pagespeed_strategy_idx" ON "ai_pagespeed_data" USING btree ("strategy","created_at");--> statement-breakpoint
CREATE INDEX "ai_gsc_sync_id_idx" ON "ai_search_console_data" USING btree ("sync_id");--> statement-breakpoint
CREATE INDEX "ai_gsc_clicks_idx" ON "ai_search_console_data" USING btree ("clicks");--> statement-breakpoint
CREATE INDEX "ai_whatsapp_followups_phone_idx" ON "ai_whatsapp_followups" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "ai_whatsapp_followups_status_idx" ON "ai_whatsapp_followups" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "ai_whatsapp_handoffs_phone_idx" ON "ai_whatsapp_handoffs" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "attendance_amendments_user_id_idx" ON "attendance_amendments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "attendance_amendments_status_idx" ON "attendance_amendments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "attendance_logs_user_id_idx" ON "attendance_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "attendance_logs_clock_in_idx" ON "attendance_logs" USING btree ("clock_in_at");--> statement-breakpoint
CREATE INDEX "customer_tokens_email_idx" ON "customer_tokens" USING btree ("email");--> statement-breakpoint
CREATE INDEX "gps_track_points_user_id_idx" ON "gps_track_points" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gps_track_points_recorded_at_idx" ON "gps_track_points" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "job_checklists_quote_id_idx" ON "job_checklists" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "job_subcontracts_quote_idx" ON "job_subcontracts" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "job_subcontracts_sub_idx" ON "job_subcontracts" USING btree ("subcontractor_id");--> statement-breakpoint
CREATE INDEX "job_updates_quote_id_idx" ON "job_updates" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "leave_requests_user_id_idx" ON "leave_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "leave_requests_status_idx" ON "leave_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "partial_leads_token_idx" ON "partial_leads" USING btree ("resume_token");--> statement-breakpoint
CREATE INDEX "partial_leads_status_idx" ON "partial_leads" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "quote_items_quote_id_idx" ON "quote_items" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "quotes_status_idx" ON "quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quotes_customer_id_idx" ON "quotes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "quotes_created_at_idx" ON "quotes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "quotes_scheduled_at_idx" ON "quotes" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "quotes_assigned_team_id_idx" ON "quotes" USING btree ("assigned_team_id");--> statement-breakpoint
CREATE INDEX "quotes_assigned_staff_id_idx" ON "quotes" USING btree ("assigned_staff_id");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_phone_idx" ON "whatsapp_messages" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_created_at_idx" ON "whatsapp_messages" USING btree ("created_at");