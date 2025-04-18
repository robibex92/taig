import jwt from 'jsonwebtoken';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { user_id: decoded.id || decoded.user_id }; // зависит от того, как вы подписываете токен
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}