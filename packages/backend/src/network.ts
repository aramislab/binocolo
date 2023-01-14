import Fastify, { FastifyInstance } from 'fastify';
import FastifyWebSocket from '@fastify/websocket';
import FastifyStatic from '@fastify/static';
import { ClientCommand, BackendCommand, parseBackendCommand } from '@binocolo/common/common.js';
import { Logger as PinoLogger } from 'pino';

// Documentation:
// - https://www.fastify.io/docs/latest/

export type SenderFunction = (data: ClientCommand) => Promise<void>;

export interface INetworkHandler {
    onConnected(send: SenderFunction): IConnectionHandler;
}

export interface IConnectionHandler {
    start(): Promise<void>;
    onMessage(message: BackendCommand): Promise<void>;
    close(): Promise<void>;
}

type RunServerParams = {
    port?: number;
    host?: string;
    handler: INetworkHandler;
    pinoLogger: PinoLogger;
    onStarted: (url: string) => void;
    staticRootDir: string;
};

export function runHTTPServer({ port, host, handler, pinoLogger, onStarted, staticRootDir }: RunServerParams) {
    const server: FastifyInstance = Fastify({ logger: pinoLogger });
    server.register(FastifyWebSocket);
    server.register(FastifyStatic, {
        root: staticRootDir,
        // prefix: '/public/', // optional: default '/'
    });

    server.register(async function (server) {
        server.get('/commands', { websocket: true }, (connection /* SocketStream */) => {
            pinoLogger.info(`Client connected`);
            const send: SenderFunction = async (data) => {
                if (connectionHandler) {
                    // pinoLogger.info(`Sending message: ${data.type}`);
                    await new Promise((resolve, reject) => {
                        connection.socket.send(JSON.stringify(data), {}, (err: any) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(undefined);
                            }
                        });
                    });
                }
            };
            let connectionHandler: IConnectionHandler | null = handler.onConnected(send);
            connectionHandler.start().catch((err) => {
                pinoLogger.error({ message: 'Unexpected error while starting connection handler', err });
            });
            connection.socket.on('message', (rawData: any) => {
                let message: BackendCommand;
                try {
                    message = parseBackendCommand(JSON.parse(rawData));
                } catch (err) {
                    pinoLogger.error(`Error parsing incoming message: ${err ? err.toString() : err}`);
                    return;
                }
                if (connectionHandler) {
                    connectionHandler.onMessage(message).catch((err) => {
                        pinoLogger.error({ message: 'Unexpected error while handling message', err });
                    });
                } else {
                    pinoLogger.error('Message arrived after connection closed');
                }
            });
            connection.socket.on('error', function on_error(err: any) {
                pinoLogger.error({ message: 'Unexpected error on websocket', err });
                if (connectionHandler) {
                    connectionHandler.close().catch((err) => {
                        pinoLogger.error({ message: 'Unexpected error while closing', err });
                    });
                    connectionHandler = null;
                }
            });
            connection.socket.on('close', function on_close() {
                pinoLogger.info(`Client disconnected`);
                if (connectionHandler) {
                    connectionHandler.close().catch((err) => {
                        pinoLogger.error({ message: 'Unexpected error while closing', err });
                    });
                    connectionHandler = null;
                } else {
                    pinoLogger.error('Close arrived after connection already closed');
                }
            });
        });
    });

    const start = async () => {
        const address = await server.listen({ port, host });
        onStarted(address);
    };
    start().catch((err) => {
        pinoLogger.error('Unexpected error while starting server', err);
    });
}
