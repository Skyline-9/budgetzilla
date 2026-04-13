---
title: Local AI Document Scanner
description: Automatically extract transactions using Gemma 4 via WebGPU or Ollama.
---

Budgetzilla features a powerful local-first AI engine that can automatically extract transactions from your receipts (images) and bank statements (PDFs). **All data stays local on your device.**

## 🚀 Two Ways to Run AI

Budgetzilla supports two primary ways to run the AI engine:

### 1. WebGPU (Browser-Native)
The default and most seamless way. It uses the **Gemma 4** model directly in your browser's GPU via the Hugging Face Transformers.js library.
- **Prerequisites:** A browser with WebGPU support (Chrome 113+, Edge 113+).
- **Setup:** None! Budgetzilla will automatically download the quantized model weights on first use (approx. 1.2GB).
- **Best For:** Most users who want a one-click experience.

### 2. Ollama (Local Server)
For users who prefer to run AI as a background service or on hardware that doesn't support WebGPU.
- **Prerequisites:** [Ollama](https://ollama.com/) installed and running.
- **Model:** `ollama pull gemma4`.
- **Setup:** Configure the Ollama URL and Model Name in **Settings**.
- **Best For:** Power users, Linux users, or those with older GPUs.

---

## 📷 How to Scan Documents

1.  Navigate to the **Transactions** page.
2.  Click the **Scan Document (AI)** button.
3.  Choose your input:
    - **Image:** Upload a photo of a receipt (.jpg, .png).
    - **PDF:** Upload a bank statement (.pdf).
4.  **Wait for the AI:** The AI will analyze the document and extract:
    - **Date:** Automatically formatted to `YYYY-MM-DD`.
    - **Merchant:** The name of the store or vendor.
    - **Amount:** The total value found.
    - **Category:** The AI will attempt to match the merchant to your existing categories.
5.  **Review & Save:** You can edit any extracted field before confirming. Once ready, click **Confirm & Save** to add the transactions to your ledger.

---

## 🔒 Privacy & Security

Budgetzilla is **local-first**, which means your financial data never leaves your machine.
- **No Cloud APIs:** We don't use OpenAI, Anthropic, or any other cloud-based LLM.
- **No Data Harvesting:** Your receipts and statements are processed entirely on your GPU/CPU.
- **Offline Ready:** Once the model is cached, the AI scanner works even without an internet connection.

---

## 🛠 Troubleshooting

### WebGPU Not Loading
- Ensure you're using a supported browser (Chrome, Edge, or Arc).
- Check `chrome://gpu` to verify WebGPU is enabled.
- If it fails, try the **Ollama** fallback.

### Ollama Connection Issues (CORS)
- Verify Ollama is running (`ollama list`).
- **CORS Setup:** Browsers block requests to `localhost` from web apps (like the hosted Vercel version) unless configured otherwise.

**macOS:**
```bash
# Run Ollama with CORS origins allowed
OLLAMA_ORIGINS="https://budgetzilla-app.vercel.app,http://localhost:5173" ollama serve
```

**Windows:**
1. Search for "Edit the system environment variables" in the Start menu.
2. Click "Environment Variables".
3. Add a **New User variable**:
   - Variable name: `OLLAMA_ORIGINS`
   - Variable value: `https://budgetzilla-app.vercel.app,http://localhost:5173`
4. Restart the Ollama application.

- Performance depends on your GPU's VRAM and compute power.
