# BOH Vault Production cutover plan

## Final operating model

BOH Production is the single operational Vault. It stores both:

- Development items, destinations, and connections
- Production items, destinations, and connections

The item environment controls where a value may be delivered. It does not identify a separate Vault deployment.

BOH Development remains a temporary rollout source and is retired after cutover verification.

## Safety boundary

Do not copy `boh_vault_secret_versions`, tenant-key rows, wrapped keys, ciphertext, or Vault master-key configuration directly between Supabase projects. Protected values in BOH Development are encrypted for that Vault and must be encrypted again by BOH Production.

Never place protected values in SQL migrations, source files, command history, logs, tickets, email, or chat.

## Phase 1: Prepare BOH Production

1. Deploy the central multi-environment Vault code and migrations to BOH Production.
2. Configure a new BOH Production Vault master key and synchronization signing key.
3. Configure BOH Production management credentials and explicit destination allow-lists.
4. Confirm the approved Vault administrators have both Development and Production access.
5. Verify the Vault shows separate Development and Production inventory tabs.
6. Keep all Production connections absent or disabled during preparation.

## Phase 2: Recreate non-secret inventory

For every item in BOH Development:

1. Create the matching item in BOH Production.
2. Preserve its environment, display name, provider, description, reference name, and item type.
3. Recreate plaintext fields such as website URL and username where applicable.
4. Do not copy encrypted database rows.
5. Record completion in a migration checklist using item names only, never protected values.

## Phase 3: Re-enter protected values

Because the current inventory is small, use controlled one-at-a-time re-entry rather than a bulk plaintext export:

1. Open the source item in BOH Development.
2. Reveal or copy one protected value only when its matching BOH Production item is ready.
3. Enter it immediately into the matching BOH Production item.
4. Clear the clipboard after each value.
5. Confirm BOH Production reports the item as configured.
6. Hide the source value before moving to the next item.

For Production credentials that do not yet exist, create them directly in the central BOH Production Vault as Production items. Do not first store them in BOH Development.

## Phase 4: Recreate Development delivery

1. Add approved Development destinations in BOH Production.
2. Recreate each Development connection using the exact destination secret name.
3. Synchronize one low-risk Development connection first.
4. Verify the destination and its dependent application.
5. Synchronize and verify the remaining Development connections one at a time.
6. Confirm each connection reports Synced after its current protected version is delivered.

## Phase 5: Configure Production delivery

1. Add Production destinations only after Development delivery is verified from BOH Production.
2. Confirm Production Supabase project references and Worker names are explicitly allow-listed.
3. Create Production connections only between Production items and Production destinations.
4. Synchronize one Production connection at a time.
5. Verify the destination and dependent application before continuing.
6. Do not reuse Development provider keys, Gateway tokens, Worker names, or destination records.

## Phase 6: Cut over and retire BOH Development Vault

1. Stop changing Vault values in BOH Development.
2. Compare the item-name checklist and connection-name checklist between both Vaults.
3. Verify Development applications operate using values synchronized from BOH Production.
4. Keep BOH Development read-only for a short rollback window.
5. Remove its synchronization connections and management credentials.
6. Revoke its Vault-specific management tokens.
7. Archive the temporary BOH Development Vault after sign-off.

## Rollback

If a BOH Production synchronization causes a failure:

1. Stop further synchronization.
2. Restore the previous destination value using its approved rotation or recovery process.
3. Mark the affected connection blocked until corrected.
4. Keep unrelated connections unchanged.
5. Record the failure without recording the protected value.

Do not restore encrypted BOH Development database rows into BOH Production.

## Completion criteria

- BOH Production is the only operational Vault.
- Both Development and Production inventory tabs are available.
- Every item has the correct environment.
- Every connection links an item and destination from the same environment.
- Development delivery is verified from BOH Production.
- Production delivery is verified separately.
- BOH Development synchronization credentials are revoked.
- No protected value exists in migration artifacts or logs.
