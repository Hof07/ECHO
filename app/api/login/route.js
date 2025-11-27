import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

export async function POST(req) {
  try {
    const { identifier, password } = await req.json();

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, message: "Email/Username & password required" },
        { status: 400 }
      );
    }

    // SUPABASE CLIENT (ANON KEY)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // FETCH USER FROM profiles TABLE
    const { data: user, error } = await supabase
      .from("profiles")                        // ← profiles table
      .select("*")
      .or(
        `email.eq.${identifier.toLowerCase()},username.eq.${identifier.toLowerCase()}`
      )
      .single();

    if (error || !user) {
      return NextResponse.json(
        { success: false, message: "Account not found" },
        { status: 404 }
      );
    }

    // VERIFY PASSWORD
    const validPass = await bcrypt.compare(password, user.password);

    if (!validPass) {
      return NextResponse.json(
        { success: false, message: "Wrong password" },
        { status: 401 }
      );
    }

    // CREATE JWT
    const secret = new TextEncoder().encode(process.env.NEXT_PUBLIC_JWT_SECRET);

    const token = await new SignJWT({
      id: user.id,
      email: user.email,
      username: user.username,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret);

    // SET COOKIE (music_jwt)
    const res = NextResponse.json({
      success: true,
      message: "Login successful",
    });

    res.cookies.set("music_jwt", token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return res;
  } catch (err) {
    console.error("🔥 FULL LOGIN ERROR:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
