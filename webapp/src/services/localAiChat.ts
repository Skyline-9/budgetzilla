import { execReadOnlySQL } from "@/db/sqlite";

export async function pingOllama(): Promise<boolean> {
  const url = localStorage.getItem("ollamaUrl") || "http://localhost:11434";
  try {
    const res = await fetch(`${url}/api/tags`);
    if (!res.ok) return false;
    return true;
  } catch (e) {
    return false;
  }
}

const DATABASE_SCHEMA = `
Table 'transactions':
  - id (string)
  - date (string, format YYYY-MM-DD)
  - amount_cents (integer, negative for expenses, positive for income)
  - category_id (string)
  - merchant (string)
  - notes (string)

Table 'categories':
  - id (string)
  - name (string)
  - kind (string, 'expense' or 'income')
`;

export type AiUpdate = {
  type: "progress" | "chunk" | "error";
  content: string;
};

export async function askLocalAi(userQuestion: string, onUpdate: (update: AiUpdate) => void): Promise<void> {
  const url = localStorage.getItem("ollamaUrl") || "http://localhost:11434";
  const model = localStorage.getItem("ollamaModel") || "gemma4";
  const today = new Date().toISOString().split("T")[0];

  onUpdate({ type: "progress", content: "Generating database query..." });

  // Step 1: Text-to-SQL
  const sqlPrompt = `You are an expert SQLite developer... (omitted for brevity, same as before)`;
  let sqlQuery = "";
  try {
    // ... SQL Generation ...
  } catch (e) {
    onUpdate({ type: "error", content: "I couldn't figure out how to query the database." });
    return;
  }

  // Step 2: Execute SQL
  onUpdate({ type: "progress", content: "Querying database..." });
  let sqlResultStr = "";
  let queryFailed = false;
  try {
    const resultRows = await execReadOnlySQL(sqlQuery);
    sqlResultStr = JSON.stringify(resultRows, null, 2);
  } catch (e: any) {
    queryFailed = true;
    sqlResultStr = `ERROR: ${e.message}. Query: ${sqlQuery}`;
  }

  // Step 3: Interpret
  onUpdate({ type: "progress", content: "Analyzing results..." });
  const interpretationPrompt = `You are a helpful financial assistant... (omitted for brevity, same as before)`;

  try {
    const res = await fetch(`${url}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: interpretationPrompt,
        stream: true,
      }),
    });
    
    if (!res.ok || !res.body) throw new Error("Failed to reach Ollama for interpretation");
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            onUpdate({ type: "chunk", content: parsed.response });
          }
        } catch(e) { /* ignore */ }
      }
    }
  } catch (e) {
    onUpdate({ type: "error", content: "I couldn't interpret the results from the database." });
  }
}
