alter table public.organizations
  add column seller_access_terms text check(length(seller_access_terms)<=4000),
  add column seller_refund_terms text check(length(seller_refund_terms)<=4000);
alter table public.stripe_checkout_attempts add column contract_snapshot jsonb;
alter table public.purchases add column contract_snapshot jsonb;

create or replace function private.capture_course_contract()
returns trigger language plpgsql security definer set search_path='' as $$
declare school public.organizations%rowtype; course public.courses%rowtype;
begin
  if tg_op='UPDATE' then
    if new.contract_snapshot is distinct from old.contract_snapshot then raise exception 'contract_snapshot_immutable'; end if;
    return new;
  end if;
  if tg_table_name='stripe_checkout_attempts' then
    if new.checkout_kind<>'course_purchase' then return new; end if;
    select * into school from public.organizations where id=new.organization_id;
    select * into course from public.courses where id=new.course_id and organization_id=new.organization_id;
    new.contract_snapshot:=jsonb_build_object(
      'version','2026-09-07','recorded_at',now(),'course_title',course.title,
      'course_description',course.long_description,'amount_cents',new.expected_amount_total,
      'currency',new.expected_currency,'school_name',school.name,
      'seller_name',school.seller_legal_name,'seller_tax_id',school.seller_tax_id,
      'seller_address',school.seller_address,'seller_email',school.seller_contact_email,
      'seller_country',school.seller_country,'access_terms',school.seller_access_terms,
      'refund_terms',school.seller_refund_terms,
      'immediate_access_requested',coalesce(new.stripe_params#>>'{metadata,digital_content_consent}','false')='true',
      'rights_notice','La solicitud de acceso inmediato no elimina por sí sola el desistimiento. Se conservan los derechos obligatorios de consumo y conformidad. No se aplica una regla general de sin reembolsos.',
      'service_notice','Cada escuela vende y factura sus cursos. Delunivo presta la infraestructura SaaS. Este justificante no sustituye la factura del vendedor.');
  else
    select a.contract_snapshot into new.contract_snapshot from public.stripe_checkout_attempts a
      where a.stripe_session_id=new.external_reference and a.checkout_kind='course_purchase'
        and a.organization_id=new.organization_id and a.course_id=new.course_id
        and new.payment_method='stripe';
  end if;
  return new;
end;
$$;
create trigger capture_course_contract before insert or update of contract_snapshot on public.stripe_checkout_attempts
  for each row execute function private.capture_course_contract();
create trigger preserve_course_contract before insert or update of contract_snapshot on public.purchases
  for each row execute function private.capture_course_contract();
revoke all on function private.capture_course_contract() from public,anon,authenticated;
