import { v4 as uuidv4 } from 'uuid';

/**
 * Assigns a guest session UUID to every request that does not carry
 * an existing x-mockflow-session header. The session ID is echoed
 * back in the response header so the client can persist it.
 */
export function guestSessionMiddleware(req, res, next) {
  const existingSession = req.headers['x-mockflow-session'];

  if (existingSession) {
    // Canonicalise to trimmed lowercase so the session key is IDENTICAL across
    // every route. The mock route (routes/mock.js) lowercases the path session
    // before store lookups; without matching normalisation here, enabling auth
    // (header session) and firing a request (path session) could hit two
    // different Map keys if the UUID carried any uppercase hex — silently
    // bypassing the 401 gate. Normalising in one place keeps them in sync.
    req.sessionId = String(existingSession).trim().toLowerCase();
  } else {
    const newSessionId = uuidv4();
    req.sessionId = newSessionId;
    res.setHeader('x-mockflow-session', newSessionId);
  }

  next();
}
