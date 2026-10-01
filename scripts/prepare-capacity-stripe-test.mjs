// Only Stripe TEST resources; no subscriptions or payments and no live fallback.
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import Stripe from 'stripe';
import { PLANS, OFFER_VERSION, LIBRARY_EXTENSION, DELIVERY_PACK } from '../src/lib/billing/catalog.ts';
const env = parseEnv(fs.readFileSync('.env.local','utf8'));
if (!env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) throw new Error('Stripe TEST key required');
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const output = { PLATFORM_PLANS_ENABLED: 'true', STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET };
for (const item of [...PLANS.map(p=>({key:p.key,name:p.name,cents:p.priceCents,recurring:true})),{key:'library',name:'Biblioteca +10 horas',cents:LIBRARY_EXTENSION.priceCents,recurring:true},{key:'delivery_pack',name:'5.000 minutos / 90 días',cents:DELIVERY_PACK.priceCents,recurring:false}]) {
  const product = await stripe.products.create({name:`Delunivo ${item.name} (test)`,metadata:{offer_version:OFFER_VERSION,capacity_key:item.key}},{idempotencyKey:`delunivo-capacity-product-${OFFER_VERSION}-${item.key}`});
  const price = await stripe.prices.create({product:product.id,currency:'eur',unit_amount:item.cents,tax_behavior:'inclusive',...(item.recurring?{recurring:{interval:'month'}}:{})},{idempotencyKey:`delunivo-capacity-price-${OFFER_VERSION}-${item.key}`});
  if (price.livemode) throw new Error('Unexpected live resource');
  output[`STRIPE_PRICE_${item.key.toUpperCase()}_20261001`] = price.id;
}
// Synthetic rate validates inclusive arithmetic; it is not a production tax decision.
const rate=await stripe.taxRates.create({display_name:'Synthetic inclusive test',percentage:7,inclusive:true,country:'ES',jurisdiction:'Synthetic test only'},{idempotencyKey:`delunivo-capacity-synthetic-tax-${OFFER_VERSION}`});
output.PLATFORM_TAX_RATE_ID=rate.id;
fs.writeFileSync('.env.billing-test.local',Object.entries(output).map(([k,v])=>`${k}=${JSON.stringify(v??'')}`).join('\n')+'\n');
console.log('Prepared five TEST inclusive prices and a synthetic inclusive tax scenario. Secret values stored only in ignored .env.billing-test.local.');
