// Explicit synthetic inputs. These are not production authorization or real backup receipts.
export function scenario(name = 'expired-verified') {
  const input = {
    lease: {mode: 'DRY_RUN_ONLY', id: 'SYNTHETIC-LEASE-01', ref: 'SYNTHETIC-UAT-01',
      organizationId: 'SYNTHETIC-ORG-01', projectName: 'SYNTHETIC-UAT-NAME',
      candidateSHA: 'fd7efcfc6450dbf10f54aa97b65fe48e431b277d',
      protectedRefs: ['SYNTHETIC-EXISTING-PROJECT'], createdAt: '2026-11-09T00:00:00Z',
      retentionDays: 14, backupLeadHours: 48, cumulativeLimitUSD: 20},
    observed: {lookupRef: 'SYNTHETIC-UAT-01', exists: true, ref: 'SYNTHETIC-UAT-01',
      organizationId: 'SYNTHETIC-ORG-01', projectName: 'SYNTHETIC-UAT-NAME',
      lastPrimaryHeartbeat: '2026-11-23T00:00:00Z', lastMutationAt: '2026-11-20T23:59:00Z',
      actualUSD: 5, estimatedRemainingUSD: 1, activeOperation: null},
    backup: {status: 'VERIFIED', leaseId: 'SYNTHETIC-LEASE-01', ref: 'SYNTHETIC-UAT-01',
      organizationId: 'SYNTHETIC-ORG-01', candidateSHA: 'fd7efcfc6450dbf10f54aa97b65fe48e431b277d',
      manifestSHA256: 'a'.repeat(64), restoredManifestSHA256: 'a'.repeat(64),
      checkpointAt: '2026-11-21T00:00:00Z', verifiedAt: '2026-11-21T00:05:00Z',
      requiredComponents: ['db', 'private-ledgers', 'proofs', 'storage-originals', 'settings'],
      restoreTarget: 'SYNTHETIC-RESTORE-01', objectCount: 2, restoredObjectCount: 2},
    lastAttempt: null, now: '2026-11-23T00:00:00Z',
  };
  if (name === 'expired-verified') return input;
  if (name === 'backup-due') {input.now = '2026-11-21T00:00:00Z';input.backup = null;input.observed.lastPrimaryHeartbeat = input.now;return input;}
  if (name === 'expired-missing-backup') {input.backup = null;return input;}
  if (name === 'missed-primary') {input.observed.lastPrimaryHeartbeat = '2026-11-22T20:00:00Z';return input;}
  if (name === 'wrong-ref') {input.observed.ref = 'SYNTHETIC-EXISTING-PROJECT';return input;}
  throw new Error('Unknown synthetic scenario');
}
