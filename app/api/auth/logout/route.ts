import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/middleware-auth';

function getClientIp(request: Request): string {
  const xfwd = request.headers.get('x-forwarded-for');
  if (xfwd) return xfwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    
    if (user) {
      const ip_address = getClientIp(request);
      const user_agent = request.headers.get('user-agent') ?? 'unknown';
      
      await pool.query(
        'INSERT INTO access_logs (action, status, user_id, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
        ['logout', 'success', user.id, ip_address, user_agent]
      );
    }
    
    const response = NextResponse.json({ success: true });
    response.cookies.delete('auth-token');
    
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
