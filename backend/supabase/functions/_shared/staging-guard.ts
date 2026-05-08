export function currentRuntimeEnv(): string {
  return (Deno.env.get('APP_ENV') || Deno.env.get('ENV') || 'staging').toLowerCase();
}

export function externalActionsBlockedInCurrentEnv(): boolean {
  return currentRuntimeEnv() !== 'production';
}

export function externalGuardWarning() {
  if (!externalActionsBlockedInCurrentEnv()) return null;

  return {
    code: 'EXTERNAL_ACTIONS_BLOCKED',
    message: 'External integrations are blocked outside production',
  };
}
