import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    

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
      return NextResponse.json({
        success: false,
        message: "Account not found",
      });
    }

    

    // -------------------------------
    // COMPARE PASSWORD
    // -------------------------------
    const match = await bcrypt.compare(password, user.password);
    

    if (!match) {
      return NextResponse.json({
        success: false,
        message: "Wrong password",
      });
    }

    return NextResponse.json({
      success: true,
      id: user.id,
      email: user.email,
      username: user.username,
    });

  } catch (err) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
