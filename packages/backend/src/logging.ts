import { Logger as PinoLogger } from 'pino';

export interface Logger {
    info(message: string): void;
    error(message: string, err?: unknown): void;
}

export function buildLoggerFromPino(pinoLogger: PinoLogger): Logger {
    return {
        info(message: string) {
            pinoLogger.info(message);
        },
        error(message: string, err?: unknown) {
            pinoLogger.error({ message, err });
        },
    };
}

export function buildLoggerFromConsole(): Logger {
    return {
        info(message: string) {
            console.log(message);
        },
        error(message: string, err?: unknown) {
            console.log(message, err);
        },
    };
}
