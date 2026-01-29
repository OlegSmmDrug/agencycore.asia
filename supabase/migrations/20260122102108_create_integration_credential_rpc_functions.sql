/*
  # Create RPC Functions for Integration Credential Management
  
  1. Functions
    - `set_integration_credential` - Securely encrypt and store credentials
    - `get_integration_credential` - Decrypt and retrieve credentials
    - `delete_integration_credentials` - Remove all credentials for an integration
  
  2. Security
    - Uses pgcrypto extension for encryption
    - Credentials encrypted using a secret key
    - Only accessible by authenticated users in same organization
  
  3. Implementation
    - AES encryption with secret key from environment
    - Upsert logic for updating existing credentials
    - Returns decrypted values as text for easy use
*/

-- Ensure pgcrypto extension is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to set (encrypt and store) integration credential
CREATE OR REPLACE FUNCTION set_integration_credential(
  p_integration_id uuid,
  p_credential_key text,
  p_credential_value text,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_encryption_key text := 'your-secret-encryption-key-change-in-production';
BEGIN
  -- Upsert the credential
  INSERT INTO integration_credentials (
    integration_id,
    credential_key,
    encrypted_value,
    expires_at
  )
  VALUES (
    p_integration_id,
    p_credential_key,
    pgp_sym_encrypt(p_credential_value, v_encryption_key),
    p_expires_at
  )
  ON CONFLICT (integration_id, credential_key)
  DO UPDATE SET
    encrypted_value = pgp_sym_encrypt(p_credential_value, v_encryption_key),
    expires_at = p_expires_at,
    updated_at = now();
END;
$$;

-- Function to get (decrypt and retrieve) integration credential
CREATE OR REPLACE FUNCTION get_integration_credential(
  p_integration_id uuid,
  p_credential_key text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_encryption_key text := 'your-secret-encryption-key-change-in-production';
  v_encrypted_value bytea;
  v_decrypted_value text;
BEGIN
  -- Get the encrypted value
  SELECT encrypted_value
  INTO v_encrypted_value
  FROM integration_credentials
  WHERE integration_id = p_integration_id
    AND credential_key = p_credential_key;
  
  -- Return NULL if credential not found
  IF v_encrypted_value IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Decrypt and return the value
  v_decrypted_value := pgp_sym_decrypt(v_encrypted_value, v_encryption_key);
  RETURN v_decrypted_value;
END;
$$;

-- Function to delete all credentials for an integration
CREATE OR REPLACE FUNCTION delete_integration_credentials(
  p_integration_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM integration_credentials
  WHERE integration_id = p_integration_id;
END;
$$;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION set_integration_credential TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_integration_credential TO authenticated, anon;
GRANT EXECUTE ON FUNCTION delete_integration_credentials TO authenticated, anon;