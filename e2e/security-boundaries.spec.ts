import { test, expect } from "@playwright/test";
import {
  ACCOUNTS,
  MAIN_COURSE_ID,
  adminClient,
  authenticatedClientFromPage,
  login,
} from "./helpers";

test("un alumno no puede elevar sus roles desde profiles", async ({ page }) => {
  await login(page, ACCOUNTS.noAccess.email, ACCOUNTS.noAccess.password);
  const client = await authenticatedClientFromPage(page);
  const {
    data: { user },
  } = await client.auth.getUser();
  expect(user).toBeTruthy();

  const { error } = await client
    .from("profiles")
    .update({ is_super_admin: true, is_admin: true })
    .eq("id", user!.id);
  expect(error).toBeTruthy();

  const { data: isSuperAdmin } = await client.rpc("is_super_admin");
  expect(isSuperAdmin).toBe(false);
});

test("un alumno sin acceso no puede crear progreso en una lección ajena", async ({
  page,
}) => {
  const admin = adminClient();
  const { data: lesson } = await admin
    .from("lessons")
    .select("id")
    .eq("course_id", MAIN_COURSE_ID)
    .limit(1)
    .single();
  expect(lesson).toBeTruthy();

  await login(page, ACCOUNTS.noAccess.email, ACCOUNTS.noAccess.password);
  const client = await authenticatedClientFromPage(page);
  const {
    data: { user },
  } = await client.auth.getUser();

  const { error } = await client.from("video_views").insert({
    user_id: user!.id,
    lesson_id: lesson!.id,
  });
  expect(error).toBeTruthy();

  const { count } = await admin
    .from("video_views")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user!.id)
    .eq("lesson_id", lesson!.id);
  expect(count).toBe(0);
});
