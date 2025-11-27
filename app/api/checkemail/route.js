import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  try {
    const { identifier } = await req.json(); // email OR username

    if (!identifier) {
      return NextResponse.json(
        { exists: false, message: "Identifier missing" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, username")
      .or(`email.eq.${identifier}, username.eq.${identifier}`)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { exists: false, message: "Account not found" },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        exists: true,
        user: {
          id: data.id,
          email: data.email,
          username: data.username,
        },
      },
      { status: 200 }
    );
  } catch (e) {
    return NextResponse.json(
      { exists: false, message: e.message },
      { status: 500 }
    );
  }
}
