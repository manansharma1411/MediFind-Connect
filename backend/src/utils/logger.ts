type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogPayload {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

function writeLog(level: LogLevel, message: string, meta?: Record<string, unknown>, err?: Error): void {
  const payload: LogPayload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta } : {}),
    ...(err
      ? {
          error: {
            name: err.name,
            message: err.message,
            ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {}),
          },
        }
      : {}),
  };

  const formatted = JSON.stringify(payload);
  if (level === 'ERROR') {
    console.error(formatted);
  } else if (level === 'WARN') {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => writeLog('DEBUG', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => writeLog('INFO', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => writeLog('WARN', msg, meta),
  error: (msg: string, err?: Error, meta?: Record<string, unknown>) => writeLog('ERROR', msg, meta, err),
};
