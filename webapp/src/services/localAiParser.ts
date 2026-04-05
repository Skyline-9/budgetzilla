export async function parseWithOllama(
  categories: { id: string; name: string }[],
  options: { base64Image?: string; textContent?: string }
): Promise<any[]> {
  const url = localStorage.getItem("ollamaUrl") || "http://localhost:11434";
  const model = localStorage.getItem("ollamaModel") || "gemma4";
  const today = new Date().toISOString().split("T")[0];

  const categoryListStr = categories.map((c) => `- ${c.name} (ID: ${c.id})`).join("\n");

  const prompt = [
    "You are a professional financial data parser. I am providing data from a receipt or bank statement.",
    options.base64Image ? "The data is an image." : "The data is extracted text from a PDF.",
    `Today's date is ${today}. Use this as context for identifying the year if it is missing from the receipt.`,
    "Please extract all transactions and return ONLY a JSON array of objects.",
    "Do not wrap it in markdown block quotes. Just output the raw JSON array.",
    "Each object must have exactly these keys:",
    "- \"date\": string in YYYY-MM-DD format. Look for any date mentioned. If no year is found, assume it is recent relative to today.",
    "- \"amountCents\": integer. Return ONLY the positive magnitude (e.g. 1500 for $15.00).",
    "- \"merchant\": string, the name of the store or merchant.",
    "- \"categoryId\": string, you MUST choose the most appropriate category ID from the list below based on the merchant.",
    "",
    "Available Categories:",
    categoryListStr,
    "",
    options.textContent ? `Source Text:\n${options.textContent}\n` : "",
    "If a field is missing, provide your best guess based on available context. Return ONLY valid JSON."
  ].filter(Boolean).join("\n");

  try {
    const response = await fetch(`${url}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        images: options.base64Image ? [options.base64Image] : undefined,
        stream: false,
        format: "json",
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    const rawText = data.response.trim();

    let jsonText = rawText;
    // Clean up potential markdown wrapping
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "");
      jsonText = jsonText.replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    console.error("Failed to parse with Ollama", error);
    throw error;
  }
}

export const parseReceiptWithOllama = (base64Image: string, categories: { id: string; name: string }[]) => 
  parseWithOllama(categories, { base64Image });
