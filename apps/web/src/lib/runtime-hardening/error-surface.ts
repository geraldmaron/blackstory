/**
 * Production-safe client error surfacing for the public web (BB-022).
 * Never expose stack traces, env vars, or internal paths to end users.
 */

export type ClientErrorDisplay = {
  readonly title: string;
  readonly detail: string;
  readonly digest?: string | undefined;
  readonly logDetail?: string | undefined;
};

function runtimeAppEnv(): string {
  return process.env.NEXT_PUBLIC_APP_ENV ?? 'development';
}

export function isProductionPublicRuntime(): boolean {
  return runtimeAppEnv() === 'production';
}

/** Strip stack traces and long internal messages before client display or logs. */
export function sanitizeClientErrorDisplay(
  error: Error & { digest?: string },
): ClientErrorDisplay {
  const digest = error.digest;
  if (isProductionPublicRuntime()) {
    return {
      title: 'Page failed to render',
      detail: digest
        ? `Reference ${digest}`
        : 'A transient fault interrupted this view. Please try again.',
      digest,
    };
  }

  // Staging/local: still avoid stacks in UI; operators use server logs + digest.
  const message = typeof error.message === 'string' ? error.message.split('\n')[0] : '';
  const safeMessage =
    message && message.length <= 120 && !message.includes(' at ')
      ? message
      : 'A transient fault interrupted this view.';

  return {
    title: 'Page failed to render',
    detail: digest ? `${safeMessage} (ref ${digest})` : safeMessage,
    digest,
    logDetail: error.stack,
  };
}

/** Server-side log line that redacts multiline stacks from stdout in production. */
export function formatServerErrorLog(error: unknown, digest?: string): string {
  const ref = digest ? ` digest=${digest}` : '';
  if (isProductionPublicRuntime()) {
    if (error instanceof Error) {
      return `[public-web] ${error.name}:${ref}`.trim();
    }
    return `[public-web] unknown error${ref}`;
  }
  if (error instanceof Error) {
    return `[public-web] ${error.name}: ${error.message}${ref}`;
  }
  return `[public-web] ${String(error)}${ref}`;
}
