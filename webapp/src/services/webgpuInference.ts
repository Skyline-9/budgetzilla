import {
  AutoProcessor,
  Gemma4ForConditionalGeneration,
  TextStreamer,
  RawImage,
  env,
} from "@huggingface/transformers";
import { idbModelCache } from "./idbModelCache";

env.useCustomCache = true;
env.customCache = idbModelCache as any;
env.useBrowserCache = false;

if (import.meta.env.DEV && localStorage.getItem("hfProxyPort")) {
  env.remoteHost = `http://localhost:${localStorage.getItem("hfProxyPort")}`;
  env.remotePathTemplate = "{model}/resolve/{revision}/";
}

const MODEL_ID = "onnx-community/gemma-4-E2B-it-ONNX";

let processor: InstanceType<typeof AutoProcessor> | null = null;
let model: InstanceType<typeof Gemma4ForConditionalGeneration> | null = null;
let loadingPromise: Promise<void> | null = null;

export function isWebGpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export type ModelStatus = "idle" | "downloading" | "loading" | "ready" | "error";

export async function ensureModelLoaded(
  onProgress?: (pct: number) => void,
): Promise<void> {
  if (model && processor) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      processor = await AutoProcessor.from_pretrained(MODEL_ID);
      model = (await Gemma4ForConditionalGeneration.from_pretrained(MODEL_ID, {
        dtype: "q4f16",
        device: "webgpu",
        progress_callback: (info: any) => {
          if (info.status === "progress_total" && onProgress) {
            onProgress(Math.round(info.progress));
          }
        },
      })) as any;
    } catch (e) {
      processor = null;
      model = null;
      loadingPromise = null;
      throw e;
    }
  })();

  return loadingPromise;
}

export function isModelLoaded(): boolean {
  return model !== null && processor !== null;
}

export async function disposeModel(): Promise<void> {
  if (model) {
    try { await (model as any).dispose?.(); } catch (_) {}
    model = null;
  }
  processor = null;
  loadingPromise = null;
}

export async function generateFromImage(
  imageBlob: Blob,
  prompt: string,
  onChunk: (text: string) => void,
): Promise<string> {
  await ensureModelLoaded();
  if (!model || !processor) throw new Error("Model not loaded");

  const imageBitmap = await createImageBitmap(imageBlob);
  const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(imageBitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const rawImage = new RawImage(
    new Uint8ClampedArray(imageData.data),
    canvas.width,
    canvas.height,
    4,
  );

  const messages = [
    {
      role: "user" as const,
      content: [
        { type: "image" as const },
        { type: "text" as const, text: prompt },
      ],
    },
  ];

  const text = (processor as any).apply_chat_template(messages, {
    enable_thinking: false,
    add_generation_prompt: true,
  });

  const inputs = await (processor as any)(text, rawImage, null, {
    add_special_tokens: false,
  });

  let fullText = "";
  const streamer = new TextStreamer((processor as any).tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (token: string) => {
      fullText += token;
      onChunk(token);
    },
  });

  await model.generate({
    ...inputs,
    max_new_tokens: 2048,
    do_sample: false,
    streamer,
  });

  return fullText;
}

export async function generateFromText(
  prompt: string,
  onChunk: (text: string) => void,
): Promise<string> {
  await ensureModelLoaded();
  if (!model || !processor) throw new Error("Model not loaded");

  const messages = [
    {
      role: "user" as const,
      content: [{ type: "text" as const, text: prompt }],
    },
  ];

  const text = (processor as any).apply_chat_template(messages, {
    enable_thinking: false,
    add_generation_prompt: true,
  });

  const inputs = await (processor as any)(text, null, null, {
    add_special_tokens: false,
  });

  let fullText = "";
  const streamer = new TextStreamer((processor as any).tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (token: string) => {
      fullText += token;
      onChunk(token);
    },
  });

  await model.generate({
    ...inputs,
    max_new_tokens: 2048,
    do_sample: false,
    streamer,
  });

  return fullText;
}
