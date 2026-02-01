import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/middleware-auth';

export const dynamic = 'force-dynamic';

function getClientIp(request: Request): string {
  const xfwd = request.headers.get('x-forwarded-for');
  if (xfwd) return xfwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

// POST /api/log - Création de log
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, resource, status, user_id } = body;

    const ip_address = getClientIp(req);
    const user_agent = req.headers.get('user-agent') ?? 'unknown';

    await pool.query(
      'INSERT INTO access_logs (user_id, action, resource, status, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6)',
      [user_id || null, action, resource || null, status, ip_address, user_agent]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ POST /api/log error:', error);
    return NextResponse.json({ error: 'Logging failed' }, { status: 500 });
  }
}

// GET /api/log - Liste des logs
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const action = searchParams.get('action');
    const status = searchParams.get('status');

    let query = 'SELECT * FROM access_logs WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (action) {
      query += ` AND action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('❌ GET /api/log error:', error);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }
}
