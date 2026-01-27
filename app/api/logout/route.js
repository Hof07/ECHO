import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json(
    { success: true, message: "Logged out successfully" },
    { status: 200 }
  );

  // Delete JWT cookie properly
  response.cookies.set("music_jwt", "", {
    httpOnly: true,
    path: "/",
    secure: true,
    sameSite: "lax",
    expires: new Date(0), // expire instantly
  });

  return response;
}
