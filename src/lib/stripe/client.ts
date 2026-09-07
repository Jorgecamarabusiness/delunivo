import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { timeout: 20_000, maxNetworkRetries: 2 });
