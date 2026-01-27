import { NextResponse } from "next/server";

export async function POST(req) {
  const { token } = await req.json();

  const res = NextResponse.json({ success: true });

  res.cookies.set("music_jwt", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  });

  return res;
}
