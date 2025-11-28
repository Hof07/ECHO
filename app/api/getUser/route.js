// app/api/getUser/route.js
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { jwtVerify } from "jose";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Use server-only secret (remove NEXT_PUBLIC_ prefix in production)
const SECRET_ENV_NAME = "JWT_SECRET"; // recommend this
const rawSecret = process.env[SECRET_ENV_NAME];

if (!rawSecret) {
  console.error(`[getUser] Missing env var ${SECRET_ENV_NAME}`);
}

const SECRET = rawSecret ? new TextEncoder().encode(rawSecret) : null;

export async function GET() {
  try {
    // console.log("[getUser] GET called");

    // 1) read cookie
    const cookieStore = cookies();
    const token = cookieStore.get("music_jwt")?.value;
    // console.log("[getUser] cookie token present?", !!token);

    if (!token) {
      // console.warn("[getUser] No music_jwt cookie found");
      return NextResponse.json(
        { success: false, step: "no_token", message: "No auth token found" },
        { status: 401 }
      );
    }

    if (!SECRET) {
      console.error("[getUser] JWT secret not configured on server");
      return NextResponse.json(
        { success: false, step: "no_secret", message: "Server misconfiguration: missing JWT secret" },
        { status: 500 }
      );
    }

    // 2) verify JWT
    let payload;
    try {
      // console.log("[getUser] Verifying JWT...");
      const { payload: decoded } = await jwtVerify(token, SECRET);
      payload = decoded;
      // don't log full payload in production (it may contain sensitive info)
      // console.log("[getUser] JWT verified. payload keys:", Object.keys(payload || {}));
    } catch (err) {
      console.error("[getUser] jwtVerify failed:", err?.message || err);
      return NextResponse.json(
        { success: false, step: "jwt_verify_failed", message: "Invalid or expired JWT", error: err?.message || String(err) },
        { status: 401 }
      );
    }

    // 3) determine identifier (id or email)
    const userId = payload?.id ?? null;
    const email = payload?.email ?? null;
    // console.log(`[getUser] extracted id: ${userId ? String(userId) : "none"}, email: ${email ?? "none"}`);

    if (!userId && !email) {
      console.warn("[getUser] token missing id and email");
      return NextResponse.json(
        { success: false, step: "token_missing_fields", message: "Token missing id or email" },
        { status: 400 }
      );
    }

    // 4) fetch profile from Supabase
    try {
      let query = supabase.from("profiles").select(`
        id,
        username,
        img,
        created_at,
        premium,
        full_name,
        gender,
        dob,
        password,
        email
      `).limit(1);

      if (userId) query = query.eq("id", userId);
      else query = query.eq("email", email);

      // console.log("[getUser] Running query on profiles...");
      const { data: profile, error: profileError } = await query.single();

      if (profileError) {
        console.error("[getUser] Supabase profile error:", profileError.message || profileError);
        return NextResponse.json(
          { success: false, step: "profile_query_failed", message: "Profile not found or query error", error: profileError.message || profileError },
          { status: 404 }
        );
      }

      if (!profile) {
        console.warn("[getUser] Profile returned null/undefined");
        return NextResponse.json(
          { success: false, step: "profile_missing", message: "Profile not found" },
          { status: 404 }
        );
      }

      // 5) sanitize profile before returning (remove password)
      const safeProfile = { ...profile };
      if ("password" in safeProfile) {
        safeProfile.password = undefined; // or delete safeProfile.password;
        delete safeProfile.password;
      }

      // console.log("[getUser] Profile found, returning safe profile for user:", safeProfile.id);

      return NextResponse.json(
        { success: true, user: safeProfile },
        { status: 200 }
      );
    } catch (err) {
      console.error("[getUser] Unexpected DB error:", err);
      return NextResponse.json(
        { success: false, step: "db_error", message: "Database error", error: err?.message || String(err) },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("[getUser] Unexpected server error:", err);
    return NextResponse.json(
      { success: false, step: "unexpected", message: "Unexpected server error", error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
