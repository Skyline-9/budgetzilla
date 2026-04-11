# WebGPU Gemma 4 Integration Design

Run Gemma 4 E2B directly in the browser via WebGPU, starting with receipt scanning. Eliminates the Ollama dependency for most users while keeping Ollama as a power-user option.

## Context

Budgetzilla currently uses Ollama (localhost:11434) to run Gemma 4 for two AI features:

- **Financial chat assistant** (`localAiChat.ts`) -- text-to-SQL pipeline that generates queries, runs them on the local SQLite DB, then interprets results with streaming.
- **Receipt/PDF scanner** (`localAiParser.ts`) -- vision-capable parsing of receipt images and PDF statements into structured transactions.

Both call Ollama's `/api/generate` endpoint. Users must install and run Ollama separately, which is a friction point.

## Goal

Make receipt scanning work out of the box with zero external dependencies by running Gemma 4 E2B (quantized) directly in the browser via WebGPU. WebGPU is the default backend; Ollama is retained as a power-user option for larger or unquantized models.

## Scope

Phase 1 (this spec): Receipt/PDF scanning via WebGPU.
Phase 2 (future): Financial chat assistant via WebGPU.

## Model Choice

**Gemma 4 E2B** (`onnx-community/gemma-4-E2B-it-ONNX`):

- 2.3B effective parameters (5.1B with embeddings), designed for on-device deployment.
- Natively supports text, image, and audio input.
- Vision encoder ~150M params with variable resolution (token budgets: 70, 140, 280, 560, 1120).
- At `q4f16` quantization: ~1-1.5GB download, cached in browser after first use.
- 128K context window.

## Library

**Transformers.js v4** (`@huggingface/transformers`):

- Native WebGPU runtime rewritten in C++ (released March 2026).
- Official Gemma 4 support via `Gemma4ForConditionalGeneration` (merged April 2, 2026).
- Provides `AutoProcessor`, `load_image`, `TextStreamer` for multimodal inference with streaming.
- Model weights cached automatically via Cache API / IndexedDB.
- Already demonstrated working in-browser by `webml-community/Gemma-4-WebGPU` HuggingFace Space.

Alternatives considered and rejected:

- **MediaPipe LLM Inference API**: primarily text-to-text, no documented multimodal/vision support for web.
- **gemma-webgpu npm**: only supports Gemma 3 (270M/1B), no vision, no Gemma 4.

## Architecture

### 1. WebGPU Inference Engine (`services/webgpuInference.ts`)

A singleton module managing the Gemma 4 E2B model lifecycle.

**Responsibilities:**

- Detect WebGPU availability via `navigator.gpu`.
- Load model lazily on first AI feature use (not on app boot).
- Report download progress via callback for UI progress bars.
- Cache model in browser automatically (Transformers.js handles this internally).
- Expose two generation methods:
  - `generateFromImage(image: Blob, prompt: string, onChunk)` -- for receipt scanning.
  - `generateFromText(prompt: string, onChunk)` -- for future chat integration.
- Hold model + processor as module-level singletons (survive across calls without reloading).

```ts
let model: Gemma4ForConditionalGeneration | null = null;
let processor: AutoProcessor | null = null;

export function isWebGpuAvailable(): boolean { ... }
export async function ensureModelLoaded(onProgress?: (pct: number) => void): Promise<void> { ... }
export async function generateFromImage(imageBlob: Blob, prompt: string, onChunk: (text: string) => void): Promise<string> { ... }
export async function generateFromText(prompt: string, onChunk: (text: string) => void): Promise<string> { ... }
```

The service is stateless beyond the cached model reference -- no React context needed, just an importable module.

### 2. Receipt Scanner Integration

**Changes to `localAiParser.ts`:**

- New `parseWithWebGpu(categories, options)` function using the WebGPU inference engine.
- Existing `parseWithOllama` stays untouched.
- New top-level `parseReceipt(categories, options)` dispatcher:
  1. Check user preference from `localStorage` (`inferenceBackend`: `"webgpu"` | `"ollama"`).
  2. If `"webgpu"` (default): check `isWebGpuAvailable()`, call `parseWithWebGpu`.
  3. If unavailable or user chose `"ollama"`: call existing `parseWithOllama`.

**Prompt reuse:** Same prompt template (category list, date context, JSON output format) for both backends. Only the image delivery differs:

- Ollama: `FileReader` -> base64 string -> `images` field.
- WebGPU: `File` -> `Blob` -> `load_image()` from Transformers.js -> processor input.

**PDF handling:** Existing `extractTextFromPdf` unchanged. Extracted text goes to `generateFromText` on the WebGPU path.

**`AiScanner.tsx` changes:** Call `parseReceipt` dispatcher instead of `parseWithOllama` directly. Add `modelStatus` state (`"idle" | "downloading" | "loading" | "ready"`) to gate the scan and show progress.

### 3. Settings UI

Modify the existing "Local AI (Ollama)" section under Preferences tab:

- Rename section heading to "AI Engine".
- Add a toggle/select between "In-Browser (WebGPU)" and "Ollama", stored in `localStorage` as `inferenceBackend`.
- When "In-Browser" selected: show model status (not downloaded / downloaded / loading), a "Pre-download Model" button, and estimated size (~1.2GB).
- When "Ollama" selected: show existing URL and model name fields.
- If WebGPU unsupported by browser: disable "In-Browser" option with tooltip explaining why.

### 4. Model Loading UX

On first use (model not yet cached):

1. User clicks "Scan Documents".
2. If model not loaded: show progress bar with download percentage ("Downloading AI model... 45% of ~1.2GB") in the existing scan button area.
3. Once loaded: proceed with scanning.
4. Subsequent uses: model loads from cache in ~5-15s, show spinner with "Loading AI model...".

Reuses existing `isScanning` / `scanProgress` state pattern. New `modelStatus` state gates the scan flow. No new components needed -- progress indicator fits within existing scan button area using the same `Loader2` spinner pattern.

### 5. Graceful Degradation

**WebGPU not available:**

- Default `inferenceBackend` to `"ollama"`.
- Disable "In-Browser" option in Settings with explanation.
- Existing Ollama flow works unchanged.

**Insufficient GPU memory:**

- Catch model load failure.
- Show toast: "Not enough GPU memory for in-browser AI. Switching to Ollama."
- Auto-flip `inferenceBackend` to `"ollama"` in localStorage.
- Retry current operation with Ollama if available.

**Both unavailable:**

- Show error explaining both options.

**Mid-inference failure:**

- Catch gracefully, surface through existing `onUpdate({ type: "error", ... })` pattern.

**Browser compatibility:** WebGPU supported in Chrome 113+, Edge 113+, Safari 18+. Firefox behind flag. Tauri's WKWebView on macOS supports WebGPU natively.

### 6. Chat Widget Visibility

Modify `AiChatWidget.tsx` to show the floating chat button when either Ollama is available OR WebGPU is available (currently hidden if Ollama ping fails). The chat itself still uses Ollama in this phase -- the widget just becomes visible so users know AI is available.

## File Changes

| File | Action | Description |
|---|---|---|
| `services/webgpuInference.ts` | Create | Singleton: WebGPU detection, model loading/caching, `generateFromImage`, `generateFromText` |
| `services/localAiParser.ts` | Modify | Add `parseWithWebGpu()`, new `parseReceipt()` dispatcher |
| `services/localAiChat.ts` | No change | Chat stays Ollama-only in phase 1 |
| `components/transactions/AiScanner.tsx` | Modify | Call `parseReceipt`; add model loading state/progress UI |
| `pages/Settings.tsx` | Modify | Rename AI section; add backend toggle; add model download status |
| `components/dashboard/AiChatWidget.tsx` | Modify | Show widget when either backend is available |
| `package.json` | Modify | Add `@huggingface/transformers` dependency |

## Not In Scope

- Financial chat assistant via WebGPU (phase 2).
- Model fine-tuning or custom model support.
- Web Worker offloading (Transformers.js runs on main thread; can be moved to worker later if needed).
- Offline-first model bundling (model is downloaded from HuggingFace Hub on first use).
