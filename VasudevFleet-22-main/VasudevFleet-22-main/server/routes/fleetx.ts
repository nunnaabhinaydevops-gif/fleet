import type { RequestHandler } from "express";

const FLEETX_BASE_URL = process.env.FLEETX_BASE_URL ?? "https://api.fleetx.io/api/v1";
let accessToken: string | null = null;
let accessTokenExpiresAt = 0;

function configured() {
  return Boolean(process.env.FLEETX_USERNAME && process.env.FLEETX_PASSWORD && process.env.FLEETX_BASIC_AUTH);
}

async function login() {
  if (!configured()) throw new Error("Fleetx API credentials are not configured on the server.");
  const body = new URLSearchParams({
    username: process.env.FLEETX_USERNAME!,
    password: process.env.FLEETX_PASSWORD!,
    grant_type: "password",
  });
  const response = await fetch(`${FLEETX_BASE_URL}/login`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${process.env.FLEETX_BASIC_AUTH}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) throw new Error(`Fleetx login failed with status ${response.status}.`);
  const payload = await response.json() as Record<string, unknown>;
  const token = payload.access_token ?? payload.token ?? payload.id_token;
  if (typeof token !== "string" || !token) throw new Error("Fleetx login did not return an access token.");
  accessToken = token;
  accessTokenExpiresAt = Date.now() + 50 * 60 * 1000;
  return token;
}

async function getToken() {
  return accessToken && Date.now() < accessTokenExpiresAt ? accessToken : login();
}

export const handleFleetxRealtime: RequestHandler = async (req, res) => {
  try {
    const token = await getToken();
    const path = typeof req.query.vehicleNumber === "string"
      ? `/analytics/live/byNumber/${encodeURIComponent(req.query.vehicleNumber)}`
      : "/analytics/live";
    let response = await fetch(`${FLEETX_BASE_URL}${path}`, {
      headers: { Authorization: `bearer ${token}` },
    });
    if (response.status === 401) {
      accessToken = null;
      response = await fetch(`${FLEETX_BASE_URL}${path}`, {
        headers: { Authorization: `bearer ${await login()}` },
      });
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status).json({ message: "Fleetx realtime request failed.", details: payload });
    return res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fleetx realtime request failed.";
    return res.status(message.includes("not configured") ? 503 : 502).json({ message });
  }
};
