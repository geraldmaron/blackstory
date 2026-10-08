-- The authenticated console already owns product DML. Its session-research operations
-- enter the narrower ledger role, just as the hosted researcher does.
-- Membership is one-way: research_worker receives no admin or publication capability.
GRANT research_worker TO admin_app;
