-- Migration: 0003_razorpay_payment_and_webhook_hardening.sql
-- Description: Razorpay payment indexes, webhook idempotency tracking, and transaction verification security

-- 1. Webhook Events Table (Persistent Webhook Idempotency & Audit Log)
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY, -- Razorpay Event ID (e.g. evt_xxxxxxxx)
  event TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  entity_id TEXT DEFAULT '',
  payload_json TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'processed',
  error_message TEXT DEFAULT '',
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Fast Payment & Order Resolution Indexes
CREATE INDEX IF NOT EXISTS appointments_rzp_payment_idx ON appointments (razorpay_payment_id);
CREATE INDEX IF NOT EXISTS appointments_rzp_order_idx ON appointments (razorpay_order_id);
CREATE INDEX IF NOT EXISTS payments_provider_payment_idx ON payments (provider_payment_id);
CREATE INDEX IF NOT EXISTS payments_provider_order_idx ON payments (provider_order_id);
CREATE INDEX IF NOT EXISTS payments_appointment_id_idx ON payments (appointment_id);
CREATE INDEX IF NOT EXISTS webhook_events_event_idx ON webhook_events (event);
CREATE INDEX IF NOT EXISTS webhook_events_entity_idx ON webhook_events (entity_id);

-- 3. Row Level Security (RLS) on Webhook Events (Admin / Service Role only)
ALTER TABLE IF EXISTS webhook_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'webhook_events_admin_only') THEN
    CREATE POLICY webhook_events_admin_only ON webhook_events
      FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
  END IF;
END $$;
