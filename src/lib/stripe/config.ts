import "server-only";
import Stripe from "stripe";

export function createStripeApiClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { timeout: 20_000, maxNetworkRetries: 2 });
}
