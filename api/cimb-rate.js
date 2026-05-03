// api/cimb-rate.js
// Uses Anthropic API with web_search to get live CIMB SGD→MYR rate
// Server-side only — no CORS issues, no browser, fast (~3-5s)

module.exports = async (req, res) => {
res.setHeader(“Access-Control-Allow-Origin”, “*”);
res.setHeader(“Access-Control-Allow-Methods”, “GET”);

try {
const response = await fetch(“https://api.anthropic.com/v1/messages”, {
method: “POST”,
headers: {
“Content-Type”: “application/json”,
“x-api-key”: process.env.ANTHROPIC_API_KEY,
“anthropic-version”: “2023-06-01”,
},
body: JSON.stringify({
model: “claude-haiku-4-5-20251001”,
max_tokens: 256,
tools: [{ type: “web_search_20250305”, name: “web_search” }],
messages: [
{
role: “user”,
content:
“Search for the current CIMB Singapore SGD to MYR exchange rate today from cimbclicks.com.sg or any reliable source. Reply with ONLY a JSON object, no other text: {"rate": 3.1234}”,
},
],
}),
});

```
if (!response.ok) {
  const err = await response.text();
  throw new Error("Anthropic error: " + response.status + " " + err);
}

const data = await response.json();

const text = (data.content || [])
  .filter((b) => b.type === "text")
  .map((b) => b.text)
  .join("");

const match = text.match(/\{[^}]*"rate"\s*:\s*([\d.]+)[^}]*\}/);
if (!match) throw new Error("Could not parse rate from response: " + text.slice(0, 200));

const rate = parseFloat(match[1]);
if (rate < 2.8 || rate > 3.6) throw new Error("Rate " + rate + " out of expected range 2.8-3.6");

res.status(200).json({
  success: true,
  rate,
  pair: "SGD-MYR",
  source: "CIMB Clicks",
  fetchedAt: new Date().toISOString(),
});
```

} catch (err) {
res.status(500).json({ success: false, error: err.message });
}
};
