import { NextResponse } from "next/server";
import sharp from "sharp";
import { supabase } from "@/app/lib/supabaseClient";

export async function POST(req) {
  try {
    const { playlistId, images } = await req.json();

    if (!playlistId || !images || images.length === 0) {
      return NextResponse.json(
        { error: "Missing playlistId or images" },
        { status: 400 }
      );
    }

    // --- Take only 4 images ---
    const selected = images.slice(0, 4);

    // --- Download images as buffers ---
    const buffers = await Promise.all(
      selected.map(async (url) => {
        const res = await fetch(url);
        return Buffer.from(await res.arrayBuffer());
      })
    );

    // --- Resize all to 512x512 ---
    const resized = await Promise.all(
      buffers.map((buf) => sharp(buf).resize(512, 512).toBuffer())
    );

    // --- Create 2×2 collage ---
    const canvas = sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 3,
        background: "#111",
      },
    });

    const collage = await canvas
      .composite([
        { input: resized[0], top: 0, left: 0 },
        { input: resized[1], top: 0, left: 512 },
        { input: resized[2], top: 512, left: 0 },
        { input: resized[3], top: 512, left: 512 },
      ])
      .jpeg({ quality: 90 })
      .toBuffer();

    // --- Upload collage to Supabase Storage ---
    const fileName = `playlist_covers/${playlistId}.jpg`;

    const { error: uploadErr } = await supabase.storage
      .from("playlist-covers")
      .upload(fileName, collage, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    const {
      data: { publicUrl },
    } = supabase.storage.from("playlist-covers").getPublicUrl(fileName);

    // --- Update playlist image_url ---
    await supabase
      .from("playlists")
      .update({ image_url: publicUrl })
      .eq("id", playlistId);

    return NextResponse.json({ url: publicUrl });
  } catch (e) {
    console.error("Cover generation error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
