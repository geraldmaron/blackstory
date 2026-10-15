-- Run through the local migration owner's psql connection; every change rolls back.
BEGIN;
INSERT INTO submissions.intake_items(id,created_by,kind,payload) VALUES
 ('editorial-privacy-private','00000000-0000-4000-8000-000000000001','entity_editorial','{"proposal":{"entityId":"privacy-test"}}'),
 ('editorial-privacy-public','00000000-0000-4000-8000-000000000001','correction','{"message":"Controlled receipt fixture"}');
SET LOCAL ROLE web_public;
DO $$
DECLARE affected integer;
BEGIN
 IF NOT EXISTS(SELECT id FROM submissions.intake_items WHERE id='editorial-privacy-public') THEN
   RAISE EXCEPTION 'Control correction should be readable by the receipt service';
 END IF;
 IF EXISTS(SELECT id FROM submissions.intake_items WHERE id='editorial-privacy-private') THEN
   RAISE EXCEPTION 'Private editorial proposal leaked through receipt permissions';
 END IF;
 UPDATE submissions.intake_items SET payload='{}'::jsonb WHERE id='editorial-privacy-private';
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected <> 0 THEN RAISE EXCEPTION 'Receipt service changed a private proposal'; END IF;
 BEGIN
   INSERT INTO submissions.intake_items(id,created_by,kind,payload) VALUES
    ('editorial-privacy-forged','00000000-0000-4000-8000-000000000001','entity_editorial','{}');
   RAISE EXCEPTION 'Receipt service forged a private proposal';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   PERFORM id FROM reference.articles;
   RAISE EXCEPTION 'Public credential read private article drafts';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;
ROLLBACK;
