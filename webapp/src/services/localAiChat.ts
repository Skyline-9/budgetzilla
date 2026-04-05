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

  onUpdate({ type: "progress", content: "Generating SQL..." });

  // Step 1: Text-to-SQL
  const sqlPrompt = `You are an expert SQLite developer for a budgeting app.
Today's date is ${today}.

Here is the database schema:
${DATABASE_SCHEMA}

Tips for subjective queries (e.g., "impulse buys", "wants vs needs", "unnecessary spending"):
- "Impulse buys" are usually frequent, low-amount purchases at specific merchants (e.g. Amazon, Starbucks, Target) or in categories like "Shopping", "Dining", or "Entertainment".
- Use JOIN transactions t ON t.category_id = c.id to filter by category names.
- Group by merchant or category and use COUNT(*) or SUM(amount_cents) to find the most frequent or highest spend.

Tips for categories:
- Categories often have subcategories separated by a hyphen (e.g., "Shopping - Clothes", "Food - Groceries"). 
- To group or filter by a parent category like "Shopping", use \`c.name LIKE 'Shopping%'\` or group by \`SUBSTR(c.name, 1, CASE WHEN INSTR(c.name, ' - ') > 0 THEN INSTR(c.name, ' - ') - 1 ELSE LENGTH(c.name) END)\`.

Tips for "what-if" or affordability questions:
- DO NOT DO THE HYPOTHETICAL MATH IN SQL AND DO NOT WRITE COMPLEX SUBQUERIES.
- Instead, use this exact pattern to fetch the raw baseline averages so the interpreter can do the math:
  \`SELECT (SELECT SUM(amount_cents) FROM transactions WHERE amount_cents > 0) / COUNT(DISTINCT SUBSTR(date,1,7)) as avg_income, (SELECT SUM(amount_cents) FROM transactions WHERE amount_cents < 0) / COUNT(DISTINCT SUBSTR(date,1,7)) as avg_expense, (SELECT SUM(amount_cents) FROM transactions t JOIN categories c ON t.category_id=c.id WHERE c.name LIKE 'Dining%') / COUNT(DISTINCT SUBSTR(date,1,7)) as avg_target_category FROM transactions\`
- The interpreter step will use these raw averages to calculate the hypothetical affordability itself.

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
    onUpdate({ type: "error", content: "I'm sorry, I couldn't figure out how to query the database for that question." });
    return;
  }

  // Step 2: Execute SQL locally
  onUpdate({ type: "progress", content: "Consulting database..." });
  let sqlResultStr = "";
  let queryFailed = false;
  try {
    const resultRows = await execReadOnlySQL(sqlQuery);
    sqlResultStr = JSON.stringify(resultRows, null, 2);
  } catch (e: any) {
    console.error("Safe Execution Error on query:", sqlQuery, e);
    queryFailed = true;
    sqlResultStr = `ERROR EXECUTING QUERY: ${e.message}. The generated query was: ${sqlQuery}`;
  }

  // Step 3: Interpret Results
  onUpdate({ type: "progress", content: "Analyzing results..." });
  const interpretationPrompt = [
    "You are a helpful financial assistant inside a budgeting app.",
    `The user asked: "${userQuestion}"`,
    "",
    queryFailed ? 
      "To answer this, I attempted to run a database query but it failed with this error:\n" + sqlResultStr + "\n\nApologize to the user, explain briefly why you couldn't pull that specific data (e.g., the query was too complex or subjective), and suggest a similar but simpler question they could ask." 
    : [
      "To answer this, I ran a database query to get the baseline averages. The result (e.g. Income, Total Expenses, Target Category Expenses) was:",
      sqlResultStr,
      "",
      "Note: monetary amounts in the database are stored in cents (e.g. 1500 = $15.00). Expenses are often stored as negative numbers.",
      "Analyze the result and formulate a friendly, concise, and helpful response to the user.",
      "For 'what-if' or affordability questions, carefully extract the baseline averages provided by the database. Then, calculate the hypothetical savings or costs step-by-step (e.g., cutting $1000 by 50% saves $500) before determining the final affordability.",
      "If the result contains many subcategories (e.g., 'Shopping - Clothes', 'Shopping - Electronics'), try to sum them up or summarize them by their parent category for a cleaner response.",
      "If the result is empty '[]', tell the user no matching data was found.",
      "Format the monetary amounts nicely as dollars and cents."
    ].join("\n"),
    "",
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
        } catch(e) {
          // ignore parse errors on fragmented JSON chunks
        }
      }
    }
  } catch (e) {
    console.error("Interpretation Error:", e);
    onUpdate({ type: "error", content: "I'm sorry, I couldn't interpret the results from the database." });
  }
}
