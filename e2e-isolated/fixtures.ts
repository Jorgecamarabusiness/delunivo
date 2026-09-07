export const appFixture = {
  orgSlug: "app-e2e-a",
  freeCourse: "70000000-0000-4000-8000-000000000001",
  paidCourse: "70000000-0000-4000-8000-000000000002",
  draftCourse: "70000000-0000-4000-8000-000000000003",
  learner: { email: "app-e2e-learner@synthetic.invalid", password: "Synthetic-app-learner-123!" },
  removed: { email: "app-e2e-removed@synthetic.invalid", password: "Synthetic-app-removed-123!" },
  deleting: { email: "app-e2e-delete@synthetic.invalid", password: "Synthetic-app-delete-123!" },
  adminDelete: { email: "app-e2e-admin-delete@synthetic.invalid", password: "Synthetic-app-admin-delete-123!" },
  superadmin: { email: "app-e2e-super@synthetic.invalid", password: "Synthetic-app-super-123!" },
} as const;
