import { v4 as uuidv4 } from 'uuid';

/**
 * Assigns a guest session UUID to every request that does not carry
 * an existing x-mockflow-session header. The session ID is echoed
 * back in the response header so the client can persist it.
 */
export function guestSessionMiddleware(req, res, next) {
  const existingSession = req.headers['x-mockflow-session'];

  if (existingSession) {
    req.sessionId = existingSession;
  } else {
    const newSessionId = uuidv4();
    req.sessionId = newSessionId;
    res.setHeader('x-mockflow-session', newSessionId);
  }

  next();
}
