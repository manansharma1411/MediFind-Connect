import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const server = app.listen(env.PORT, () => {
  logger.info(`MediFind Connect API Service started successfully`, {
    port: env.PORT,
    environment: env.NODE_ENV,
    url: `http://localhost:${env.PORT}`,
    healthCheck: `http://localhost:${env.PORT}/api/health`,
  });
});

function handleShutdown(signal: string): void {
  logger.info(`Received ${signal}. Initiating graceful shutdown...`);
  server.close(() => {
    logger.info('HTTP server closed cleanly. Process exiting.');
    process.exit(0);
  });

  // Force close if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing process exit.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Promise Rejection detected', reason instanceof Error ? reason : new Error(String(reason)));
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception detected. Terminating process.', error);
  process.exit(1);
});
