# Deployment credential rotation

Inventory workflow secret names and each current consumer before removing a credential. Never
print its value. Verify the replacement identity using the actual deployment path, revoke the
old credential, then confirm dependent jobs still authenticate. Remove unused secret references
and rotate any credential exposed in logs or artifacts.

Vercel and Supabase are the supported application services. A retired provider credential is
not a reason to restore its deployment scripts. Deleting external accounts or retained data is
a separate operation requiring an inventory and a verified recovery copy.
