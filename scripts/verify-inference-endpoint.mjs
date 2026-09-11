const base = process.env.INFERENCE_API_BASE_URL?.replace(/\/$/, "");

if (!base) {
  throw new Error("INFERENCE_API_BASE_URL is required for the external inference-service smoke check.");
}

const response = await fetch(`${base}/health`);
if (!response.ok) throw new Error(`Inference health check failed with HTTP ${response.status}.`);

const payload = await response.json();
if (payload?.status !== "ok" || payload?.service !== "neuroinsight-inference") {
  throw new Error("Inference health endpoint returned an unexpected response shape.");
}

console.log(`Inference service health check passed for ${base}.`);
