import { NextRequest } from 'next/server';
import { getUserFromToken } from './auth';

export async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;
  
  if (!token) {
    return null;
  }
  
  return await getUserFromToken(token);
}
