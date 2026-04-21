import { NextResponse } from 'next/server'

// Static OG image is served from /public/og.png
// This route redirects for backwards compatibility
export async function GET() {
  return NextResponse.redirect(new URL('/og.png', 'https://www.fiza.mx'))
}
