import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:4174/';
const OUT = new URL('../../docs/screenshots/', import.meta.url).pathname;

const seed = () => {
  const now = Date.now();
  const date = new Date();
  const iso = (offset) => {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
    const month = String(next.getMonth() + 1).padStart(2, '0');
    const day = String(next.getDate()).padStart(2, '0');
    return `${next.getFullYear()}-${month}-${day}`;
  };
  const lists = [
    { id: 'inbox', name: '收集箱', system: true, createdAt: now - 900, revision: 1 },
    { id: 'work', name: '工作', system: false, createdAt: now - 800, revision: 1 },
    { id: 'life', name: '生活', system: false, createdAt: now - 700, revision: 1 },
    { id: 'study', name: '学习', system: false, createdAt: now - 600, revision: 1 },
  ];
  let seq = 0;
  const task = (title, options) => {
    seq += 1;
    return {
      id: `shot_${seq}`,
      title,
      description: options.description ?? '',
      status: options.status ?? 'open',
      priority: options.priority ?? 'medium',
      dueDate: options.dueDate ?? null,
      listId: options.listId,
      createdAt: now - 5000 + seq,
      updatedAt: now - 5000 + seq,
      completedAt: options.status === 'done' ? now - options.completedAgo : null,
      revision: 1,
    };
  };
  const tasks = [
    task('回复客户合同修改意见', {
      listId: 'work',
      priority: 'high',
      dueDate: iso(-1),
      description: '先确认付款节点，再回复法务同事。',
    }),
    task('预约年度体检', {
      listId: 'life',
      dueDate: iso(-2),
      description: '选一个工作日上午，空腹前往。',
    }),
    task('整理产品评审待办', {
      listId: 'work',
      priority: 'high',
      dueDate: iso(0),
      description: '把评审中提到的 3 个问题拆成具体行动，今天先完成需求澄清。',
    }),
    task('写本周工作周报', {
      listId: 'work',
      dueDate: iso(0),
      description: '汇总本周进度、风险和下周计划。',
    }),
    task('给妈妈打电话', {
      listId: 'life',
      dueDate: iso(0),
      description: '问问她周末的安排。',
    }),
    task('读 20 页《设计心理学》', {
      listId: 'study',
      priority: 'low',
      dueDate: iso(0),
    }),
    task('准备周一站会', {
      listId: 'work',
      priority: 'high',
      dueDate: iso(1),
      description: '列出三个阻塞项。',
    }),
    task('交下季度房租', {
      listId: 'life',
      priority: 'high',
      dueDate: iso(3),
    }),
    task('复习 TypeScript 类型体操', {
      listId: 'study',
      priority: 'low',
      dueDate: iso(6),
    }),
    task('整理收藏的文章', {
      listId: 'inbox',
      priority: 'low',
    }),
    task('晨跑 5 公里', {
      listId: 'life',
      status: 'done',
      completedAgo: 1000 * 60 * 60 * 4,
    }),
    task('提交上月报销单', {
      listId: 'work',
      status: 'done',
      completedAgo: 1000 * 60 * 60 * 26,
    }),
  ];
  localStorage.setItem('todo.app.v1', JSON.stringify({ version: 1, lists, tasks }));
};

async function prepare(page) {
  await page.goto(APP_URL);
  await page.evaluate(seed);
  await page.reload();
  await page.waitForSelector('.task-row');
  await page.evaluate(() => document.fonts.ready);
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--lang=zh-CN'],
  env: { ...process.env, LANG: 'zh_CN.UTF-8', LC_ALL: 'zh_CN.UTF-8' },
});

const desktop = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
  colorScheme: 'light',
});
const page = await desktop.newPage();
await prepare(page);
await page.screenshot({ path: `${OUT}after-desktop-today.png` });

await page.getByRole('button', { name: '整理产品评审待办', exact: true }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}after-desktop-detail.png` });
await page.getByRole('button', { name: '关闭任务详情' }).click();

await page.getByRole('button', { name: '新建清单' }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}after-desktop-new-list.png` });
await page.getByRole('button', { name: '取消' }).click();

await page.getByRole('button', { name: '数据仅保存在本浏览器' }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}after-desktop-data-note.png` });
await page.getByRole('button', { name: '知道了' }).click();

await page.locator('.nav-item').filter({ hasText: '已完成' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}after-desktop-completed.png` });
await desktop.close();

const emptyContext = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
  colorScheme: 'light',
});
const empty = await emptyContext.newPage();
await empty.goto(APP_URL);
await empty.evaluate(() => document.fonts.ready);
await empty.screenshot({ path: `${OUT}after-desktop-empty.png` });
await empty.evaluate(() => localStorage.setItem('todo.app.v1', '{"version":1,"tasks":['));
await empty.reload();
await empty.waitForSelector('.fatal-screen');
await empty.screenshot({ path: `${OUT}after-desktop-error.png` });
await emptyContext.close();

const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
  colorScheme: 'light',
});
const phone = await mobile.newPage();
await prepare(phone);
await phone.screenshot({ path: `${OUT}after-mobile-today.png` });
await phone.locator('#mobile-menu-button').click();
await phone.waitForTimeout(300);
await phone.screenshot({ path: `${OUT}after-mobile-menu.png` });
await phone.keyboard.press('Escape');
await phone.getByRole('button', { name: '整理产品评审待办', exact: true }).click();
await phone.waitForTimeout(200);
await phone.screenshot({ path: `${OUT}after-mobile-detail.png` });
await mobile.close();

await browser.close();
console.log('screenshots written to', OUT);
