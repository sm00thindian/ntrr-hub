import { expect, test } from "@playwright/test";

/**
 * Critical-path smoke for Hub P0.
 * Authenticated flows need E2E_EMAIL + magic link / session storage state (optional).
 */
test.describe("Public critical paths", () => {
  test("landing shows primary Get started and demoted Sign in", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /coordinate family care/i,
    );

    const getStarted = page.getByRole("link", { name: "Get started" });
    await expect(getStarted).toBeVisible();
    // Primary CTA is a button-styled link in main (not header)
    await expect(getStarted).toHaveClass(/shadow-sm|min-w/);

    // Header keeps Sign in as a real button
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "Sign in" })).toBeVisible();

    // Micro-trust line
    await expect(
      page.getByText(/Works with the calendars and apps you already use/i),
    ).toBeVisible();

    // Feature cards
    await expect(page.getByText("Shared task board")).toBeVisible();
    await expect(page.getByText("Clear source for every item")).toBeVisible();
  });

  test("login page loads magic-link form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Sign in", { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /email me a sign-in link/i }),
    ).toBeVisible();
  });

  test("unauthenticated app routes redirect to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("tasks route requires auth", async ({ page }) => {
    await page.goto("/tasks");
    await expect(page).toHaveURL(/\/login/);
  });

  test("settings route requires auth", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Authenticated smoke (optional)", () => {
  test.skip(!process.env.E2E_STORAGE_STATE, "Set E2E_STORAGE_STATE to run authenticated smoke");

  test.use({
    storageState: process.env.E2E_STORAGE_STATE,
  });

  test("dashboard loads needs attention and sync panels", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /needs attention/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/sync status/i).first()).toBeVisible();
  });

  test("tasks board shows filters", async ({ page }) => {
    await page.goto("/tasks");
    await expect(page.getByRole("tab", { name: /all/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("tab", { name: /mine/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /overdue/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /unassigned/i })).toBeVisible();
  });
});
