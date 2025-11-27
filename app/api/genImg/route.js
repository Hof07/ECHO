import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";

async function main() {
  try {
    console.log("🔵 Generating image...");

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY, // <-- Put your key in .env
    });

    const response = await ai.models.generateImages({
      model: "imagen-4.0-generate-001",
      prompt: "Robot holding a red skateboard",
      config: {
        numberOfImages: 1,
        aspectRatio: "1:1",
      },
    });

    let idx = 1;
    for (const generatedImage of response.generatedImages) {
      const imgBytes = generatedImage.image.imageBytes;
      const buffer = Buffer.from(imgBytes, "base64");

      const filename = `generated-${idx}.png`;
      fs.writeFileSync(filename, buffer);

      console.log(`🟢 Image saved: ${filename}`);
      idx++;
    }

    console.log("✅ Finished!");
  } catch (err) {
    console.error("❌ Error generating image:", err);
  }
}

main();
