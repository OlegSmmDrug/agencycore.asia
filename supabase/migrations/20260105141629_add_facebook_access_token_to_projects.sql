/*
  # Add Facebook Access Token to Projects

  1. New Columns
    - `facebook_access_token` (text) - Facebook Graph API access token for each project's ad account

  2. Notes
    - Each project can have its own Facebook Ads integration
    - Token is used to fetch ads analytics from Facebook Marketing API
*/

ALTER TABLE projects ADD COLUMN IF NOT EXISTS facebook_access_token text DEFAULT '';
