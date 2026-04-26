import WebSocket from 'ws';
import { DEFAULT_ORIGIN } from '../../Defaults/index.js';
import { AbstractSocketClient } from './types.js';
export class WebSocketClient extends AbstractSocketClient {
    constructor() {
        super(...arguments);
        this.socket = null;
        this.socketForwarders = new Map();
    }
    get isOpen() {
        return this.socket?.readyState === WebSocket.OPEN;
    }
    get isClosed() {
        return this.socket === null || this.socket?.readyState === WebSocket.CLOSED;
    }
    get isClosing() {
        return this.socket?.readyState === WebSocket.CLOSING;
    }
    get isConnecting() {
        return this.socket?.readyState === WebSocket.CONNECTING;
    }
    connect() {
        if (this.socket) {
            return;
        }
        const socket = new WebSocket(this.url, {
            origin: DEFAULT_ORIGIN,
            headers: this.config.options?.headers,
            handshakeTimeout: this.config.connectTimeoutMs,
            timeout: this.config.connectTimeoutMs,
            agent: this.config.agent
        });
        this.socket = socket;
        socket.setMaxListeners(0);
        const events = ['close', 'error', 'upgrade', 'message', 'open', 'ping', 'pong', 'unexpected-response'];
        for (const event of events) {
            const forwarder = (...args) => this.emit(event, ...args);
            this.socketForwarders.set(event, forwarder);
            socket.on(event, forwarder);
        }
    }
    cleanupSocket(socket = this.socket) {
        if (!socket) {
            return;
        }
        for (const [event, forwarder] of this.socketForwarders.entries()) {
            socket.off(event, forwarder);
        }
        if (socket === this.socket) {
            this.socketForwarders.clear();
        }
    }
    async close() {
        const socket = this.socket;
        if (!socket) {
            return;
        }
        const closePromise = new Promise(resolve => {
            let settled = false;
            const finish = () => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timeout);
                socket.off('close', finish);
                resolve();
            };
            const timeout = setTimeout(() => {
                try {
                    socket.terminate?.();
                }
                catch { }
                finish();
            }, 5000);
            socket.once('close', finish);
        });
        try {
            if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
                socket.close();
            }
            else if (socket.readyState !== WebSocket.CLOSED) {
                socket.terminate?.();
            }
        }
        catch { }
        await closePromise;
        this.cleanupSocket(socket);
        if (this.socket === socket) {
            this.socket = null;
        }
    }
    send(str, cb) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            cb?.(new Error('WebSocket is not open'));
            return false;
        }
        this.socket.send(str, cb);
        return true;
    }
}
