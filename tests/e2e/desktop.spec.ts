import { expect, test } from '@playwright/test';
import {
  addDays,
  browserToday,
  createList,
  createTask,
  gotoFresh,
  navCount,
  openTask,
  saveTaskDetail,
  seedData,
  selectNav,
  storageData,
  taskRow,
} from './helpers';

const INBOX = {
  id: 'inbox',
  name: '收集箱',
  system: true,
  createdAt: 1_700_000_000_000,
  revision: 1,
};

test.describe('task lifecycle', () => {
  test('AC01 creates a minimal task, defaults and persists after refresh', async ({ page }) => {
    await gotoFresh(page);
    const today = await browserToday(page);
    await createTask(page, { title: '买牛奶' });

    await expect(taskRow(page, '买牛奶')).toBeVisible();
    await expect(taskRow(page, '买牛奶')).toContainText('中优先级');
    await expect(taskRow(page, '买牛奶')).toContainText('收集箱');
    await expect(await navCount(page, '今日')).toBe('1');
    await expect(await navCount(page, '收集箱')).toBe('1');

    const data = await storageData(page);
    expect(data.version).toBe(1);
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0]).toMatchObject({
      title: '买牛奶',
      description: '',
      status: 'open',
      priority: 'medium',
      dueDate: today,
      listId: 'inbox',
      completedAt: null,
    });

    await page.reload();
    await expect(taskRow(page, '买牛奶')).toBeVisible();
  });

  test('AC02 validates blank and overlong titles without losing input', async ({ page }) => {
    await gotoFresh(page);
    await page.getByRole('button', { name: '新增任务' }).first().click();
    await page.locator('#task-title').fill('   ');
    await page.locator('#task-description').fill('保留的备注');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.locator('#task-title-error')).toContainText('请输入任务标题');
    await expect(page.locator('#task-description')).toHaveValue('保留的备注');

    await page.locator('#task-title').fill('字'.repeat(201));
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.locator('#task-title-error')).toContainText('不能超过 200');
    await expect(page.locator('#task-description')).toHaveValue('保留的备注');

    await page.getByRole('button', { name: '取消' }).click();
    await page.getByRole('button', { name: '放弃修改' }).click();
    expect((await storageData(page)).tasks).toHaveLength(0);
  });

  test('AC03 guards against duplicate submits', async ({ page }) => {
    await gotoFresh(page);
    await page.getByRole('button', { name: '新增任务' }).first().click();
    await page.locator('#task-title').fill('只创建一次');
    await page.evaluate(() => {
      const form = document.querySelector('form.detail-form') as HTMLFormElement;
      form.requestSubmit();
      form.requestSubmit();
    });
    await expect(page.locator('dialog.sheet')).toHaveCount(0);
    const data = await storageData(page);
    expect(data.tasks).toHaveLength(1);
    await expect(taskRow(page, '只创建一次')).toBeVisible();
  });

  test('AC04 edits every field, preserves createdAt and survives refresh', async ({ page }) => {
    await gotoFresh(page);
    await createList(page, '工作');
    await selectNav(page, '工作');
    await createTask(page, { title: '准备周会' });
    const before = (await storageData(page)).tasks[0];

    await openTask(page, '准备周会');
    await page.locator('#task-title').fill('准备产品周会');
    await page.locator('#task-description').fill('整理三个阻塞项');
    await page.locator('#task-due-date').fill(await addDays(page, await browserToday(page), 1));
    await page.getByRole('radio', { name: '高' }).check();
    await page.locator('#task-list').selectOption({ label: '收集箱' });
    await saveTaskDetail(page);

    const after = (await storageData(page)).tasks[0];
    expect(after).toMatchObject({
      title: '准备产品周会',
      description: '整理三个阻塞项',
      priority: 'high',
      listId: 'inbox',
      createdAt: before.createdAt,
      status: 'open',
    });
    expect(after.updatedAt).toBeGreaterThanOrEqual(before.updatedAt);
    expect(after.revision).toBe(before.revision + 1);

    await page.reload();
    await selectNav(page, '全部待办');
    await openTask(page, '准备产品周会');
    await expect(page.locator('#task-description')).toHaveValue('整理三个阻塞项');
    await expect(page.getByRole('radio', { name: '高' })).toBeChecked();
  });

  test('AC05 completes and reopens a task with completion timestamps', async ({ page }) => {
    await gotoFresh(page);
    await createTask(page, { title: '今天要完成' });
    await page.getByRole('button', { name: '完成任务：今天要完成' }).click();
    await expect(taskRow(page, '今天要完成')).toHaveCount(0);
    await expect(await navCount(page, '已完成')).toBe('1');

    let data = await storageData(page);
    expect(data.tasks[0].status).toBe('done');
    expect(data.tasks[0].completedAt).toBeGreaterThan(0);

    await selectNav(page, '已完成');
    await expect(taskRow(page, '今天要完成')).toBeVisible();
    await page.getByRole('button', { name: '重新打开任务：今天要完成' }).click();
    await expect(taskRow(page, '今天要完成')).toHaveCount(0);

    data = await storageData(page);
    expect(data.tasks[0].status).toBe('open');
    expect(data.tasks[0].completedAt).toBeNull();

    await selectNav(page, '今日');
    await expect(taskRow(page, '今天要完成')).toBeVisible();
  });
});

test.describe('views, sorting and filters', () => {
  test('AC06/AC07 places tasks in today, next 7 days and all views with fixed sorting', async ({
    page,
  }) => {
    await gotoFresh(page);
    const today = await browserToday(page);
    const yesterday = await addDays(page, today, -1);
    const tomorrow = await addDays(page, today, 1);
    const day7 = await addDays(page, today, 7);
    const day8 = await addDays(page, today, 8);
    let clock = 1_700_000_000_000;
    const make = (id: string, title: string, dueDate: string | null, priority = 'medium') => ({
      id,
      title,
      description: '',
      status: 'open',
      priority,
      dueDate,
      listId: 'inbox',
      createdAt: (clock += 1),
      updatedAt: clock,
      completedAt: null,
      revision: 1,
    });
    await seedData(page, {
      version: 1,
      lists: [INBOX],
      tasks: [
        make('t_overdue', '逾期任务', yesterday, 'high'),
        make('t_today_low', '今天低优先', today, 'low'),
        make('t_today_high', '今天高优先', today, 'high'),
        make('t_tomorrow', '明天任务', tomorrow),
        make('t_day7', '第七天任务', day7),
        make('t_day8', '第八天任务', day8),
        make('t_none', '无日期任务', null, 'high'),
      ],
    });

    await expect(page.locator('.group-head')).toContainText(['已逾期', '今天']);
    const todayTitles = await page.locator('.task-title').allInnerTexts();
    expect(todayTitles).toEqual([
      '逾期任务',
      '今天高优先',
      '今天低优先',
    ]);
    await expect(await navCount(page, '今日')).toBe('3');
    await expect(await navCount(page, '未来 7 天')).toBe('2');
    await expect(await navCount(page, '全部待办')).toBe('7');

    await selectNav(page, '未来 7 天');
    const day7Label = await page.evaluate((iso) => {
      const [year, month, day] = iso.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }, day7);
    await expect(page.locator('.task-title')).toHaveText(['明天任务', '第七天任务']);
    await expect(page.locator('.group-head')).toContainText(['明天', day7Label]);
    await expect(page.locator('.content')).not.toContainText('第八天任务');
    await expect(page.locator('.content')).not.toContainText('无日期任务');

    await selectNav(page, '全部待办');
    await expect(page.locator('.task-title')).toHaveCount(7);
    await expect(page.locator('.content')).toContainText('无日期任务');
  });

  test('AC08/AC09 searches text safely, combines priority and resets on navigation', async ({
    page,
  }) => {
    await gotoFresh(page);
    const today = await browserToday(page);
    let clock = 1_700_000_100_000;
    const make = (id: string, title: string, description: string, priority: string) => ({
      id,
      title,
      description,
      status: 'open',
      priority,
      dueDate: today,
      listId: 'inbox',
      createdAt: (clock += 1),
      updatedAt: clock,
      completedAt: null,
      revision: 1,
    });
    await seedData(page, {
      version: 1,
      lists: [INBOX],
      tasks: [
        make('t1', 'Weekly Meeting', '准备材料', 'high'),
        make('t2', '写周报', 'Weekly MEETING 总结', 'low'),
        make('t3', 'HTML <b>不是标签</b>', '普通备注', 'high'),
      ],
    });

    await page.getByRole('searchbox', { name: '搜索当前视图' }).fill('  meeting ');
    await expect(page.locator('.task-title')).toHaveText(['Weekly Meeting', '写周报']);
    await page.getByRole('combobox').selectOption('high');
    await expect(page.locator('.task-title')).toHaveText(['Weekly Meeting']);
    await expect(await navCount(page, '今日')).toBe('3');

    await page.getByRole('searchbox', { name: '搜索当前视图' }).fill('不是标签');
    await expect(page.locator('.task-title')).toHaveText(['HTML <b>不是标签</b>']);
    await expect(page.locator('.task-title b')).toHaveCount(0);

    await page.getByRole('searchbox', { name: '搜索当前视图' }).fill('没有这个');
    await expect(page.locator('.empty-state')).toContainText('没有符合条件的任务');
    await page.getByRole('button', { name: '清空筛选' }).last().click();
    await expect(page.locator('.task-title')).toHaveCount(3);

    await page.getByRole('searchbox', { name: '搜索当前视图' }).fill('meeting');
    await page.getByRole('combobox').selectOption('low');
    await selectNav(page, '全部待办');
    await expect(page.getByRole('searchbox', { name: '搜索当前视图' })).toHaveValue('');
    await expect(page.getByRole('combobox')).toHaveValue('all');
  });
});

test.describe('lists and deletion', () => {
  test('AC10/AC11 renames and deletes lists atomically, keeping tasks', async ({ page }) => {
    await gotoFresh(page);
    const today = await browserToday(page);
    await createList(page, '工作');
    await selectNav(page, '工作');
    await createTask(page, { title: '清单里的任务', dueDate: today });
    await createTask(page, { title: '清单里的已完成任务', dueDate: today });
    await page.getByRole('button', { name: '完成任务：清单里的已完成任务' }).click();

    await page.getByRole('button', { name: '管理清单「工作」' }).click();
    await page.getByRole('menuitem', { name: '重命名' }).click();
    await page.getByLabel('清单名称').fill('工作安排');
    await page.getByRole('button', { name: '保存名称' }).click();
    await expect(page.locator('.nav-item.list-nav').filter({ hasText: '工作安排' })).toContainText('工作安排');

    await page.getByRole('button', { name: '管理清单「工作安排」' }).click();
    await page.getByRole('menuitem', { name: '删除清单' }).click();
    await expect(page.locator('dialog.dialog--confirm')).toContainText('清单内的全部任务将移至收集箱，任务会保留。');
    await expect(page.locator('dialog.dialog--confirm')).toContainText('共 2 个任务');
    await page.getByRole('button', { name: '删除清单' }).click();
    await expect(page.locator('.nav-item.list-nav').filter({ hasText: '工作安排' })).toHaveCount(0);
    await expect(await navCount(page, '收集箱')).toBe('1');
    await expect(await navCount(page, '已完成')).toBe('1');

    await selectNav(page, '收集箱');
    await expect(page.locator('.task-title')).toHaveText(['清单里的任务']);
    await page.getByRole('tab', { name: /已完成/ }).click();
    await expect(page.locator('.task-title')).toHaveText(['清单里的已完成任务']);
    const afterDelete = await storageData(page);
    expect(afterDelete.tasks.find((task: { title: string }) => task.title === '清单里的已完成任务').listId).toBe('inbox');
    await selectNav(page, '已完成');
    await expect(taskRow(page, '清单里的已完成任务')).toContainText('收集箱');
  });

  test('AC11 prevents duplicate and reserved list names', async ({ page }) => {
    await gotoFresh(page);
    await createList(page, '读书');
    await page.getByRole('button', { name: '新建清单' }).click();
    await page.getByLabel('清单名称').fill('读书');
    await page.getByRole('button', { name: '创建清单' }).click();
    await expect(page.locator('.dialog--form')).toContainText('已存在同名清单');
    await page.getByLabel('清单名称').fill('收集箱');
    await page.getByRole('button', { name: '创建清单' }).click();
    await expect(page.locator('.dialog--form')).toContainText('不能与“收集箱”重名');
    await page.getByRole('button', { name: '取消' }).click();
    await expect(page.getByRole('button', { name: '管理清单「收集箱」' })).toHaveCount(0);
  });

  test('AC12 cancels and confirms task deletion permanently', async ({ page }) => {
    await gotoFresh(page);
    await createTask(page, { title: '待删除任务' });
    await openTask(page, '待删除任务');
    await page.getByRole('button', { name: '删除任务', exact: true }).click();
    await expect(page.locator('dialog.dialog--confirm')).toContainText('删除后无法恢复，确定删除吗？');
    await page.locator('dialog.dialog--confirm').getByRole('button', { name: '取消' }).click();
    await page.getByRole('button', { name: '关闭任务详情' }).click();
    await expect(taskRow(page, '待删除任务')).toBeVisible();

    await openTask(page, '待删除任务');
    await page.getByRole('button', { name: '删除任务', exact: true }).click();
    await page.locator('dialog.dialog--confirm').getByRole('button', { name: '删除', exact: true }).click();
    await expect(page.locator('dialog.sheet')).toHaveCount(0);
    await expect(page.locator('.task-title')).toHaveCount(0);
    expect((await storageData(page)).tasks).toHaveLength(0);
  });
});
