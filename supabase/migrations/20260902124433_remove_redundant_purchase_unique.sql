-- Production inherited two equivalent UNIQUE constraints on
-- (user_id, course_id). Keep the original generated constraint and remove the
-- duplicate index/constraint to avoid redundant writes and schema drift.
alter table public.purchases
  drop constraint if exists purchases_user_course_unique;
