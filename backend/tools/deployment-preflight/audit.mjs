export function auditStatus({ requestedCommit, sourceCommit, reportedStatus, checks }) {
  const failures = Object.entries(checks).filter(([, valid]) => valid !== true).map(([name]) => name);
  if (requestedCommit !== sourceCommit) failures.push('sourceCommit');
  return { status: failures.length ? 'EVIDENCE_INTEGRITY_FAILED' : reportedStatus, failures };
}
