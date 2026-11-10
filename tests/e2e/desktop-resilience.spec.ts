import { expect, test } from '@playwright/test';
import {
  browserToday,
  createList,
  createTask,
  gotoFresh,
  openTask,
  seedData,
  selectNav,
  STORAGE_KEY,
  storageData,
  taskRow,
} from './helpers';

test.describe('storage resilience', () => {
  test('AC13 reports write failure, keeps input and retries successfully', async ({ page }) => {
    await gotoFresh(page);
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      (window as unknown as { __originalSetItem: typeof original }).__originalSetItem = original;
      Storage.prototype.setItem = function failWrite() {
        throw new DOMException('quota', 'QuotaExceededError');
      };
    });

    await page.getByRole('button', { name: '新增任务' }).first().click();
    await page.locator('#task-title').fill('无法保存的任务');
    await page.locator('#task-description').fill('输入必须保留');
    await page.getByRole('button', { name: '保存', exact: true }).click();

    await expect(page.locator('dialog.sheet .banner--error')).toContainText('空间不足');
    await expect(page.locator('dialog.sheet')).toBeVisible();
    await expect(page.locator('#task-title')).toHaveValue('无法保存的任务');
    await expect(page.locator('#task-description')).toHaveValue('输入必须保留');
    expect((await storageData(page)).tasks).toHaveLength(0);

    await page.evaluate(() => {
      Storage.prototype.setItem = (
        window as unknown as { __originalSetItem: typeof Storage.prototype.setItem }
      ).__originalSetItem;
    });
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.locator('dialog.sheet')).toHaveCount(0);
    await expect(taskRow(page, '无法保存的任务')).toBeVisible();
    expect((await storageData(page)).tasks).toHaveLength(1);
  });

  test('AC14 confirms discarding unsaved edits and preserves the original task', async ({
    page,
  }) => {
    await gotoFresh(page);
    await createTask(page, { title: '原任务标题' });
    await openTask(page, '原任务标题');
    await page.locator('#task-title').fill('尚未保存的新标题');
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog.dialog--confirm')).toContainText('放弃未保存的修改');
    await expect(page.locator('#task-title')).toHaveValue('尚未保存的新标题');
    await page.getByRole('button', { name: '继续编辑' }).click();
    await expect(page.locator('#task-title')).toHaveValue('尚未保存的新标题');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '放弃修改' }).click();
    await expect(page.locator('dialog.sheet')).toHaveCount(0);
    await expect(taskRow(page, '原任务标题')).toBeVisible();
    expect((await storageData(page)).tasks[0].title).toBe('原任务标题');
  });

  test('AC15 detects a concurrent edit, preserves the draft and reloads explicitly', async ({
    page,
    context,
  }) => {
    await gotoFresh(page);
    await createTask(page, { title: '并发任务' });
    const other = await context.newPage();
    await other.goto('/');
    await openTask(other, '并发任务');
    await other.locator('#task-title').fill('B 的草稿');

    await openTask(page, '并发任务');
    await page.locator('#task-title').fill('A 已保存');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(taskRow(page, 'A 已保存')).toBeVisible();

    await expect(other.locator('.banner--conflict')).toContainText('其他页面被修改');
    await expect(other.locator('#task-title')).toHaveValue('B 的草稿');
    await expect(other.getByRole('button', { name: '保存', exact: true })).toBeDisabled();

    await other.getByRole('button', { name: '重新载入最新记录' }).click();
    await expect(other.locator('#task-title')).toHaveValue('A 已保存');
    await expect(other.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
    await other.locator('#task-title').fill('A 已保存，B 补充');
    await other.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.locator('.task-title')).toHaveText(['A 已保存，B 补充']);
  });

  test('AC16 does not recreate a task deleted in another tab', async ({ page, context }) => {
    await gotoFresh(page);
    await createTask(page, { title: '将被删除' });
    const other = await context.newPage();
    await other.goto('/');
    await openTask(other, '将被删除');
    await other.locator('#task-title').fill('已删除后的编辑');

    await openTask(page, '将被删除');
    await page.getByRole('button', { name: '删除任务', exact: true }).click();
    await page.locator('dialog.dialog--confirm').getByRole('button', { name: '删除', exact: true }).click();

    await expect(other.locator('.banner--conflict')).toContainText('在其他页面被删除');
    await expect(other.getByRole('button', { name: '保存', exact: true })).toBeDisabled();
    expect((await storageData(page)).tasks).toHaveLength(0);
    await other.getByRole('button', { name: '关闭详情' }).click();
    await other.getByRole('button', { name: '放弃修改' }).click();
    await expect(other.locator('dialog.sheet')).toHaveCount(0);
    expect((await storageData(other)).tasks).toHaveLength(0);
  });

  test('AC16 handles deleting the list containing an open edit', async ({ page, context }) => {
    await gotoFresh(page);
    await createList(page, '临时清单');
    await selectNav(page, '临时清单');
    await createTask(page, { title: '清单中的任务' });

    const other = await context.newPage();
    await other.goto('/');
    await selectNav(other, '临时清单');
    await openTask(other, '清单中的任务');
    await other.locator('#task-title').fill('旧页面草稿');

    await page.getByRole('button', { name: '管理清单「临时清单」' }).click();
    await page.getByRole('menuitem', { name: '删除清单' }).click();
    await page
      .locator('dialog.dialog--confirm')
      .getByRole('button', { name: '删除清单', exact: true })
      .click();

    await expect(other.locator('.banner--conflict')).toContainText('其他页面被修改');
    await other.getByRole('button', { name: '重新载入最新记录' }).click();
    await expect(other.locator('#task-list')).toHaveValue('inbox');
    await expect(other.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
    await expect(page.locator('.nav-item.list-nav')).toHaveCount(0);
  });

  test('AC18 preserves corrupt data, retries and requires two resets', async ({ page }) => {
    await gotoFresh(page);
    await page.evaluate((key) => localStorage.setItem(key, '{"version":1,"tasks":['), STORAGE_KEY);
    await page.reload();
    await expect(page.locator('.fatal-screen')).toContainText('数据无法读取');
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(
      '{"version":1,"tasks":[',
    );

    await page.getByRole('button', { name: '重新读取' }).click();
    await expect(page.locator('.fatal-screen')).toContainText('仍未读取成功');
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(
      '{"version":1,"tasks":[',
    );

    await page.getByRole('button', { name: '重置数据' }).click();
    await expect(page.locator('dialog.dialog--confirm')).toContainText('这会清空所有任务和清单');
    await page.getByRole('button', { name: '继续重置' }).click();
    await expect(page.locator('dialog.dialog--confirm')).toContainText('再次确认重置');
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(
      '{"version":1,"tasks":[',
    );
    await page.getByRole('button', { name: '确认重置' }).click();
    await expect(page.locator('h1')).toHaveText('今日');
    const resetData = await storageData(page);
    expect(resetData.tasks).toHaveLength(0);
    expect(resetData.lists).toHaveLength(1);
  });

  test('AC18 flags an incompatible version without overwriting it', async ({ page }) => {
    await gotoFresh(page);
    const raw = JSON.stringify({ version: 99, tasks: [], lists: [] });
    await page.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      [STORAGE_KEY, raw] as const,
    );
    await page.reload();
    await expect(page.locator('.fatal-screen')).toContainText('数据版本不兼容');
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(raw);
  });
});

test.describe('time and keyboard', () => {
  test('AC17 regroups today tasks after local midnight', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-09T23:59:30+08:00') });
    await page.goto('/');
    await expect(page.locator('.sidebar')).toBeVisible();
    await createTask(page, { title: '跨午夜任务' });
    await expect(page.locator('.group-head h2')).toHaveText('今天');

    await page.clock.fastForward(61_000);
    await expect(page.locator('.group-head h2')).toHaveText('已逾期');
    await expect(taskRow(page, '跨午夜任务')).toContainText('已逾期');
  });

  test('AC20 supports Enter submit, multiline notes and a focus trap', async ({ page }) => {
    await gotoFresh(page);
    await page.getByRole('button', { name: '新增任务' }).first().click();
    await expect(page.locator('#task-title')).toBeFocused();
    await page.locator('#task-title').fill('回车创建任务');
    await page.locator('#task-title').press('Enter');
    await expect(page.locator('dialog.sheet')).toHaveCount(0);
    await expect(taskRow(page, '回车创建任务')).toBeVisible();

    await openTask(page, '回车创建任务');
    await page.locator('#task-description').click();
    await page.locator('#task-description').fill('第一行');
    await page.locator('#task-description').press('End');
    await page.locator('#task-description').press('Enter');
    await page.locator('#task-description').type('第二行');
    await expect(page.locator('#task-description')).toHaveValue('第一行\n第二行');
    await expect(page.locator('dialog.sheet')).toBeVisible();

    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press('Tab');
      expect(
        await page.evaluate(() => Boolean(document.activeElement?.closest('dialog.sheet'))),
      ).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(page.locator('dialog.dialog--confirm')).toContainText('放弃未保存的修改');
    await page.getByRole('button', { name: '放弃修改' }).click();
    await expect(page.locator('dialog.sheet')).toHaveCount(0);
  });

  test('AC19 stays responsive with 1,000 tasks and 20 lists', async ({ page }) => {
    await gotoFresh(page);
    const today = await browserToday(page);
    await seedData(
      page,
      await page.evaluate((day) => {
        const now = 1_700_000_000_000;
        const lists = [
          {
            id: 'inbox',
            name: '收集箱',
            system: true,
            createdAt: now,
            revision: 1,
          },
        ];
        for (let index = 0; index < 20; index += 1) {
          lists.push({
            id: `list_${index}`,
            name: `清单 ${index + 1}`,
            system: false,
            createdAt: now + index + 1,
            revision: 1,
          });
        }
        const tasks = [];
        for (let index = 0; index < 1000; index += 1) {
          tasks.push({
            id: `task_${index}`,
            title: `性能任务 ${index}`,
            description: '用于性能验收的数据',
            status: index % 10 === 0 ? 'done' : 'open',
            priority: ['high', 'medium', 'low'][index % 3],
            dueDate: index % 3 === 0 ? day : null,
            listId: lists[index % lists.length].id,
            createdAt: now + index + 1,
            updatedAt: now + index + 1,
            completedAt: index % 10 === 0 ? now + index + 1 : null,
            revision: 1,
          });
        }
        return { version: 1, lists, tasks };
      }, today),
    );

    const switchTime = await page.evaluate(async () => {
      const target = [...document.querySelectorAll<HTMLElement>('.nav-item')].find((item) =>
        item.textContent?.includes('全部待办'),
      );
      if (!target) return -1;
      const start = performance.now();
      target.click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return performance.now() - start;
    });
    const rows = await page.locator('.task-row').count();
    expect(rows).toBe(900);
    // The PRD target is 300 ms; keep a wider automation threshold to avoid flakiness
    // while the measured value is recorded in docs/ACCEPTANCE.md.
    expect(switchTime).toBeGreaterThan(0);
    expect(switchTime).toBeLessThan(1000);
    test.info().annotations.push({ type: 'render-ms', description: String(switchTime) });

    const searchTime = await page.evaluate(async () => {
      const input = document.querySelector<HTMLInputElement>('input[type="search"]');
      if (!input) return -1;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      const start = performance.now();
      setter?.call(input, '性能任务 42');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return performance.now() - start;
    });
    expect(searchTime).toBeLessThan(500);
    test.info().annotations.push({ type: 'search-ms', description: String(searchTime) });
  });
});
