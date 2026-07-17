/**
 * Structured logging and typed operational errors shared across TypeScript services.
 */
export const OBSERVABILITY_PACKAGE = '@black-book/observability' as const;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogContext = Readonly<Record<string, unknown>>;
export type LogSink = (line: string) => void;

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: unknown, context?: LogContext): void;
}

export interface LoggerOptions {
  readonly service: string;
  readonly level?: LogLevel;
  readonly clock?: () => Date;
  readonly sink?: LogSink;
}

export interface AppErrorOptions {
  readonly code: string;
  readonly status?: number;
  readonly cause?: unknown;
}

export class AppError extends Error {
  public override readonly name = 'AppError';
  public readonly code: string;
  public readonly status: number;

  public constructor(message: string, options: AppErrorOptions) {
    super(message);
    this.code = options.code;
    this.status = options.status ?? 500;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

const LEVEL_PRIORITY: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function serializeError(error: unknown): LogContext {
  if (error instanceof AppError) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.status,
    };
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }
  return { value: String(error) };
}

export function createLogger(options: LoggerOptions): Logger {
  const threshold = LEVEL_PRIORITY[options.level ?? 'info'];
  const clock = options.clock ?? (() => new Date());
  const sink = options.sink ?? ((line: string) => console.log(line));

  function write(level: LogLevel, message: string, context: LogContext = {}): void {
    if (LEVEL_PRIORITY[level] < threshold) {
      return;
    }
    sink(
      JSON.stringify({
        timestamp: clock().toISOString(),
        level,
        service: options.service,
        message,
        ...context,
      }),
    );
  }

  return {
    debug: (message, context) => write('debug', message, context),
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, error, context) =>
      write('error', message, {
        ...context,
        ...(error === undefined ? {} : { error: serializeError(error) }),
      }),
  };
}
