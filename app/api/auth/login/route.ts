import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, generateToken } from '@/lib/auth';
import pool from '@/lib/db';

function getClientIp(request: Request): string {
  const xfwd = request.headers.get('x-forwarded-for');
  if (xfwd) return xfwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    const user = await verifyPassword(email, password);
    
    const ip_address = getClientIp(request);
    const user_agent = request.headers.get('user-agent') ?? 'unknown';
    
    if (!user) {
      await pool.query(
        'INSERT INTO access_logs (action, status, resource, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
        ['login', 'failed', email, ip_address, user_agent]
      );
      
      return NextResponse.json({ error: 'Email ou mot de passe incorrect' }, { status: 401 });
    }
    
    const token = generateToken(user.id);
    
    await pool.query(
      'INSERT INTO access_logs (action, status, user_id, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
      ['login', 'success', user.id, ip_address, user_agent]
    );
    
    const response = NextResponse.json({ success: true, user });
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 jours
      path: '/',
    });
    
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
