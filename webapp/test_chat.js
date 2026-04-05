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

async function testOllama() {
  const url = "http://localhost:11434";
  const model = "gemma4";
  const userQuestion = "How much did I spend this month?";
  const today = "2026-04-04";

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

  console.log("SENDING SQL PROMPT...");
  let sqlRes = await fetch(`${url}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: sqlPrompt, stream: false, format: "json" })
  });
  let sqlData = await sqlRes.json();
  console.log("SQL RESPONSE:", sqlData.response);
  
  let rawJson = sqlData.response.trim();
  let sqlQuery = "";
  try {
     const parsed = JSON.parse(rawJson);
     sqlQuery = parsed.sql;
  } catch(e) {
     console.log("Parse error:", e);
     return;
  }
  
  const sqlResultStr = `[[ -150000 ]]`;
  console.log("USING MOCK SQL RESULT:", sqlResultStr);

  const interpretationPrompt = [
    "You are a helpful financial assistant inside a budgeting app.",
    `The user asked: "${userQuestion}"`,
    "",
    "To answer this, I ran a database query to get the baseline averages. The result (e.g. Income, Total Expenses, Target Category Expenses) was:",
    sqlResultStr,
    "",
    "Note: monetary amounts in the database are stored in cents (e.g. 1500 = $15.00). Expenses are often stored as negative numbers.",
    "Analyze the result and formulate a friendly, concise, and helpful response to the user.",
    "For 'what-if' or affordability questions, carefully extract the baseline averages provided by the database. Then, calculate the hypothetical savings or costs step-by-step (e.g., cutting $1000 by 50% saves $500) before determining the final affordability.",
    "If the result contains many subcategories (e.g., 'Shopping - Clothes', 'Shopping - Electronics'), try to sum them up or summarize them by their parent category for a cleaner response.",
    "If the result is empty '[]', tell the user no matching data was found.",
    "Format the monetary amounts nicely as dollars and cents.",
    "Provide only the final response text without greetings or sign-offs."
  ].join("\n");
  
  console.log("SENDING INTERPRETATION PROMPT...");
  let intRes = await fetch(`${url}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: interpretationPrompt, stream: false })
  });
  let intData = await intRes.json();
  console.log("INTERPRETATION RESPONSE:\n", intData.response);
}

testOllama();