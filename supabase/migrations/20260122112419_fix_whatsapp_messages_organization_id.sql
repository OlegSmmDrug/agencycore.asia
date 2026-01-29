/*
  # Fix WhatsApp Messages Organization ID
  
  1. Problem
    - 245 WhatsApp messages have organization_id = NULL
    - These messages are not visible in the UI because queries filter by organization_id
  
  2. Solution
    - Update whatsapp_messages.organization_id from related clients.organization_id
    - This ensures all messages are associated with the correct organization
  
  3. Changes
    - Updates organization_id for messages where it's NULL
    - Links messages to organizations through the client_id foreign key
*/

-- Update organization_id for messages where it's NULL by getting it from the client
UPDATE whatsapp_messages
SET organization_id = clients.organization_id
FROM clients
WHERE whatsapp_messages.client_id = clients.id
  AND whatsapp_messages.organization_id IS NULL
  AND clients.organization_id IS NOT NULL;

-- For any remaining messages without organization_id (where client doesn't have org_id either),
-- set to the default/legacy organization if needed
-- First, let's get the most common organization_id from existing chats
DO $$
DECLARE
  default_org_id UUID;
BEGIN
  -- Get the most frequently used organization_id from whatsapp_chats
  SELECT organization_id INTO default_org_id
  FROM whatsapp_chats
  WHERE organization_id IS NOT NULL
  GROUP BY organization_id
  ORDER BY COUNT(*) DESC
  LIMIT 1;
  
  -- If we found a default org, update remaining NULL messages
  IF default_org_id IS NOT NULL THEN
    UPDATE whatsapp_messages
    SET organization_id = default_org_id
    WHERE organization_id IS NULL;
  END IF;
END $$;
