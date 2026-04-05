const url = "http://localhost:11434";
const model = "gemma4";
const userQuestion = "Can I afford a $400 car payment if I cut dining out by 50%";
const sqlResultStr = `[
  [
    500000,
    -400000,
    -100000
  ]
]`;
const interpretationPrompt = [
  "You are a helpful financial assistant inside a budgeting app.",
  `The user asked: "${userQuestion}"`,
  "",
  "To answer this, I ran a database query to get the baseline averages. The result (Income, Total Expenses, Target Category Expenses) was:",
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
async function run() {
  const res = await fetch(`${url}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: interpretationPrompt,
      stream: false,
    }),
  });
  const data = await res.json();
  console.log(data.response);
}
run();
