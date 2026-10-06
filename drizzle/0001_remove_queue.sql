-- Migration: 0001_remove_queue.sql
-- Description: Completely remove the legacy queue table from BarberLoo database
DROP TABLE IF EXISTS "queue" CASCADE;
