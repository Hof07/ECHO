import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function uploadImageAndSave(file, userId) {
  try {
    if (!file) throw new Error("No file provided");

    // --- 1️⃣ Generate unique file name
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;

    // --- 2️⃣ Upload to bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("images")                // your bucket name
      .upload(`uploads/${fileName}`, file, {
        contentType: file.type,
      });

    if (uploadError) throw uploadError;

    // --- 3️⃣ Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("images")
      .getPublicUrl(`uploads/${fileName}`);

    const imageUrl = publicUrlData.publicUrl;

    // --- 4️⃣ Insert URL into table
    const { data: dbData, error: dbError } = await supabase
      .from("user_photos")            // your table name
      .insert([
        {
          user_id: userId,
          image_url: imageUrl,
        },
      ])
      .select();

    if (dbError) throw dbError;

    return {
      success: true,
      imageUrl,
      dbData,
    };
  } catch (error) {
    console.error("❌ Upload Error:", error);
    return { success: false, error: error.message };
  }
}
