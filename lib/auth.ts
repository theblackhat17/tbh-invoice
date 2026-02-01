import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

export async function verifyPassword(email: string, password: string) {
  const result = await pool.query(
    'SELECT id, email, password_hash FROM users WHERE email = $1',
    [email]
  );
  
  if (result.rows.length === 0) return null;
  
  const user = result.rows[0];
  const isValid = await bcrypt.compare(password, user.password_hash);
  
  return isValid ? { id: user.id, email: user.email } : null;
}

export function generateToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}

export async function getUserFromToken(token: string) {
  const decoded = verifyToken(token);
  if (!decoded) return null;
  
  const result = await pool.query(
    'SELECT id, email FROM users WHERE id = $1',
    [decoded.userId]
  );
  
  return result.rows[0] || null;
}
