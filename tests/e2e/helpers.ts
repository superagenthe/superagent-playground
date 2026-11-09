import { expect, type Locator, type Page } from '@playwright/test';

export const STORAGE_KEY = 'todo.app.v1';

export async function gotoFresh(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.main')).toBeVisible();
}

export async function browserToday(page: Page): Promise<string> {
  return page.evaluate(() => {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  });
}

export async function addDays(page: Page, iso: string, days: number): Promise<string> {
  return page.evaluate(
    ([value, offset]) => {
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(year, month - 1, day + offset);
      const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
      const nextDay = String(date.getDate()).padStart(2, '0');
      return `${date.getFullYear()}-${nextMonth}-${nextDay}`;
    },
    [iso, days] as const,
  );
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: '高' | '中' | '低';
  listName?: string;
}

export async function createTask(page: Page, input: CreateTaskInput): Promise<void> {
  await page.getByRole('button', { name: '新增任务' }).first().click();
  await expect(page.locator('dialog.sheet')).toBeVisible();
  await page.locator('#task-title').fill(input.title);
  if (input.description !== undefined) {
    await page.locator('#task-description').fill(input.description);
  }
  if (input.dueDate !== undefined) {
    await page.locator('#task-due-date').fill(input.dueDate);
  }
  if (input.priority !== undefined) {
    await page.getByRole('radio', { name: input.priority }).check();
  }
  if (input.listName !== undefined) {
    await page.locator('#task-list').selectOption({ label: input.listName });
  }
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('dialog.sheet')).toHaveCount(0);
}

export async function openTask(page: Page, title: string): Promise<void> {
  await page.getByRole('button', { name: title, exact: true }).click();
  await expect(page.locator('dialog.sheet')).toBeVisible();
}

export async function saveTaskDetail(page: Page): Promise<void> {
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('dialog.sheet')).toHaveCount(0);
}

export async function createList(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: '新建清单' }).click();
  await expect(page.locator('dialog.dialog--form')).toBeVisible();
  await page.getByLabel('清单名称').fill(name);
  await page.getByRole('button', { name: '创建清单' }).click();
  await expect(page.locator('dialog.dialog--form')).toHaveCount(0);
}

export function navItem(page: Page, label: string): Locator {
  return page.locator('.nav-item').filter({ hasText: label }).first();
}

export async function selectNav(page: Page, label: string): Promise<void> {
  await navItem(page, label).click();
}

export async function navCount(page: Page, label: string): Promise<string> {
  return navItem(page, label).locator('.count-badge').innerText();
}

export async function storageData(page: Page): Promise<any> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, STORAGE_KEY);
}

export async function seedData(page: Page, data: unknown): Promise<void> {
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [STORAGE_KEY, JSON.stringify(data)] as const,
  );
  await page.reload();
  await expect(page.locator('.main')).toBeVisible();
}

export function taskRow(page: Page, title: string): Locator {
  return page.locator('.task-row').filter({ hasText: title });
}

export async function rowTitles(page: Page): Promise<string[]> {
  return page.locator('.task-title').allInnerTexts();
}
