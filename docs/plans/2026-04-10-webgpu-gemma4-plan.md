# WebGPU Gemma 4 Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run Gemma 4 E2B in-browser via WebGPU for receipt/PDF scanning, with Ollama as fallback.

**Architecture:** New `webgpuInference.ts` singleton service loads Gemma 4 E2B ONNX via Transformers.js v4 with WebGPU backend. A `parseReceipt` dispatcher in `localAiParser.ts` routes to WebGPU or Ollama based on user preference and browser capability. Settings UI exposes the backend toggle.

**Tech Stack:** `@huggingface/transformers` v4, Gemma 4 E2B ONNX (q4f16), WebGPU API, existing React/TypeScript/Vite stack.

**Spec:** `docs/specs/2026-04-10-webgpu-gemma4-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `webapp/src/services/webgpuInference.ts` | Create | WebGPU detection, model loading/caching, image & text generation |
| `webapp/src/services/localAiParser.ts` | Modify | Add `parseWithWebGpu()`, extract shared prompt builder, add `parseReceipt()` dispatcher |
| `webapp/src/components/transactions/AiScanner.tsx` | Modify | Use `parseReceipt` dispatcher, add model loading progress UI |
| `webapp/src/pages/Settings.tsx` | Modify | Rename AI section, add backend toggle, add model download UI |
| `webapp/src/components/dashboard/AiChatWidget.tsx` | Modify | Show widget when WebGPU available (even without Ollama) |
| `webapp/package.json` | Modify | Add `@huggingface/transformers` dependency |

---

### Task 1: Install Transformers.js v4

**Files:**
- Modify: `webapp/package.json`

- [ ] **Step 1: Install the dependency**

Run from `webapp/`:

```bash
npm install @huggingface/transformers
```

- [ ] **Step 2: Verify installation**

Run:

```bash
cat node_modules/@huggingface/transformers/package.json | grep version
```

Expected: version `4.x.x`

- [ ] **Step 3: Verify typecheck still passes**

Run from `webapp/`:

```bash
npx tsc --build
```

Expected: No errors (the new package isn't imported yet, just installed).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @huggingface/transformers v4 for WebGPU inference"
```

---

### Task 2: Create WebGPU Inference Engine

**Files:**
- Create: `webapp/src/services/webgpuInference.ts`

- [ ] **Step 1: Create the WebGPU inference service**

Create `webapp/src/services/webgpuInference.ts`:

```ts
import {
  AutoProcessor,
  Gemma4ForConditionalGeneration,
  TextStreamer,
  RawImage,
} from "@huggingface/transformers";

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
      model = await Gemma4ForConditionalGeneration.from_pretrained(MODEL_ID, {
        dtype: "q4f16",
        device: "webgpu",
        progress_callback: (info: any) => {
          if (info.status === "progress" && info.total && onProgress) {
            onProgress(Math.round((info.loaded / info.total) * 100));
          }
        },
      });
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

  const inputs = await (processor as any)(text, rawImage, {
    add_special_tokens: false,
  });

  let fullText = "";
  const streamer = new TextStreamer(processor.tokenizer, {
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

  const inputs = await (processor as any)(text, null, {
    add_special_tokens: false,
  });

  let fullText = "";
  const streamer = new TextStreamer(processor.tokenizer, {
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
```

- [ ] **Step 2: Verify typecheck passes**

Run from `webapp/`:

```bash
npx tsc --build
```

Expected: No errors. If there are type issues with the Transformers.js imports (the library types may be loose), fix by adjusting type assertions.

- [ ] **Step 3: Commit**

```bash
git add src/services/webgpuInference.ts
git commit -m "feat: add WebGPU inference engine for Gemma 4 E2B"
```

---

### Task 3: Add `parseReceipt` Dispatcher to `localAiParser.ts`

**Files:**
- Modify: `webapp/src/services/localAiParser.ts`

- [ ] **Step 1: Extract the shared prompt builder**

The prompt logic currently lives inside `parseWithOllama`. Extract it into a standalone function so both backends can reuse it. Add the following function **above** `parseWithOllama` in `localAiParser.ts`:

```ts
function buildParserPrompt(
  categories: { id: string; name: string }[],
  options: { isImage: boolean; textContent?: string },
): string {
  const today = new Date().toISOString().split("T")[0];
  const categoryListStr = categories.map((c) => `- ${c.name} (ID: ${c.id})`).join("\n");

  return [
    "You are a professional financial data parser. I am providing data from a receipt or bank statement.",
    options.isImage ? "The data is an image." : "The data is extracted text from a PDF.",
    `Today's date is ${today}. Use this as context for identifying the year if it is missing from the receipt.`,
    "Please extract all transactions and return ONLY a JSON array of objects.",
    "Do not wrap it in markdown block quotes. Just output the raw JSON array.",
    "Each object must have exactly these keys:",
    '- "date": string in YYYY-MM-DD format. Look for any date mentioned. If no year is found, assume it is recent relative to today.',
    '- "amountCents": integer. Return ONLY the positive magnitude (e.g. 1500 for $15.00).',
    '- "merchant": string, the name of the store or merchant.',
    '- "categoryId": string, you MUST choose the most appropriate category ID from the list below based on the merchant.',
    "",
    "Available Categories:",
    categoryListStr,
    "",
    options.textContent ? `Source Text:\n${options.textContent}\n` : "",
    "If a field is missing, provide your best guess based on available context. Return ONLY valid JSON.",
  ].filter(Boolean).join("\n");
}
```

- [ ] **Step 2: Update `parseWithOllama` to use the shared prompt**

Replace the inline prompt construction in `parseWithOllama` with a call to `buildParserPrompt`. Change the beginning of `parseWithOllama` to:

```ts
export async function parseWithOllama(
  categories: { id: string; name: string }[],
  options: { base64Image?: string; textContent?: string }
): Promise<any[]> {
  const url = localStorage.getItem("ollamaUrl") || "http://localhost:11434";
  const model = localStorage.getItem("ollamaModel") || "gemma4";

  const prompt = buildParserPrompt(categories, {
    isImage: !!options.base64Image,
    textContent: options.textContent,
  });

  try {
    // ... rest of fetch logic stays exactly the same ...
```

Remove the old inline `today`, `categoryListStr`, and `prompt` construction that was previously between the `model` declaration and the `try` block.

- [ ] **Step 3: Add `parseWithWebGpu` function**

Add this function after `parseWithOllama` in `localAiParser.ts`:

```ts
import {
  isWebGpuAvailable,
  generateFromImage,
  generateFromText,
} from "./webgpuInference";

async function parseWithWebGpu(
  categories: { id: string; name: string }[],
  options: { imageBlob?: Blob; textContent?: string },
): Promise<any[]> {
  const prompt = buildParserPrompt(categories, {
    isImage: !!options.imageBlob,
    textContent: options.textContent,
  });

  let rawText: string;
  if (options.imageBlob) {
    rawText = await generateFromImage(options.imageBlob, prompt, () => {});
  } else if (options.textContent) {
    rawText = await generateFromText(prompt, () => {});
  } else {
    throw new Error("No image or text content provided");
  }

  let jsonText = rawText.trim();
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, "");
    jsonText = jsonText.replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(jsonText);
  return Array.isArray(parsed) ? parsed : [parsed];
}
```

Note: The import for `webgpuInference` goes at the top of the file with the other imports.

- [ ] **Step 4: Add `parseReceipt` dispatcher**

Add this as the new public entry point, after `parseWithWebGpu`:

```ts
export type InferenceBackend = "webgpu" | "ollama";

export function getInferenceBackend(): InferenceBackend {
  if (!isWebGpuAvailable()) return "ollama";
  return (localStorage.getItem("inferenceBackend") as InferenceBackend) || "webgpu";
}

export async function parseReceipt(
  categories: { id: string; name: string }[],
  options: { base64Image?: string; imageBlob?: Blob; textContent?: string },
): Promise<any[]> {
  const backend = getInferenceBackend();

  if (backend === "webgpu") {
    try {
      return await parseWithWebGpu(categories, {
        imageBlob: options.imageBlob,
        textContent: options.textContent,
      });
    } catch (e) {
      console.error("WebGPU inference failed, falling back to Ollama:", e);
    }
  }

  return parseWithOllama(categories, {
    base64Image: options.base64Image,
    textContent: options.textContent,
  });
}
```

- [ ] **Step 5: Verify typecheck passes**

Run from `webapp/`:

```bash
npx tsc --build
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/services/localAiParser.ts
git commit -m "feat: add parseReceipt dispatcher with WebGPU and Ollama backends"
```

---

### Task 4: Update AiScanner to Use `parseReceipt` with Model Loading UX

**Files:**
- Modify: `webapp/src/components/transactions/AiScanner.tsx`

- [ ] **Step 1: Update imports**

At the top of `AiScanner.tsx`, replace:

```ts
import { parseWithOllama } from "@/services/localAiParser";
```

with:

```ts
import { parseReceipt, getInferenceBackend } from "@/services/localAiParser";
import { ensureModelLoaded, isModelLoaded, type ModelStatus } from "@/services/webgpuInference";
```

Also add `Download` to the `lucide-react` import:

```ts
import { FileImage, FileText, Loader2, Sparkles, Trash2, CheckCircle2, Calendar, Store, DollarSign, Tag, TrendingUp, TrendingDown, CornerDownRight, X, Download } from "lucide-react";
```

- [ ] **Step 2: Add model loading state**

Inside the `AiScanner` component, after the existing state declarations (after `const [parsedItems, setParsedItems] = ...`), add:

```ts
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [downloadProgress, setDownloadProgress] = useState(0);
```

- [ ] **Step 3: Rewrite `handleScan` to use `parseReceipt` with model loading**

Replace the entire `handleScan` function with:

```ts
  const handleScan = async () => {
    if (files.length === 0) return;

    const backend = getInferenceBackend();

    if (backend === "webgpu" && !isModelLoaded()) {
      setModelStatus("downloading");
      try {
        await ensureModelLoaded((pct) => setDownloadProgress(pct));
        setModelStatus("ready");
      } catch (e) {
        console.error("Failed to load WebGPU model:", e);
        toast.error("Could not load AI model. Falling back to Ollama.");
        setModelStatus("error");
      }
    }

    setIsScanning(true);
    setScanProgress({ current: 0, total: files.length });

    const allExtractedItems: TransactionCreate[] = [];
    const isValidDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
    const today = new Date().toISOString().split("T")[0];
    const catList = categories.map((c) => ({ id: c.id, name: c.name }));

    try {
      for (let i = 0; i < files.length; i++) {
        setScanProgress((prev) => ({ ...prev, current: i + 1 }));
        const file = files[i];
        let result;

        if (file.type.startsWith("image/")) {
          const b64 = await convertToBase64(file);
          result = await parseReceipt(catList, {
            base64Image: b64,
            imageBlob: file,
          });
        } else if (file.type === "application/pdf") {
          const textContent = await extractTextFromPdf(file);
          result = await parseReceipt(catList, { textContent });
        } else {
          continue;
        }

        const validItems = result.map((item: any) => {
          let date = item.date;
          if (!date || !isValidDate(date)) date = today;

          return {
            date,
            amountCents: Math.abs(
              typeof item.amountCents === "number"
                ? item.amountCents
                : parseInt(item.amountCents || "0", 10),
            ),
            merchant: item.merchant || "",
            categoryId: item.categoryId || categories[0]?.id || "",
            notes:
              item.notes ||
              (file.type === "application/pdf"
                ? `From ${file.name}`
                : `From image ${file.name}`),
          };
        });

        allExtractedItems.push(...validItems);
      }

      setParsedItems(allExtractedItems);
      toast.success(
        `Scanning complete. Found ${allExtractedItems.length} transactions across ${files.length} files.`,
      );
    } catch (error) {
      console.error(error);
      toast.error("Scanning failed. Check your AI settings.");
    } finally {
      setIsScanning(false);
      setModelStatus("idle");
    }
  };
```

- [ ] **Step 4: Update the scan button to show model loading progress**

Replace the scan `<Button>` JSX (the one with `onClick={handleScan}`) with:

```tsx
          <Button
            onClick={handleScan}
            disabled={files.length === 0 || isScanning || modelStatus === "downloading"}
            className="w-full h-11 rounded-xl shadow-soft-md"
          >
            {modelStatus === "downloading" ? (
              <>
                <Download className="mr-2 h-4 w-4 animate-pulse" />
                Downloading AI model... {downloadProgress}%
              </>
            ) : isScanning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing {scanProgress.current} of {scanProgress.total}...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Scan {files.length > 0 ? `${files.length} Document${files.length > 1 ? "s" : ""}` : "Documents"}
              </>
            )}
          </Button>
```

- [ ] **Step 5: Verify typecheck passes**

Run from `webapp/`:

```bash
npx tsc --build
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/transactions/AiScanner.tsx
git commit -m "feat: wire AiScanner to parseReceipt dispatcher with model loading UX"
```

---

### Task 5: Update Settings Page with AI Backend Toggle

**Files:**
- Modify: `webapp/src/pages/Settings.tsx`

- [ ] **Step 1: Add imports**

Add these imports to the top of `Settings.tsx`:

```ts
import { Cpu, Wifi } from "lucide-react";
import { isWebGpuAvailable, ensureModelLoaded, isModelLoaded, type ModelStatus } from "@/services/webgpuInference";
import type { InferenceBackend } from "@/services/localAiParser";
```

Add `Cpu` and `Wifi` to the existing `lucide-react` import line (merge with existing imports).

- [ ] **Step 2: Add state to `SettingsPage` component**

Inside `SettingsPage`, after the existing state declarations, add:

```ts
  const [inferenceBackend, setInferenceBackendState] = React.useState<InferenceBackend>(() => {
    if (!isWebGpuAvailable()) return "ollama";
    return (localStorage.getItem("inferenceBackend") as InferenceBackend) || "webgpu";
  });
  const [modelStatus, setModelStatus] = React.useState<ModelStatus>(() =>
    isModelLoaded() ? "ready" : "idle",
  );
  const [downloadProgress, setDownloadProgress] = React.useState(0);
  const webGpuSupported = React.useMemo(() => isWebGpuAvailable(), []);

  const handleBackendChange = (value: string) => {
    const backend = value as InferenceBackend;
    setInferenceBackendState(backend);
    localStorage.setItem("inferenceBackend", backend);
    toast.success(`AI backend set to ${backend === "webgpu" ? "In-Browser (WebGPU)" : "Ollama"}`);
  };

  const handlePreDownload = async () => {
    setModelStatus("downloading");
    try {
      await ensureModelLoaded((pct) => setDownloadProgress(pct));
      setModelStatus("ready");
      toast.success("AI model downloaded and ready");
    } catch (e) {
      setModelStatus("error");
      toast.error("Failed to download AI model");
      console.error(e);
    }
  };
```

- [ ] **Step 3: Replace the "Local AI (Ollama)" section**

In the `<TabsContent value="preferences">`, find the section:

```tsx
          <section className="space-y-6">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Local AI (Ollama)</h2>
            <Card title="Vision Model" ...>
```

Replace that entire `<section>` with:

```tsx
          <section className="space-y-6">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">AI Engine</h2>
            <Card title="Inference Backend" icon={<Cpu className="h-4 w-4" />} tint="accent">
              <div className="space-y-6">
                <div className="text-xs text-muted-foreground">
                  Choose how AI features like receipt scanning are powered.
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Backend</Label>
                  <Select value={inferenceBackend} onValueChange={handleBackendChange}>
                    <SelectTrigger className="max-w-xs rounded-xl bg-background/20 border-border/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="webgpu" disabled={!webGpuSupported}>
                        In-Browser (WebGPU) {!webGpuSupported && "— not supported"}
                      </SelectItem>
                      <SelectItem value="ollama">Ollama (External)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {inferenceBackend === "webgpu" && (
                  <div className="space-y-4 rounded-2xl border border-border/40 bg-background/20 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">Gemma 4 E2B</div>
                        <div className="text-xs text-muted-foreground">~1.2 GB, cached after first download</div>
                      </div>
                      {modelStatus === "ready" ? (
                        <div className="text-xs font-semibold text-income">Ready</div>
                      ) : modelStatus === "downloading" ? (
                        <div className="text-xs font-semibold text-accent">{downloadProgress}%</div>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="rounded-full px-4"
                          onClick={handlePreDownload}
                        >
                          <Download className="mr-1.5 h-4 w-4" />
                          Pre-download
                        </Button>
                      )}
                    </div>
                    {modelStatus === "downloading" && (
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
                        <div
                          className="h-full rounded-full bg-accent transition-all duration-300"
                          style={{ width: `${downloadProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {inferenceBackend === "ollama" && (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Ollama URL</Label>
                      <Input
                        className="rounded-xl bg-background/20 border-border/40"
                        defaultValue={localStorage.getItem("ollamaUrl") || "http://localhost:11434"}
                        onBlur={(e) => {
                          localStorage.setItem("ollamaUrl", e.target.value);
                          toast.success("Ollama URL saved");
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Model Name</Label>
                      <Input
                        className="rounded-xl bg-background/20 border-border/40"
                        defaultValue={localStorage.getItem("ollamaModel") || "gemma4"}
                        onBlur={(e) => {
                          localStorage.setItem("ollamaModel", e.target.value);
                          toast.success("Model saved");
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </section>
```

- [ ] **Step 4: Verify typecheck passes**

Run from `webapp/`:

```bash
npx tsc --build
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat: add AI backend toggle in Settings (WebGPU vs Ollama)"
```

---

### Task 6: Update AiChatWidget Visibility

**Files:**
- Modify: `webapp/src/components/dashboard/AiChatWidget.tsx`

- [ ] **Step 1: Add WebGPU import**

Add this import at the top of `AiChatWidget.tsx`:

```ts
import { isWebGpuAvailable } from "@/services/webgpuInference";
```

- [ ] **Step 2: Update the availability check**

Replace the existing `useEffect` that checks Ollama availability:

```ts
  useEffect(() => {
    // Check if Ollama is running on mount
    pingOllama().then(available => setIsAvailable(available));
  }, []);
```

with:

```ts
  useEffect(() => {
    if (isWebGpuAvailable()) {
      setIsAvailable(true);
      return;
    }
    pingOllama().then(available => setIsAvailable(available));
  }, []);
```

This makes the chat widget visible when WebGPU is available, even if Ollama isn't running. The chat itself still uses Ollama in this phase -- it will just show an error if the user tries to chat without Ollama when the backend is set to Ollama.

- [ ] **Step 3: Verify typecheck passes**

Run from `webapp/`:

```bash
npx tsc --build
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/AiChatWidget.tsx
git commit -m "feat: show AI chat widget when WebGPU is available"
```

---

### Task 7: Final Typecheck and Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run typecheck**

Run from `webapp/`:

```bash
npx tsc --build
```

Expected: No errors.

- [ ] **Step 2: Run Vite build**

Run from `webapp/`:

```bash
npx vite build
```

Expected: Build succeeds. Note: the `@huggingface/transformers` package is large -- the build may produce chunking warnings, which are acceptable. The ONNX runtime WASM files will be loaded at runtime from the CDN, not bundled.

- [ ] **Step 3: Fix any build issues**

If Vite has trouble with the WASM files from `@huggingface/transformers`, add this to `vite.config.ts` in the `optimizeDeps.exclude` array:

```ts
optimizeDeps: {
  exclude: ['@huggingface/transformers'],
},
```

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build issues with Transformers.js integration"
```

---

### Task 8: In-Browser Validation

**Files:** None (manual testing only)

This task validates the full integration end-to-end in a real browser. WebGPU requires HTTPS or localhost, and the model download requires network access, so this must be tested live.

- [ ] **Step 1: Start the dev server**

Run from `webapp/`:

```bash
npm run dev
```

Open the printed localhost URL in **Chrome 113+** or **Edge 113+** (these have stable WebGPU support). Do NOT use Firefox (WebGPU is behind a flag) or Safari < 18.

- [ ] **Step 2: Verify WebGPU detection in Settings**

1. Navigate to **Settings > Preferences** tab.
2. Confirm the "AI Engine" section is visible.
3. Confirm "In-Browser (WebGPU)" is selected by default and **not** disabled.
4. If testing in a browser without WebGPU, confirm the option is disabled with "not supported" text.

- [ ] **Step 3: Test model pre-download from Settings**

1. In the "AI Engine" card, click the **"Pre-download"** button.
2. Confirm a progress bar appears with percentage updating (~1.2GB download).
3. Wait for download to complete. Confirm the status changes to **"Ready"** with green text.
4. Open DevTools > Application > Cache Storage. Confirm model files are cached (look for entries from `huggingface.co`).

- [ ] **Step 4: Test backend toggle persistence**

1. Switch the backend to **"Ollama (External)"**.
2. Confirm the Ollama URL and Model Name fields appear.
3. Refresh the page. Confirm the setting persisted (still shows Ollama).
4. Switch back to **"In-Browser (WebGPU)"**. Confirm model status still shows "Ready" (cached).

- [ ] **Step 5: Test receipt scanning with WebGPU**

1. Navigate to the **Transactions** page.
2. Open the AI scanner (the receipt upload dialog).
3. Upload a sample receipt image (any photo of a receipt, or use a test image like a grocery receipt).
4. Click **"Scan 1 Document"**.
5. If the model was already pre-downloaded (Step 3), confirm scanning starts immediately without a download phase.
6. If the model was NOT pre-downloaded, confirm the button shows "Downloading AI model... X%" and then transitions to "Processing 1 of 1...".
7. Confirm parsed transactions appear with date, amount, merchant, and category fields populated.
8. Confirm no console errors related to WebGPU or model inference.

- [ ] **Step 6: Test receipt scanning fallback to Ollama**

1. Go to **Settings > Preferences > AI Engine** and switch to **"Ollama (External)"**.
2. Navigate back to Transactions and upload a receipt image.
3. Click **"Scan 1 Document"**.
4. If Ollama is running locally: confirm scanning works as before.
5. If Ollama is NOT running: confirm an appropriate error toast appears.

- [ ] **Step 7: Test PDF scanning with WebGPU**

1. Switch backend back to **"In-Browser (WebGPU)"**.
2. Upload a PDF bank statement (or any PDF with transaction-like text).
3. Click scan. Confirm transactions are extracted from the PDF text.

- [ ] **Step 8: Verify chat widget visibility**

1. Navigate to the **Dashboard**.
2. Confirm the floating AI chat button (sparkles icon) is visible in the bottom-right corner, even if Ollama is not running.
3. Click the chat button to open the chat window. Confirm it opens.
4. Type a question. If Ollama is not running, confirm the error is handled gracefully (error message in chat, no crash).

- [ ] **Step 9: Test graceful degradation (optional -- requires WebGPU-less browser)**

1. Open the app in Firefox (or a browser without WebGPU).
2. Navigate to Settings > Preferences.
3. Confirm "In-Browser (WebGPU)" is disabled with "not supported" text.
4. Confirm "Ollama" is auto-selected.
5. Confirm receipt scanning still works via Ollama (if Ollama is running).

- [ ] **Step 10: Check for memory/performance issues**

1. After a successful WebGPU scan, check the browser's Task Manager (Chrome: Shift+Esc).
2. Note the GPU memory usage. It should be in the 1-2GB range.
3. Run a second scan on a different receipt. Confirm the model does NOT re-download (should reuse the in-memory singleton).
4. Confirm no memory leaks (GPU memory stays stable, not growing with each scan).
