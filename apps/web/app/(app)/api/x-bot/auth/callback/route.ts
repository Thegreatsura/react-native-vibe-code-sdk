// app/api/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { xBotState } from '@react-native-vibe-code/database';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // Optional check

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Client ID or secret not set' }, { status: 500 });
  }

  // Get verifier from cookie
  const cookieStore = await cookies();
  const codeVerifier = cookieStore.get('code_verifier')?.value;
  if (!codeVerifier) {
    return NextResponse.json({ error: 'Code verifier missing' }, { status: 400 });
  }

  // Clear cookie
  cookieStore.delete('code_verifier');

  // Get the current host dynamically (must match what was used in /auth/start)
  const host = url.host;
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/api/x-bot/auth/callback`;

  const tokenUrl = 'https://api.twitter.com/2/oauth2/token';

  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authHeader}`,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ error: errorData }, { status: response.status });
    }

    const data = await response.json();
    const refreshToken = data.refresh_token;

    // Store refresh token in database so it survives rotation
    if (refreshToken) {
      const existing = await db
        .select()
        .from(xBotState)
        .where(eq(xBotState.id, 'default'))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(xBotState).values({
          id: 'default',
          refreshToken,
          updatedAt: new Date(),
        });
      } else {
        await db
          .update(xBotState)
          .set({ refreshToken, updatedAt: new Date() })
          .where(eq(xBotState.id, 'default'));
      }
    }

    return NextResponse.json({ refresh_token: refreshToken, saved_to_db: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}