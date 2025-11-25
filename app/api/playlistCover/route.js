//app/api/playlistCover/route.js

import { NextResponse } from "next/server";
import sharp from "sharp";
import { supabase } from "@/app/lib/supabaseClient";

export async function POST(req) {
  try {
    const { playlistId } = await req.json();

    if (!playlistId) {
      return NextResponse.json(
        { error: "Missing playlistId" },
        { status: 400 }
      );
    }

    // 🟢 Fetch songs from this playlist
    const { data: playlistSongs, error: songsError } = await supabase
      .from("playlist_songs")
      .select(
        `
        song:songs (
          cover_url
        )
      `
      )
      .eq("playlist_id", playlistId)
      .limit(4); // Only need 4 images

    if (songsError) throw songsError;

    // Filter out songs without cover_url and take only 4
    const coverUrls = playlistSongs
      .map(row => row.song?.cover_url)
      .filter(url => url && url.trim() !== "")
      .slice(0, 4);

    // If no covers available, use default image
    if (coverUrls.length === 0) {
      return NextResponse.json(
        { error: "No cover images available in playlist" },
        { status: 400 }
      );
    }

    // 🟢 Download images as buffers
    const buffers = await Promise.all(
      coverUrls.map(async (url) => {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
          return Buffer.from(await res.arrayBuffer());
        } catch (error) {
          console.error("Error downloading image:", error);
          // Return a default buffer for failed downloads
          return createDefaultImageBuffer();
        }
      })
    );

    // 🟢 Resize all to 512x512
    const resized = await Promise.all(
      buffers.map((buf) => 
        sharp(buf)
          .resize(512, 512, { fit: 'cover', position: 'center' })
          .toBuffer()
      )
    );

    // 🟢 Create collage based on number of available images
    let collage;
    const canvasWidth = 1024;
    const canvasHeight = 1024;

    switch (resized.length) {
      case 1:
        // Single image - use it as full cover
        collage = await sharp(resized[0])
          .resize(canvasWidth, canvasHeight, { fit: 'cover' })
          .jpeg({ quality: 90 })
          .toBuffer();
        break;

      case 2:
        // Two images - side by side
        collage = await sharp({
          create: {
            width: canvasWidth,
            height: canvasHeight,
            channels: 3,
            background: '#111',
          },
        })
          .composite([
            { input: resized[0], top: 0, left: 0, width: 512, height: 1024 },
            { input: resized[1], top: 0, left: 512, width: 512, height: 1024 },
          ])
          .jpeg({ quality: 90 })
          .toBuffer();
        break;

      case 3:
        // Three images - one big, two small
        collage = await sharp({
          create: {
            width: canvasWidth,
            height: canvasHeight,
            channels: 3,
            background: '#111',
          },
        })
          .composite([
            { input: resized[0], top: 0, left: 0, width: 512, height: 512 },
            { input: resized[1], top: 0, left: 512, width: 512, height: 512 },
            { input: resized[2], top: 512, left: 0, width: 512, height: 512 },
          ])
          .jpeg({ quality: 90 })
          .toBuffer();
        break;

      case 4:
        // Four images - 2x2 grid
        collage = await sharp({
          create: {
            width: canvasWidth,
            height: canvasHeight,
            channels: 3,
            background: '#111',
          },
        })
          .composite([
            { input: resized[0], top: 0, left: 0 },
            { input: resized[1], top: 0, left: 512 },
            { input: resized[2], top: 512, left: 0 },
            { input: resized[3], top: 512, left: 512 },
          ])
          .jpeg({ quality: 90 })
          .toBuffer();
        break;
    }

    // 🟢 Upload collage to Supabase Storage
    const fileName = `playlist_covers/${playlistId}.jpg`;

    const { error: uploadErr } = await supabase.storage
      .from("playlist-covers")
      .upload(fileName, collage, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    // 🟢 Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("playlist-covers")
      .getPublicUrl(fileName);

    // 🟢 Update playlist image_url
    const { error: updateErr } = await supabase
      .from("playlists")
      .update({ image_url: publicUrl })
      .eq("id", playlistId);

    if (updateErr) throw updateErr;

    return NextResponse.json({ 
      success: true, 
      url: publicUrl,
      message: `Generated collage from ${resized.length} song covers`
    });

  } catch (e) {
    console.error("Cover generation error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Helper function to create a default image buffer
function createDefaultImageBuffer() {
  const svg = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#333"/>
      <text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle" dy=".3em">No Cover</text>
    </svg>
  `;
  return Buffer.from(svg);
}