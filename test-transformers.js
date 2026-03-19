import { pipeline, env } from "@huggingface/transformers";

async function run() {
  env.allowLocalModels = false;
  
  try {
    const model = await pipeline("image-to-text", "datalab-to/chandra", {
      quantized: false,
      dtype: 'fp32',
      device: "wasm"
    });
    console.log("Success!");
  } catch (e) {
    console.error("Caught error:", e.message);
    console.error(e.stack);
  }
}
run();
