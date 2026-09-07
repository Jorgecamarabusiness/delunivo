begin;
select plan(1);
do $$ declare actor uuid:='91000000-0000-4000-8000-000000000001'; org uuid:='91000000-0000-4000-8000-000000000002'; course uuid:='91000000-0000-4000-8000-000000000003'; attempt uuid:='91000000-0000-4000-8000-000000000004'; begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
    values(actor,'authenticated','authenticated','checkout-retry@synthetic.invalid','x',now(),'{}','{}');
  insert into public.organizations(id,name,slug,owner_id) values(org,'Checkout retry','checkout-retry-synthetic',actor);
  insert into public.organization_billing(organization_id,platform_subscription_status) values(org,'active');
  insert into public.courses(id,organization_id,title,description,price,status) values(course,org,'Checkout','Synthetic',10,'published');
  insert into public.stripe_checkout_attempts(id,checkout_kind,organization_id,user_id,course_id,stripe_account_id,stripe_params,expected_amount_total,expected_currency,status)
    values(attempt,'course_purchase',org,actor,course,'acct_synthetic','{}',1000,'eur','creating');
  update public.courses set price=0 where id=course;
  begin
    update public.stripe_checkout_attempts set status='creating' where id=attempt;
    raise exception 'old_price_reused';
  exception when others then if sqlerrm<>'course_price_changed' then raise; end if; end;
  update public.courses set price=10 where id=course;
  update public.profiles set account_status='deleting' where id=actor;
  begin
    update public.stripe_checkout_attempts set status='creating' where id=attempt;
    raise exception 'deleted_identity_reused';
  exception when others then if sqlerrm<>'account_inactive' then raise; end if; end;
end $$;
select pass('creating Checkout retries revalidate current price and active identity');
select * from finish();
rollback;
