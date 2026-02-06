/*
  # Auto-populate birthday from IIN

  1. Changes
    - Updates all users who have IIN but no birthday set
    - Parses the Kazakh IIN format to extract birth date
    - IIN structure: YYMMDD-C-NNNN where C is century indicator
      - C=1,2 -> 1800s, C=3,4 -> 1900s, C=5,6 -> 2000s

  2. Affected users
    - Only users where iin IS NOT NULL and birthday IS NULL
*/

UPDATE users
SET birthday = TO_DATE(
  CASE
    WHEN CAST(SUBSTRING(REPLACE(iin, ' ', '') FROM 7 FOR 1) AS INTEGER) IN (1, 2)
      THEN '18'
    WHEN CAST(SUBSTRING(REPLACE(iin, ' ', '') FROM 7 FOR 1) AS INTEGER) IN (3, 4)
      THEN '19'
    ELSE '20'
  END
  || SUBSTRING(REPLACE(iin, ' ', '') FROM 1 FOR 2)
  || '-'
  || SUBSTRING(REPLACE(iin, ' ', '') FROM 3 FOR 2)
  || '-'
  || SUBSTRING(REPLACE(iin, ' ', '') FROM 5 FOR 2),
  'YYYY-MM-DD'
)
WHERE iin IS NOT NULL
  AND iin != ''
  AND LENGTH(REPLACE(iin, ' ', '')) >= 7
  AND birthday IS NULL;