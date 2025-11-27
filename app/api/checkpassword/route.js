import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    console.log("📩 INPUT:", email);
    console.log("🔑 PASSWORD:", password);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // -------------------------------
    // FIND USER BY EMAIL OR USERNAME
    // -------------------------------
    const { data: user, error } = await supabase
      .from("profiles")
      .select("*")
      .or(`email.eq.${email.toLowerCase()}, username.eq.${email.toLowerCase()}`)
      .single();

    if (error || !user) {
      console.log("❌ USER NOT FOUND");
      return NextResponse.json({
        success: false,
        message: "Account not found",
      });
    }

    console.log("🗄️ USER FOUND:", user);
    console.log("🔐 HASH IN DB:", user.password);

    // -------------------------------
    // COMPARE PASSWORD
    // -------------------------------
    const match = await bcrypt.compare(password, user.password);
    console.log("🔍 MATCH RESULT:", match);

    if (!match) {
      console.log("❌ WRONG PASSWORD");
      return NextResponse.json({
        success: false,
        message: "Wrong password",
      });
    }

    console.log("✅ LOGIN SUCCESS");

    return NextResponse.json({
      success: true,
      id: user.id,
      email: user.email,
      username: user.username,
    });

  } catch (err) {
    console.log("🔥 ERROR:", err.message);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
