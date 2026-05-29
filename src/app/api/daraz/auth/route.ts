import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const appKey = process.env.DARAZ_APP_KEY;
  const callbackUrl = `${process.env.NEXTAUTH_URL}/api/daraz/callback`;
  const authUrl = `https://seller.daraz.com.np/account/oauth/authorize?response_type=code&force_auth=true&redirect_uri=${encodeURIComponent(callbackUrl)}&client_id=${appKey}`;
  return NextResponse.redirect(authUrl);
}
