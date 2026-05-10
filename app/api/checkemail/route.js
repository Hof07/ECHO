import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  try {
    const { identifier } = await req.json();

    if (!identifier) {
      return NextResponse.json(
        { exists: false, message: "Identifier missing" },
        { status: 400 }
      );
    }

    console.log("Searching for:", identifier);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, username")
      .or(`email.ilike.${identifier},username.ilike.${identifier}`)
      .maybeSingle();

    console.log("Data:", data);
    console.log("Error:", error);

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
    console.log("CATCH ERROR:", e);
    return NextResponse.json(
      { exists: false, message: e.message },
      { status: 500 }
    );
  }
}