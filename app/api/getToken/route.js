import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jwtVerify } from "jose";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(req) {
  try {
    // 1️⃣ Read token from cookies
    const token = req.cookies.get("music_jwt")?.value;
    if (!token) {
      return NextResponse.json(
        { error: "No token found" },
        { status: 401 }
      );
    }

    // 2️⃣ Decode JWT → get userId
    const SECRET = new TextEncoder().encode(process.env.NEXT_PUBLIC_JWT_SECRET);
    const { payload } = await jwtVerify(token, SECRET);
    const userId = payload.id;

    if (!userId) {
      return NextResponse.json(
        { error: "Invalid token: No userId" },
        { status: 400 }
      );
    }

    // 3️⃣ Fetch user from Supabase (profiles table)
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // 4️⃣ Return user data
    return NextResponse.json({
      success: true,
      user: profile,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
