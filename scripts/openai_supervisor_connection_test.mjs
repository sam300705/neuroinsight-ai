const message =
  "MANUS CONNECTION TEST — NeuroInsight AI repository sam300705/neuroinsight-ai. Please reply with CONNECTION CONFIRMED and the first repository-audit instruction.";

const apiKey = process.env.OPENAI_API_KEY;
const baseUrl = (process.env.OPENAI_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "");

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is not available in this session.");
}

const response = await fetch(`${baseUrl}/responses`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-5",
    input: message,
  }),
});

const body = await response.json();
if (!response.ok) {
  throw new Error(`OpenAI connection test failed (${response.status}): ${body?.error?.message || "unknown error"}`);
}

const outputText = body.output_text || body.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("\n") || "";
console.log(outputText);
