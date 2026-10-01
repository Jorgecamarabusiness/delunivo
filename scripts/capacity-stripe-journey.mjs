// Genuine Stripe TEST + actual application services + native isolated PostgreSQL.
import fs from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {chromium} from '@playwright/test';
const isolated=parseEnv(fs.readFileSync('.env.capacity-isolated.local','utf8'));
const configured=parseEnv(fs.readFileSync('.env.billing-test.local','utf8'));
if(new URL(isolated.NEXT_PUBLIC_SUPABASE_URL).origin!=='http://127.0.0.1:54398' || !configured.STRIPE_SECRET_KEY?.startsWith('sk_test_')) throw new Error('Explicit isolated loopback and Stripe TEST required');
Object.assign(process.env,configured,isolated,{EMAIL_DELIVERY_MODE:'off',PLATFORM_PLANS_ENABLED:'true',NEXT_PUBLIC_SITE_URL:'http://127.0.0.1:9'});
process.env.STRIPE_WEBHOOK_SECRET='whsec_synthetic_isolated_capacity';
const {POST:platformWebhook}=await import('../src/app/api/webhooks/stripe/route.ts');
const services=await import('../src/lib/stripe/capacityBilling.ts');
const {handlePlatformSubscriptionCheckout}=await import('../src/lib/stripe/handlePlatformBilling.ts');
const {createAdminClient}=await import('../src/lib/supabase/admin.ts');
const {trialOfferSnapshot}=await import('../src/lib/billing/catalog.ts');
const {handleCapacityRefund,reconcileCapacitySubscription}=await import('../src/lib/stripe/capacityEvents.ts');
const stripe=new Stripe(configured.STRIPE_SECRET_KEY); const db=createAdminClient();
const actor=randomUUID(),org=randomUUID(),nonce=Date.now();
const sql=`insert into auth.users(id,email,raw_user_meta_data) values('${actor}','capacity-${nonce}@synthetic.invalid','{}'); insert into public.organizations(id,name,slug,owner_id) values('${org}','Stripe synthetic','stripe-synthetic-${nonce}','${actor}'); insert into public.organization_admins(organization_id,user_id,role) values('${org}','${actor}','owner'); insert into public.organization_billing(organization_id,platform_subscription_status,access_mode,discount_percent,discount_duration,manual_discount_remaining_payments) values('${org}','canceled','standard',20,'once',1);`;
execFileSync(path.join(process.env.TEMP,'delunivo-capacity-tools','postgres','pgsql','bin','psql.exe'),['-h','127.0.0.1','-p','54399','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',sql],{stdio:'ignore',windowsHide:true});
const trial=await db.rpc('start_platform_trial',{p_organization_id:org,p_offer:trialOfferSnapshot()}); assert.equal(trial.error,null);
const clock=await stripe.testHelpers.testClocks.create({frozen_time:Math.floor(Date.now()/1000),name:`capacity-${nonce}`});
const customer=await stripe.customers.create({email:`capacity-${nonce}@example.com`,test_clock:clock.id,metadata:{synthetic:'true'}});
assert.equal(customer.livemode,false);
const customerSaved=await db.from('organization_billing').update({platform_stripe_customer_id:customer.id}).eq('organization_id',org); assert.equal(customerSaved.error,null);
const report={startedAt:new Date().toISOString(),environment:'Stripe TEST + PostgreSQL native / application services',organizationId:org,checks:[],resources:{customer:customer.id,clock:clock.id}};
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
const actualNow=Date.now;
async function advanceClock(at){
  await stripe.testHelpers.testClocks.advance(clock.id,{frozen_time:at});
  for(let i=0;i<90;i++) {if((await stripe.testHelpers.testClocks.retrieve(clock.id)).status==='ready') return; await page.waitForTimeout(1000);}
  throw new Error('Synthetic Stripe clock did not finish advancing');
}
async function completeCheckout(url){
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1500);
  // Save diagnostics in ignored test output, containing synthetic identities only.
  fs.mkdirSync('test-results/capacity-stripe',{recursive:true});
  fs.writeFileSync('test-results/capacity-stripe/checkout-fields.json',JSON.stringify(await page.locator('input,select,button').evaluateAll(nodes=>nodes.map(n=>({tag:n.tagName,id:n.id,name:n.name,type:n.type,text:n.textContent?.slice(0,90),placeholder:n.getAttribute('placeholder')}))),null,2));
  const fill=async(selector,value)=>{const field=page.locator(selector).first();if(await field.count()) await field.fill(value);};
  await fill('#email',`capacity-${nonce}@example.com`);
  await fill('#cardNumber','4242424242424242'); await fill('#cardExpiry','12/30'); await fill('#cardCvc','123');
  await fill('#billingName','Synthetic Capacity Test');
  const country=page.locator('#billingCountry');if(await country.count()) await country.selectOption('ES');
  await fill('#billingAddressLine1','Calle Sintetica 1');await fill('#billingLocality','Madrid');await fill('#billingPostalCode','28001');
  const state=page.locator('#billingAdministrativeArea'); if(await state.count()) {if(await state.evaluate(n=>n.tagName)==='SELECT') await state.selectOption({label:'Madrid'});else await state.fill('Madrid');}
  await page.screenshot({path:'test-results/capacity-stripe/checkout.png',fullPage:true});
  const attempt=(await db.from('stripe_checkout_attempts').select('stripe_session_id').eq('organization_id',org).in('status',['creating','open']).single()).data;
  assert.ok(attempt?.stripe_session_id);
  await page.locator('[data-testid="hosted-payment-submit-button"],.SubmitButton').first().click();
  for(let i=0;i<40;i++) {
    const session=await stripe.checkout.sessions.retrieve(attempt.stripe_session_id);
    if(session.status==='complete') return session;
    await page.waitForTimeout(1000);
  }
  fs.writeFileSync('test-results/capacity-stripe/checkout-failure.txt',await page.locator('body').innerText());
  throw new Error('Stripe TEST checkout did not complete; inspect synthetic diagnostics.');
}
async function signedEvent(type,object,eventId=`evt_synthetic_${randomUUID()}`,account) {
 const payload=JSON.stringify({id:eventId,object:'event',type,created:Math.floor(Date.now()/1000),livemode:false,data:{object},...(account ? {account} : {})});
 const signature=stripe.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_WEBHOOK_SECRET});
 return platformWebhook(new Request('http://127.0.0.1:9/api/webhooks/stripe',{method:'POST',headers:{'stripe-signature':signature},body:payload}));
}
try {
  console.log('Creating and completing the actual Inicio checkout.');
  const url=await services.createCapacityCheckout(org,actor,'inicio');
  const initial=await completeCheckout(url);
  await handlePlatformSubscriptionCheckout(initial,new Date());
  // Checkout binding succeeded but its capacity confirmation was lost.
  await services.settleCapacityCheckouts(org);
  await services.fulfilCapacityCheckout(initial);
  const duplicateId=`evt_synthetic_${randomUUID()}`;
  assert.equal((await signedEvent('checkout.session.completed',initial,duplicateId)).status,200);
  assert.equal((await (await signedEvent('checkout.session.completed',initial,duplicateId)).json()).duplicate,true);
  assert.equal((await (await signedEvent('checkout.session.completed',initial,undefined,'acct_synthetic_connected')).json()).ignored,'connect_account_on_platform_endpoint');
  assert.equal((await platformWebhook(new Request('http://127.0.0.1:9/api/webhooks/stripe',{method:'POST',headers:{'stripe-signature':'invalid'},body:'{}'}))).status,400);
  report.checks.push('Signed webhook route accepts payment once, rejects invalid signatures and ignores Connect account');
  const bill=(await db.from('organization_billing').select('*').eq('organization_id',org).single()).data;
  assert.equal(bill.plan_key,'inicio');assert.equal(bill.quota_mode,'enforce');assert.equal(bill.manual_discount_remaining_payments,0);
  const subscriptionId=typeof initial.subscription==='string' ? initial.subscription : initial.subscription.id;
  report.resources.subscription=subscriptionId;
  const sub=await stripe.subscriptions.retrieve(subscriptionId,{expand:['latest_invoice']});
  assert.equal(sub.latest_invoice.amount_paid,2400,'20% initial discount retains its amount');
  assert.equal(sub.latest_invoice.total,2400,'inclusive tax does not add to the final price');
  assert.equal((await db.from('platform_capacity_cycles').select('id').eq('organization_id',org).neq('plan_key','trial')).data.length,1);
  report.checks.push('Actual hosted checkout, inclusive synthetic 7% tax, once discount, duplicate fulfilment');
  console.log('Testing library purchase and exact upgrade previews.');
  const libraryQuote=await services.quoteCapacityChange(org,actor,'library',undefined,1);
  const libraryResult=await services.confirmCapacityChange(org,libraryQuote.id,actor);
  assert.equal(libraryResult.status,'completed');
  assert.equal((await db.from('organization_billing').select('library_extension_quantity').eq('organization_id',org).single()).data.library_extension_quantity,1);
  const initialItem=sub.items.data[0];
  const midpoint=Math.floor((initialItem.current_period_start+initialItem.current_period_end)/2);
  await advanceClock(midpoint);
  Date.now=()=>midpoint*1000;
  const quote=await services.quoteCapacityChange(org,actor,'upgrade','crece',1);
  Date.now=actualNow;
  const upgraded=await services.confirmCapacityChange(org,quote.id,actor);
  assert.equal(upgraded.status,'completed');
  await services.reconcileCapacityOperation(quote.id);
  assert.equal((await db.from('platform_capacity_increases').select('id').eq('organization_id',org)).data.length,1);
  const increase=(await db.from('platform_capacity_increases').select('base_seconds,grace_seconds').eq('organization_id',org).single()).data;
  assert.equal(Number(increase.base_seconds),150000,'exact half-cycle upgrade adds only 2500 minutes');
  assert.equal(Number(increase.grace_seconds),15000,'grace increases proportionally, without resetting spent');
  report.checks.push('Recurring library activation, exact provider quote paid once, upgrade deduplicated');
  console.log('Testing declined update and recovery after confirmed payment.');
  const current=await stripe.subscriptions.retrieve(subscriptionId);
  const validMethod=typeof current.default_payment_method==='string' ? current.default_payment_method : current.default_payment_method.id;
  const declined=await stripe.paymentMethods.attach('pm_card_chargeCustomerFail',{customer:customer.id});
  await stripe.subscriptions.update(subscriptionId,{default_payment_method:declined.id});
  Date.now=()=>midpoint*1000;
  const rejectedQuote=await services.quoteCapacityChange(org,actor,'upgrade','academia',1);
  Date.now=actualNow;
  assert.equal((await services.confirmCapacityChange(org,rejectedQuote.id,actor)).status,'pending_payment');
  assert.equal((await db.from('organization_billing').select('plan_key').eq('organization_id',org).single()).data.plan_key,'crece','declined payment grants nothing');
  const rejectedOp=(await db.from('platform_billing_operations').select('invoice_id').eq('id',rejectedQuote.id).single()).data;
  await stripe.invoices.pay(rejectedOp.invoice_id,{payment_method:validMethod});
  await stripe.subscriptions.update(subscriptionId,{default_payment_method:validMethod});
  await services.reconcileCapacityOperation(rejectedQuote.id);
  assert.equal((await db.from('organization_billing').select('plan_key').eq('organization_id',org).single()).data.plan_key,'academia');
  report.checks.push('Declined payment grants nothing; confirmed retry restores pending upgrade once');
  console.log('Testing expiring checkout recovery and a paid delivery pack.');
  await services.createCapacityCheckout(org,actor,'delivery_pack');
  const abandonedOperation=(await db.from('platform_billing_operations').select('id').eq('organization_id',org).eq('kind','delivery_pack').eq('status','processing').single()).data;
  await services.recoverCapacityPayment(org,abandonedOperation.id,'expire');
  await services.settleCapacityCheckouts(org);
  const pack=await completeCheckout(await services.createCapacityCheckout(org,actor,'delivery_pack'));
  const packIntent=typeof pack.payment_intent==='string' ? pack.payment_intent : pack.payment_intent.id;
  // Refund precedes delivery of the checkout webhook: grant and refund are atomic.
  await stripe.refunds.create({payment_intent:packIntent,amount:1000});
  const activationBefore=Date.now();
  await services.fulfilCapacityCheckout(pack);
  const activatedPack=(await db.from('platform_delivery_packs').select('*').eq('organization_id',org).single()).data;
  assert(Date.parse(activatedPack.starts_at)>=activationBefore-1000 && Date.parse(activatedPack.starts_at)<=Date.now()+1000,'Pack starts at first server-confirmed activation, not Stripe Test Clock charge time');
  assert.equal(Date.parse(activatedPack.expires_at)-Date.parse(activatedPack.starts_at),90*86400000);
  await services.fulfilCapacityCheckout(pack);
  assert.equal((await db.from('platform_delivery_packs').select('starts_at').eq('organization_id',org).single()).data.starts_at,activatedPack.starts_at,'Duplicate delivery cannot restart validity');
  assert.equal((await db.from('platform_delivery_packs').select('id').eq('organization_id',org)).data.length,1);
  const packPayment=await stripe.paymentIntents.retrieve(packIntent);
  const charge=await stripe.charges.retrieve(typeof packPayment.latest_charge==='string' ? packPayment.latest_charge : packPayment.latest_charge.id);
  await handleCapacityRefund(charge);await handleCapacityRefund(charge);
  assert.equal((await db.from('platform_pack_refunds').select('seconds').eq('pack_id',(await db.from('platform_delivery_packs').select('id').eq('organization_id',org).single()).data.id)).data[0].seconds,150000);
  assert.equal((await db.from('platform_pack_refunds').select('refund_id').eq('pack_id',(await db.from('platform_delivery_packs').select('id').eq('organization_id',org).single()).data.id)).data.length,1);
  report.checks.push('Expired checkout unlocks next purchase; actual pack paid and granted once');
  console.log('Testing scheduled reduction, resume and period-end cancellation.');
  const down=await services.quoteCapacityChange(org,actor,'downgrade','inicio',0);
  assert.equal((await services.confirmCapacityChange(org,down.id,actor)).status,'scheduled');
  await advanceClock(initialItem.current_period_end+3600);
  const renewed=await stripe.subscriptions.retrieve(subscriptionId);
  const renewalInvoice=typeof renewed.latest_invoice==='string' ? renewed.latest_invoice : renewed.latest_invoice.id;
  await reconcileCapacitySubscription(org,subscriptionId,renewalInvoice);
  await reconcileCapacitySubscription(org,subscriptionId,renewalInvoice);
  const renewalBilling=(await db.from('organization_billing').select('plan_key,library_extension_quantity').eq('organization_id',org).single()).data;
  assert.equal(renewalBilling.plan_key,'inicio');assert.equal(renewalBilling.library_extension_quantity,0);
  assert.equal((await db.from('platform_capacity_cycles').select('id').eq('organization_id',org).neq('plan_key','trial')).data.length,2);
  report.checks.push('Actual Test Clock renewal applies downgrade and library cancellation once; pack retained across cycles');
  const resume=await services.quoteCapacityChange(org,actor,'resume');await services.confirmCapacityChange(org,resume.id,actor);
  const cancel=await services.quoteCapacityChange(org,actor,'cancel');await services.confirmCapacityChange(org,cancel.id,actor);
  assert.equal((await stripe.subscriptions.retrieve(subscriptionId)).cancel_at_period_end,true);
  assert.equal((await db.from('organization_billing').select('retention_until').eq('organization_id',org).single()).data.retention_until,null);
  report.checks.push('Scheduled downgrade, schedule release/resume, cancel retains paid access');
  report.completedAt=new Date().toISOString();
} catch(error) {
  report.failure=error.message;
  throw new Error(error.message);
} finally {
  Date.now=actualNow;
  await browser.close();
  // Synthetic TEST clock owns all created billing resources. No real customer is affected.
  await stripe.testHelpers.testClocks.del(clock.id);
  fs.mkdirSync('docs/evidencias/plans-2026-10-01',{recursive:true});
  fs.writeFileSync('docs/evidencias/plans-2026-10-01/stripe-test-journey.json',JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(`test-results/capacity-stripe/journey-${nonce}.json`,JSON.stringify(report,null,2)+'\n');
}
console.log(`Stripe TEST journey passed ${report.checks.length} integrated groups.`);
