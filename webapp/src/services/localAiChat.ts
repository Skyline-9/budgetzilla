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

export async function askLocalAi(userQuestion: string, onUpdate?: (msg: string) => void): Promise<string> {
  const url = localStorage.getItem("ollamaUrl") || "http://localhost:11434";
  const model = localStorage.getItem("ollamaModel") || "gemma4";
  const today = new Date().toISOString().split("T")[0];

  onUpdate?.("Generating database query...");

  // Step 1: Text-to-SQL
  const sqlPrompt = `You are an expert SQLite developer for a budgeting app.
Today's date is ${today}.

Here is the database schema:
${DATABASE_SCHEMA}

The user asks: "${userQuestion}"

Write a valid, read-only SQLite SELECT statement to answer the user's question. 
Return ONLY a JSON object exactly like this: {"sql": "SELECT ..."}
Do not return any other text, markdown, or explanations.`;

  let sqlQuery = "";
  try {
    const res = await fetch(`${url}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: sqlPrompt,
        stream: false,
        format: "json",
      }),
    });
    
    if (!res.ok) throw new Error("Failed to reach Ollama for SQL generation");
    
    const data = await res.json();
    let rawJson = data.response.trim();
    if (rawJson.startsWith("\`\`\`json")) {
      rawJson = rawJson.replace(/^\`\`\`json\n?/, "").replace(/\n?\`\`\`$/, "");
    } else if (rawJson.startsWith("\`\`\`")) {
      rawJson = rawJson.replace(/^\`\`\`\n?/, "").replace(/\n?\`\`\`$/, "");
    }
    
    const parsed = JSON.parse(rawJson);
    if (!parsed.sql) throw new Error("AI did not return a valid SQL string");
    sqlQuery = parsed.sql;
  } catch (e) {
    console.error("SQL Generation Error:", e);
    return "I'm sorry, I couldn't figure out how to query the database for that question.";
  }

  // Step 2: Execute SQL locally
  onUpdate?.("Querying database...");
  let sqlResultStr = "";
  try {
    const resultRows = await execReadOnlySQL(sqlQuery);
    sqlResultStr = JSON.stringify(resultRows, null, 2);
  } catch (e) {
    console.error("Safe Execution Error on query:", sqlQuery, e);
    return "I encountered an error trying to query your data. The generated query was invalid or prohibited for safety.";
  }

  // Step 3: Interpret Results
  onUpdate?.("Analyzing results...");
  const interpretationPrompt = [
    "You are a helpful financial assistant inside a budgeting app.",
    `The user asked: "${userQuestion}"`,
    "",
    "To answer this, I ran a database query. The result was:",
    sqlResultStr,
    "",
    "Note: monetary amounts in the database are stored in cents (e.g. 1500 = $15.00). Expenses are often stored as negative numbers.",
    "Analyze the result and formulate a friendly, concise, and helpful response to the user.",
    "If the result is empty '[]', tell the user no matching data was found.",
    "Format the monetary amounts nicely as dollars and cents.",
    "Provide only the final response text without greetings or sign-offs."
  ].join("\n");

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

    if (!res.ok) throw new Error("Failed to reach Ollama for interpretation");
    
    if (!res.body) throw new Error("No response body");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let finalAnswer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            finalAnswer += parsed.response;
            onUpdate?.(finalAnswer); // Stream back to UI
          }
        } catch(e) {
          // ignore parse errors on fragmented JSON chunks
        }
      }
    }
    
    return finalAnswer;

  } catch (e) {
    console.error("Interpretation Error:", e);
    return "I'm sorry, I couldn't interpret the results from the database.";
  }
}
