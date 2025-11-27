import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const email = formData.get("email");

    console.log("📥 FILE:", file?.name);
    console.log("📧 EMAIL RECEIVED:", email);

    if (!file || !email) {
      return NextResponse.json({ error: "Missing file or email" });
    }

    // Check if email exists in profiles
    const { data: checkUser, error: checkError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email);

    console.log("🔍 CHECK USER RESULT:", checkUser);
    console.log("🔍 CHECK USER ERROR:", checkError);

    if (checkUser.length === 0) {
      console.log("❌ NO USER FOUND WITH EMAIL:", email);
      return NextResponse.json({
        error: "Email not found in profiles",
      });
    }

    // Upload file
    const ext = file.name.split(".").pop();
    const path = `${email}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("img")
      .upload(path, file, { upsert: true });

    console.log("⬆️ UPLOAD ERROR:", uploadError);

    if (uploadError) {
      return NextResponse.json({ error: "Upload failed", details: uploadError });
    }

    // Public URL
    const url =
      supabase.storage.from("img").getPublicUrl(path).data.publicUrl;

    console.log("🌐 PUBLIC URL:", url);

    // Update profiles table
    const { data: updateData, error: updateError } = await supabase
      .from("profiles")
      .update({ img: url })
      .eq("email", email)
      .select(); // 🔥 shows how many rows updated

    console.log("📝 UPDATE DATA:", updateData);
    console.log("📝 UPDATE ERROR:", updateError);

    if (updateError) {
      return NextResponse.json({ error: "Update failed", details: updateError });
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.log("💥 SERVER ERROR:", err);
    return NextResponse.json({ error: "Server crashed", details: err });
  }
}
