import path from 'node:path';
import fs from 'node:fs';
import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR = path.resolve(process.cwd(), '../../docs/screenshots');

test.describe('FlowBoard Refined UI & Full-Stack Workflows', () => {
  test.beforeAll(() => {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  });

  test('demo login (ajay/ajay), fixed sidebar scroll, projects, tasks, 4-column board persistence, theme toggle, responsive viewports & logout', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // 1. Open Landing Page in clean default Light Mode
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const startsInLightMode = await page.evaluate(
      () => !document.documentElement.classList.contains('dark')
    );
    expect(startsInLightMode).toBe(true);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'landing-light.png'),
      fullPage: false,
    });

    // 2. Log in using Demo Credentials (ajay / ajay)
    await page.goto('/login');
    await page.getByLabel('Email or Demo Username').fill('ajay');
    await page.getByLabel(/^Password$/i).fill('ajay');
    await page.getByRole('button', { name: /^Sign in$/i }).click();

    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Total Projects')).toBeVisible();
    await expect(page.getByText('Pending Tasks')).toBeVisible();

    // Verify 7 simple sidebar items
    const sidebar = page.getByTestId('desktop-sidebar');
    for (const label of ['Dashboard', 'My Tasks', 'Projects', 'Board', 'Team', 'Reports', 'Settings']) {
      await expect(sidebar.getByRole('link', { name: label, exact: true })).toBeVisible();
    }

    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'dashboard-light.png'),
      fullPage: false,
    });

    // 3. Verify Desktop Sidebar stays FIXED while main content scrolls
    const sidebarTopBefore = await sidebar.evaluate((el) => el.getBoundingClientRect().top);
    await page.getByTestId('main-scroll-container').evaluate((el) => {
      el.scrollTop = 450;
    });
    const sidebarTopAfter = await sidebar.evaluate((el) => el.getBoundingClientRect().top);
    expect(sidebarTopBefore).toBe(0);
    expect(sidebarTopAfter).toBe(0);

    // 4. Create Project, Add Task, Move on 4-Column Board & Verify Persistence after Refresh
    await page.goto('/app/projects');
    await page.getByRole('button', { name: /New Project/i }).click();
    const projectName = `Sprint Demo ${Date.now()}`;
    await page.getByLabel('Project Name').fill(projectName);
    await page.getByRole('button', { name: 'Create Project' }).click();
    await expect(page.getByText(projectName).first()).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('topbar-new-task-btn').click();
    const taskTitle = `Check persistence ${Date.now()}`;
    await page.getByLabel('Title').fill(taskTitle);
    await page.getByRole('button', { name: 'Add Task' }).click();

    await page.goto('/app/kanban');
    await expect(page.getByTestId('kanban-column-TODO')).toBeVisible();
    await expect(page.getByTestId('kanban-column-IN_PROGRESS')).toBeVisible();
    await expect(page.getByTestId('kanban-column-IN_REVIEW')).toBeVisible();
    await expect(page.getByTestId('kanban-column-DONE')).toBeVisible();
    await page.waitForTimeout(350);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'board-light.png'),
      fullPage: false,
    });

    // Open created task, move status to Review, edit title, reload and verify persistence
    await page.getByRole('button', { name: taskTitle, exact: true }).click();
    const editedTitle = `${taskTitle} (Updated)`;
    const titleInput = page.getByLabel('Task title');
    await titleInput.fill(editedTitle);
    await titleInput.blur();
    await page.getByLabel('Task status').click();
    await page.getByRole('option', { name: 'Review' }).click();
    await page.getByLabel('Close panel').click();

    await expect(
      page.getByTestId('kanban-column-IN_REVIEW').getByText(editedTitle)
    ).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(
      page.getByTestId('kanban-column-IN_REVIEW').getByText(editedTitle)
    ).toBeVisible({ timeout: 10_000 });

    // Clean up test task so demo workspace remains tidy
    await page.getByTestId('kanban-column-IN_REVIEW').getByText(editedTitle).click();
    await page.getByTestId('delete-task-trigger').click();
    await page.getByRole('button', { name: 'Delete Task' }).click();

    // 5. Reports page screenshot
    await page.goto('/app/analytics');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'reports-light.png'),
      fullPage: false,
    });

    // 6. Toggle to Dark Mode & verify clean dark dashboard
    await page.goto('/app/dashboard');
    await page.getByLabel(/Switch to dark mode/i).click();
    await page.waitForTimeout(450);
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDark).toBe(true);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'dashboard-dark.png'),
      fullPage: false,
    });
    await page.getByLabel(/Switch to light mode/i).click();

    // 7. Test responsive viewports: 375px, 768px, 1024px, 1440px, 1920px
    for (const width of [375, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 850 });
      await page.waitForTimeout(150);
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      expect(hasOverflow, `Horizontal overflow detected at ${width}px`).toBe(false);
    }

    // Mobile drawer navigation closes cleanly after click
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByLabel('Open navigation menu').click();
    await page.getByRole('link', { name: 'Team' }).click();
    await expect(page).toHaveURL(/\/app\/team/);

    // 8. Log out and verify redirect + log back in
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByLabel('Account menu').click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);

    // Log back in via Try Demo button
    await page.getByRole('button', { name: 'Try Demo' }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });

    expect(consoleErrors).toEqual([]);
  });
});
