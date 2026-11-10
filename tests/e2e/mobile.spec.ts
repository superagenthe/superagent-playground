import { expect, test } from '@playwright/test';
import { gotoFresh, taskRow } from './helpers';

test.describe('mobile experience', () => {
  test('AC19 completes the core flow with a drawer and 44px targets', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoFresh(page);

    await page.locator('#mobile-menu-button').click();
    await expect(page.locator('.sidebar')).toHaveClass(/is-open/);
    await expect(page.locator('.sidebar')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.sidebar')).not.toHaveClass(/is-open/);

    const addButton = page.locator('.add-btn');
    const addBox = await addButton.boundingBox();
    expect(addBox?.width).toBeGreaterThanOrEqual(44);
    expect(addBox?.height).toBeGreaterThanOrEqual(44);

    await addButton.click();
    await expect(page.locator('dialog.sheet')).toBeVisible();
    const sheetBox = await page.locator('dialog.sheet').boundingBox();
    expect(Math.round(sheetBox?.width ?? 0)).toBe(390);
    expect(Math.round(sheetBox?.height ?? 0)).toBe(844);

    await page.locator('#task-title').fill('手机端任务');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.locator('dialog.sheet')).toHaveCount(0);
    await expect(taskRow(page, '手机端任务')).toBeVisible();

    const checkBox = await page.locator('.task-check').first().boundingBox();
    expect(checkBox?.width).toBeGreaterThanOrEqual(44);
    expect(checkBox?.height).toBeGreaterThanOrEqual(44);
    const titleBox = await page.locator('.task-title').first().boundingBox();
    expect(titleBox?.height).toBeGreaterThanOrEqual(44);

    await page.setViewportSize({ width: 360, height: 800 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    await page.getByRole('button', { name: '手机端任务', exact: true }).click();
    await expect(page.locator('dialog.sheet')).toBeVisible();
    await page.locator('#task-description').fill('手机端编辑');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.locator('dialog.sheet')).toHaveCount(0);

    await page.getByRole('button', { name: '完成任务：手机端任务' }).click();
    await expect(taskRow(page, '手机端任务')).toHaveCount(0);
    await page.locator('#mobile-menu-button').click();
    await page.locator('.nav-item').filter({ hasText: '已完成' }).click();
    await expect(page.locator('.sidebar')).not.toHaveClass(/is-open/);
    await expect(taskRow(page, '手机端任务')).toBeVisible();

    await page.getByRole('button', { name: '重新打开任务：手机端任务' }).click();
    await expect(taskRow(page, '手机端任务')).toHaveCount(0);

    await page.locator('#mobile-menu-button').click();
    await page.locator('.nav-item').filter({ hasText: '今日' }).click();
    await expect(taskRow(page, '手机端任务')).toBeVisible();
  });

  test('AC19 keeps navigation and detail usable at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await gotoFresh(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    await page.locator('#mobile-menu-button').click();
    const navBox = await page
      .locator('.nav-item')
      .filter({ hasText: '今日' })
      .boundingBox();
    expect(navBox?.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Escape');

    await page.locator('.add-btn').click();
    const titleBox = await page.locator('#task-title').boundingBox();
    expect(titleBox?.height).toBeGreaterThanOrEqual(44);
    await page.locator('#task-title').fill('360 宽度任务');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(taskRow(page, '360 宽度任务')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});
