import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from '@binocolo/frontend/components/App.js';
import reportWebVitals from './reportWebVitals';
import { WebSocketsApplicationState } from '@binocolo/frontend/logic/websockets.js';

// ---- Verification that mobx works properly -------------
if (
    !new (class {
        // @ts-ignore
        x;
    })().hasOwnProperty('x')
) {
    throw new Error('Transpiler is not configured correctly');
}
// ------------------------------------------------

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

const state = new WebSocketsApplicationState(getWebSocketsUri());
state.startWebSocket();

root.render(
    <React.StrictMode>
        <div id="popup-root" />
        <App state={state} />
    </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

function getWebSocketsUri(): string {
    // For development
    const wsUri = process.env.WS_URI;
    if (wsUri) {
        return wsUri;
    }

    // For production
    const loc = window.location;
    let localUri;
    if (loc.protocol === 'https:') {
        localUri = 'wss:';
    } else {
        localUri = 'ws:';
    }
    localUri += '//' + loc.host;
    localUri += loc.pathname + 'commands';
    return localUri;
}
