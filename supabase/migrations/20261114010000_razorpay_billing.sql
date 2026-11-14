do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plans' and column_name = 'stripe_price_id') then
    alter table public.plans rename column stripe_price_id to razorpay_plan_id;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'stripe_customer_id') then
    alter table public.profiles rename column stripe_customer_id to razorpay_customer_id;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'stripe_subscription_id') then
    alter table public.subscriptions rename column stripe_subscription_id to razorpay_subscription_id;
  end if;
end $$;

alter table public.plans add column if not exists razorpay_plan_id text unique;
alter table public.profiles add column if not exists razorpay_customer_id text unique;
alter table public.subscriptions add column if not exists razorpay_subscription_id text;
alter table public.subscriptions add column if not exists razorpay_customer_id text;
create unique index if not exists subscriptions_razorpay_subscription_id_idx
  on public.subscriptions (razorpay_subscription_id);
