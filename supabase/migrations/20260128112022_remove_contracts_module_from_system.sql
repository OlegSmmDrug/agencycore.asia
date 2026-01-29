/*
  # Remove Contracts Module from Modules System

  1. Changes
    - Remove 'contracts' module from platform_modules table
    - Remove all organization_modules entries for contracts module
  
  2. Notes
    - Organizations will no longer see contracts module in their available modules
    - This completes the full removal of contracts functionality
*/

-- Remove organization module entries for contracts
DELETE FROM organization_modules WHERE module_slug = 'contracts';

-- Remove the contracts module from platform modules
DELETE FROM platform_modules WHERE slug = 'contracts';