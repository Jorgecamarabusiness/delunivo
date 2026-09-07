begin;
select plan(5);
do $$ declare actor uuid:='91000000-0000-4000-8000-000000000001'; org uuid:='91000000-0000-4000-8000-000000000002'; course uuid:='91000000-0000-4000-8000-000000000003'; attempt uuid:='91000000-0000-4000-8000-000000000004'; begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
    values(actor,'authenticated','authenticated','checkout-retry@synthetic.invalid','x',now(),'{}','{}'),
      ('91000000-0000-4000-8000-000000000005','authenticated','authenticated','checkout-owner@synthetic.invalid','x',now(),'{}','{}');
  insert into public.organizations(id,name,slug,owner_id) values(org,'Checkout retry','checkout-retry-synthetic','91000000-0000-4000-8000-000000000005');
  insert into public.organization_billing(organization_id,platform_subscription_status) values(org,'active');
  insert into public.organization_integrations(organization_id,stripe_account_id,stripe_connect_status) values(org,'acct_synthetic','connected');
  insert into public.courses(id,organization_id,title,description,price,status) values(course,org,'Checkout','Synthetic',10,'published');
  insert into public.stripe_checkout_attempts(id,checkout_kind,organization_id,user_id,course_id,stripe_account_id,stripe_params,expected_amount_total,expected_currency,status)
    values(attempt,'course_purchase',org,actor,course,'acct_synthetic','{}',1000,'eur','creating');
  update public.courses set price=0 where id=course;
  begin
    update public.stripe_checkout_attempts set status='creating' where id=attempt;
    raise exception 'old_price_reused';
  exception when others then if sqlerrm<>'course_price_changed' then raise; end if; end;
  update public.courses set price=10 where id=course;
  update public.organization_integrations set stripe_account_id='acct_changed' where organization_id=org;
  begin
    update public.stripe_checkout_attempts set status='creating' where id=attempt;
    raise exception 'old_connected_account_reused';
  exception when others then if sqlerrm<>'school_payment_account_changed' then raise; end if; end;
  update public.organization_integrations set stripe_account_id='acct_synthetic' where organization_id=org;
  update public.profiles set account_status='deleting' where id=actor;
  begin
    update public.stripe_checkout_attempts set status='creating' where id=attempt;
    raise exception 'deleted_identity_reused';
  exception when others then if sqlerrm<>'account_inactive' then raise; end if; end;
end $$;
select pass('creating Checkout retries revalidate current price and active identity');
update public.courses set title='Changed after checkout' where id='91000000-0000-4000-8000-000000000003';
select is((select contract_snapshot->>'course_title' from public.stripe_checkout_attempts where id='91000000-0000-4000-8000-000000000004'),'Checkout','confirmation retains the original offer after edits');
update public.stripe_checkout_attempts set stripe_session_id='cs_synthetic_confirmation' where id='91000000-0000-4000-8000-000000000004';
select public.complete_course_checkout('91000000-0000-4000-8000-000000000004','cs_synthetic_confirmation','acct_synthetic',1000,'eur','pi_synthetic_confirmation');
select is((select contract_snapshot->>'course_title' from public.purchases where external_reference='cs_synthetic_confirmation'),'Checkout','late payment retains the same immutable confirmation');
select ok((select user_id is null and reconciliation_required from public.purchases where external_reference='cs_synthetic_confirmation'),'late payment cannot restore a deleting identity');
select throws_ok($$update public.purchases set contract_snapshot='{}' where external_reference='cs_synthetic_confirmation'$$,'P0001','contract_snapshot_immutable','even privileged writes cannot silently rewrite a issued confirmation');
select * from finish();
rollback;
