/*
  # Add Google Ads and TikTok Ads Integration to Projects

  1. New Columns
    - `google_ads_access_token` (text) - OAuth токен для доступа к Google Ads API
    - `google_ads_refresh_token` (text) - Refresh токен для обновления доступа
    - `google_ads_customer_id` (text) - ID аккаунта Google Ads (формат: 123-456-7890)
    - `google_ads_visible_metrics` (jsonb) - Массив отображаемых метрик
    - `tiktok_ads_access_token` (text) - Access Token для TikTok Ads API
    - `tiktok_ads_advertiser_id` (text) - ID рекламного аккаунта TikTok
    - `tiktok_ads_visible_metrics` (jsonb) - Массив отображаемых метрик

  2. Technical Details
    - All fields are optional and default to NULL
    - Visible metrics default to most commonly used metrics for each platform
    - Each project has isolated settings for each ad platform
*/

-- Add Google Ads fields
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS google_ads_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_ads_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_ads_customer_id TEXT,
ADD COLUMN IF NOT EXISTS google_ads_visible_metrics JSONB DEFAULT '["cost", "conversions", "cpc", "ctr", "impressions", "clicks"]'::jsonb;

-- Add TikTok Ads fields
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS tiktok_ads_access_token TEXT,
ADD COLUMN IF NOT EXISTS tiktok_ads_advertiser_id TEXT,
ADD COLUMN IF NOT EXISTS tiktok_ads_visible_metrics JSONB DEFAULT '["spend", "conversions", "cpc", "ctr", "impressions", "clicks"]'::jsonb;