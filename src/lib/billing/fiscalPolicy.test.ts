import { test } from "node:test";
import assert from "node:assert/strict";
import { assertFiscalCustomer, assertPilotTaxRate, FISCAL_POLICY_VERSION, isPilotPostalCode, validateFiscalDomicile } from "./fiscalPolicy.ts";
import { plansEnabledForSchool, plansSignupAllowed } from "./rollout.ts";

test("pilot fails closed with empty, absent, foreign or oversized allowlists", () => {
  const previous = { ...process.env };
  try {
    process.env.PLATFORM_PLANS_ENABLED = "true";
    for (const value of [undefined, "", " ", "other", "1,2,3,4,5,6"]) {
      if (value === undefined) { delete process.env.PLATFORM_PLANS_PILOT_ORGANIZATION_IDS; delete process.env.PLATFORM_PLANS_PILOT_OWNER_EMAILS; }
      else { process.env.PLATFORM_PLANS_PILOT_ORGANIZATION_IDS = value; process.env.PLATFORM_PLANS_PILOT_OWNER_EMAILS = value; }
      assert.equal(plansEnabledForSchool("school"), false);
      assert.equal(plansSignupAllowed("owner@example.test"), false);
    }
    process.env.PLATFORM_PLANS_PILOT_ORGANIZATION_IDS = "school";
    process.env.PLATFORM_PLANS_PILOT_OWNER_EMAILS = "OWNER@example.test";
    assert.equal(plansEnabledForSchool("school"), true);
    assert.equal(plansEnabledForSchool("other"), false);
    assert.equal(plansSignupAllowed("owner@example.test"), true);
    delete process.env.PLATFORM_PLANS_PILOT_OWNER_EMAILS;
    assert.equal(plansEnabledForSchool("school"), false);
    process.env.PLATFORM_PLANS_PILOT_OWNER_EMAILS = "owner@example.test";
    delete process.env.PLATFORM_PLANS_PILOT_ORGANIZATION_IDS;
    assert.equal(plansSignupAllowed("owner@example.test"), false);
    process.env.PLATFORM_PLANS_ENABLED = "false";
    assert.equal(plansEnabledForSchool("school"), false);
  } finally {
    for (const key of ["PLATFORM_PLANS_ENABLED", "PLATFORM_PLANS_PILOT_ORGANIZATION_IDS", "PLATFORM_PLANS_PILOT_OWNER_EMAILS"]) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});
test("declared fiscal domicile requires Spain, mainland or Balearic postal code and consent", () => {
  for (const value of ["28001", "07001", "01001", "50001"]) assert.equal(isPilotPostalCode(value), true);
  for (const value of ["35001", "38001", "51001", "52001", "00001", "99001", "2800", " 28001", "ABCDE", null]) assert.equal(isPilotPostalCode(value), false);
  const input = { name: "Synthetic school", line1: "Calle de Prueba 1", city: "Madrid", postalCode: "28001", country: "ES", accepted: "yes" };
  assert.equal(validateFiscalDomicile(input).address.country, "ES");
  for (const change of [{country:"FR"}, {postalCode:"35001"}, {accepted:"no"}, {name:""}, {line1:"\n"}]) assert.throws(() => validateFiscalDomicile({...input,...change}));
});
test("canonical fiscal customer rejects deleted, foreign, exempt, unbound and old-policy customers", () => {
  const customer = { name: "Synthetic school", tax_exempt: "none", address: {country:"ES",postal_code:"07001",line1:"Prueba 1",city:"Palma"}, metadata:{organization_id:"school",fiscal_policy_version:FISCAL_POLICY_VERSION} };
  assert.doesNotThrow(() => assertFiscalCustomer(customer, "school"));
  for (const change of [{deleted:true}, {tax_exempt:"exempt"}, {metadata:{organization_id:"other",fiscal_policy_version:FISCAL_POLICY_VERSION}}, {metadata:{organization_id:"school",fiscal_policy_version:"old"}}, {address:{...customer.address,postal_code:"38001"}}, {address:null}]) assert.throws(() => assertFiscalCustomer({...customer,...change}, "school"));
});
test("pilot tax rate enforces exact 21% Spanish inclusive VAT", () => {
  const rate = {active:true,inclusive:true,percentage:21,country:"ES",tax_type:"vat"};
  assert.doesNotThrow(() => assertPilotTaxRate(rate));
  for (const change of [{active:false}, {inclusive:false}, {percentage:20.99}, {percentage:10}, {country:null}, {country:"FR"}, {tax_type:"sales_tax"}]) assert.throws(() => assertPilotTaxRate({...rate,...change}));
});
