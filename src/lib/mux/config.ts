import "server-only";

import Mux from "@mux/mux-node";

function requireServerEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}.`);
  }
  return value;
}

export function createMuxApiClient(): Mux {
  return new Mux({
    tokenId: requireServerEnv("MUX_TOKEN_ID"),
    tokenSecret: requireServerEnv("MUX_TOKEN_SECRET"),
    maxRetries: 2,
  });
}

export function createMuxWebhookClient(): Mux {
  return new Mux({
    webhookSecret: requireServerEnv("MUX_WEBHOOK_SECRET"),
  });
}

export function createMuxSigningClient(): Mux {
  return new Mux({
    jwtSigningKey: requireServerEnv("MUX_SIGNING_KEY"),
    jwtPrivateKey: requireServerEnv("MUX_PRIVATE_KEY"),
  });
}
