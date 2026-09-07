import { randomBytes } from 'crypto';

export const DEFAULT_MAX_SESSIONS = 200;

// Global, self-contained session cap. makeWASocket registers every created
// socket and throws when the limit is reached, so the host application does
// not need any changes to limit how many concurrent WhatsApp sessions this
// process can hold. This keeps connections stable and prevents overload-
// induced "Bad session" errors and disconnects.
export class SessionSlotManager {
    constructor() {
        this.slots = new Map();
        this._seq = 0;
    }

    _limit(maxSessions) {
        const value = Number(maxSessions);
        return Number.isFinite(value) && value >= 1 ? Math.floor(value) : DEFAULT_MAX_SESSIONS;
    }

    acquireSlot(maxSessions = DEFAULT_MAX_SESSIONS) {
        const limit = this._limit(maxSessions);
        if (this.slots.size >= limit) {
            return {
                error: new Error(
                    `Max sessions reached (${limit}). Close unused WhatsApp sessions before creating new ones.`
                )
            };
        }
        const token = `sess_${Date.now().toString(36)}_${++this._seq}_${randomBytes(4).toString('hex')}`;
        this.slots.set(token, { createdAt: Date.now(), released: false });
        return { token, maxSessions: limit };
    }

    bindSocket(token, sock) {
        const slot = this.slots.get(token);
        if (!slot || slot.released) return;
        const release = () => this.releaseSlot(token);
        try {
            sock?.ev?.on?.('connection.update', ({ connection }) => {
                if (connection === 'close') {
                    release();
                }
            });
            if (sock?.ws?.isClosed && !sock?.ws?.isClosing) {
                release();
            }
        } catch { }
    }

    releaseSlot(token) {
        const slot = this.slots.get(token);
        if (!slot) return false;
        slot.released = true;
        return this.slots.delete(token);
    }

    activeCount() {
        return this.slots.size;
    }

    isFull(maxSessions = DEFAULT_MAX_SESSIONS) {
        return this.slots.size >= this._limit(maxSessions);
    }

    slotsFree(maxSessions = DEFAULT_MAX_SESSIONS) {
        return Math.max(0, this._limit(maxSessions) - this.slots.size);
    }

    stats(maxSessions = DEFAULT_MAX_SESSIONS) {
        return {
            maxSessions: this._limit(maxSessions),
            active: this.slots.size,
            free: this.slotsFree(maxSessions)
        };
    }
}

export const sessionSlots = new SessionSlotManager();