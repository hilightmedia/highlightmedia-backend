CREATE OR REPLACE FUNCTION generate_validity_alerts(p_now timestamptz DEFAULT now())
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_alert_at timestamptz := date_trunc('day', p_now) + interval '7 hours';
  v_alert_date date := (p_now AT TIME ZONE 'UTC')::date;
BEGIN
  INSERT INTO "Alerts" ("folderId","type","message","at","daysLeft","alertDate","createdAt","updatedAt")
  SELECT
    fo."id" AS "folderId",
    CASE
      WHEN fo."validityEnd" < p_now THEN 'VALIDITY_COMPLETED'
      ELSE 'VALIDITY_EXPIRING'
    END AS "type",
    CASE
      WHEN fo."validityEnd" < p_now THEN (fo."name" || ' | completed')
      ELSE (fo."name" || ' | ' || CEIL(EXTRACT(EPOCH FROM (fo."validityEnd" - p_now)) / 86400.0)::int || ' days left')
    END AS "message",
    v_alert_at AS "at",
    CASE
      WHEN fo."validityEnd" < p_now THEN NULL
      ELSE CEIL(EXTRACT(EPOCH FROM (fo."validityEnd" - p_now)) / 86400.0)::int
    END AS "daysLeft",
    v_alert_date::timestamp AS "alertDate",
    now() AS "createdAt",
    now() AS "updatedAt"
  FROM "Folders" fo
  WHERE
    fo."isDeleted" = false
    AND fo."verified" = true
    AND fo."validityStart" IS NOT NULL
    AND fo."validityEnd" IS NOT NULL
    AND (
      fo."validityEnd" < p_now
      OR fo."validityEnd" <= p_now + interval '7 days'
    )
  ON CONFLICT ("folderId","type","alertDate")
  DO UPDATE SET
    "message" = EXCLUDED."message",
    "at" = EXCLUDED."at",
    "daysLeft" = EXCLUDED."daysLeft",
    "updatedAt" = now();

  DELETE FROM "Alerts"
  WHERE "alertDate" < (v_alert_date - 30)::timestamp;
END;
$$;