/*
  # Add Livedune Access Token to Projects

  1. New Columns
    - `livedune_access_token` (text) - Livedune API access token for each project's SMM analytics

  2. Notes
    - Each project can have its own Livedune integration
    - Token is used to fetch SMM analytics from Livedune API
*/

ALTER TABLE projects ADD COLUMN IF NOT EXISTS livedune_access_token text DEFAULT '';
