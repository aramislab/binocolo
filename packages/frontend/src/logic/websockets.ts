import { action, makeObservable, observable } from 'mobx';
import { IApplicationState, LogTableConfiguration, SendMessageFunction } from './models.js';
import { parseClientCommand, ClientCommand } from '@binocolo/common/common.js';

export class WebSocketsApplicationState implements IApplicationState {
    public config: LogTableConfiguration | null;
    public terminated: boolean;

    constructor(private websocketsUri: string) {
        this.config = null;
        this.terminated = false;

        makeObservable(this, {
            config: observable,
            terminated: observable,
            setConfig: action,
            setTerminated: action,
        });
    }

    startWebSocket(): void {
        const socket = new WebSocket(this.websocketsUri);

        const sendMessage: SendMessageFunction = (message) => {
            socket && socket.send(JSON.stringify(message));
        };

        socket.onopen = (e) => {
            console.log('WebSocket connection established');
        };
        socket.onmessage = (event) => {
            let data: ClientCommand;
            try {
                data = parseClientCommand(JSON.parse(event.data));
            } catch (err) {
                console.log('Error parsing message data', err);
                return;
            }
            if (data.type === 'configuration') {
                const config = new LogTableConfiguration(data.params, sendMessage);
                config.loadEntriesFromDataSource();
                this.setConfig(config);
            } else {
                this.config && this.config.onWebsocketMessage(data);
            }
        };
        socket.onerror = (error) => {
            console.log('WebSocket error', error);
        };
        socket.onclose = () => {
            console.log('WebSocket closed');
            this.setTerminated();
        };
    }

    setConfig(config: LogTableConfiguration): void {
        this.config = config;
    }

    setTerminated(): void {
        this.terminated = true;
        this.config = null;
    }
}
