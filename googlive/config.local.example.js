// Copy this file to config.local.js and fill in your Gemini API key.
// config.local.js is .gitignored so secrets don't end up in the repo.
//
// In production (Cloud Run), config.local.js is generated at container start
// by start.sh from the GEMINI_API_KEY / AGENT_PROXY_URL env vars.
window.__GEMINI_API_KEY = "AIza_your_api_key_here";
window.__AGENT_PROXY_URL = ""; // optional — proxy in front of Vertex AI Agent Engine
