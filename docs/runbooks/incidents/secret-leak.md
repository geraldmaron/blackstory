# Secret leak

## Trigger and triage

- Trigger on secret scanning, public logs/artifacts, anomalous provider use, or reported disclosure.
- Treat the secret as compromised; identify its principal, permissions, copies, and exposure window without reproducing its value.

## Contain

1. Engage the matching workload switch.
2. Revoke or disable only the exposed key, token, signing key, or service-account binding.
3. Revoke derived sessions and pause affected queues; never purge.
4. Freeze publication if the credential could sign, promote, or mutate releases.

## Recover

- Issue a least-privilege replacement through Secret Manager/1Password or native identity login.
- Remove exposed material from artifacts and history where feasible; assume deletion does not undo disclosure.
- Audit use during the exposure window, canary the replacement, then re-enable the workload.
