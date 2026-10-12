process.loadEnvFile(".env.local");
const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST",
  headers: { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
  body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 50, messages: [{ role: "user", content: "say hi" }] }) });
console.log(res.status, JSON.stringify(await res.json()));
