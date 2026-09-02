import jwt from 'jsonwebtoken';

/**
 * Protects routes that require an authenticated user.
 * Expects: Authorization: Bearer <access_token>
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is missing or malformed.',
      },
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({
      error: {
        code: 'TOKEN_INVALID',
        message: 'Authentication token is invalid or has expired.',
      },
    });
  }
}
