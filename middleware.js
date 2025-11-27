// middleware.js
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.NEXT_PUBLIC_JWT_SECRET);

export async function middleware(req) {
  const path = req.nextUrl.pathname;
  const token = req.cookies.get("music_jwt")?.value;

  console.log("===== MIDDLEWARE CHECK =====");
  console.log("Path:", path);
  console.log("Token:", token);

  if (!path.startsWith("/music")) return NextResponse.next();

  if (!token) {
    console.log("❌ No token → redirect");
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const { payload } = await jwtVerify(token, SECRET);
    console.log("✅ Token valid:", payload);
    return NextResponse.next();
  } catch (err) {
    console.log("❌ Invalid Token:", err.message);
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/music/:path*"],
};
