-- Migration: Add live tracking fields to drivers table
-- Run this once in Supabase SQL Editor

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS tracking_url     TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS tracking_enabled BOOLEAN DEFAULT FALSE;
