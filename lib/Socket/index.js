import { DEFAULT_CONNECTION_CONFIG } from '../Defaults/index.js';
import { sessionSlots, DEFAULT_MAX_SESSIONS } from '../SessionManager.js';
import { makeCommunitiesSocket } from './communities.js';
// export the last socket layer
const makeWASocket = (config) => {
    const newConfig = {
        ...DEFAULT_CONNECTION_CONFIG,
        ...config
    };
    // Built-in session cap: protects the process from overload-induced
    // "Bad session" failures and disconnects. Defaults to 200, overridable
    // per socket config via `maxSessions`.
    const slot = sessionSlots.acquireSlot(newConfig.maxSessions ?? DEFAULT_MAX_SESSIONS);
    if (slot.error) {
        throw slot.error;
    }
    try {
        const sock = makeCommunitiesSocket(newConfig);
        sessionSlots.bindSocket(slot.token, sock);
        return sock;
    } catch (error) {
        sessionSlots.releaseSlot(slot.token);
        throw error;
    }
};
export default makeWASocket;
//# sourceMappingURL=index.js.map