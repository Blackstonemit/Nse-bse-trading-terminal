import https from "https";

const req = https.request("https://integrate.api.nvidia.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer test"
  }
}, (res) => {
  console.log("STATUS:", res.statusCode);
  res.on("data", (d) => process.stdout.write(d));
});

req.write(JSON.stringify({
  model: "meta/llama-3.1-405b-instruct",
  messages: [{role: "user", content: "hello"}]
}));
req.end();
