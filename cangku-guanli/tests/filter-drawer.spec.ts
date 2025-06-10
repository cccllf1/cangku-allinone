import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8611/mobile-location-inventory';

// 筛选项的label及其在页面中的顺序
const filterLabels = [
  '商品编号',
  '颜色',
  '尺码',
  '数量',
  '货位',
  '货位状态',
  '件数区间',
];

test.describe('移动端仓库管理-筛选抽屉自动化验收', () => {
  test('筛选抽屉各项可正常点开且有内容', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    // 点击筛选按钮
    await page.getByRole('button', { name: /筛选/i }).click();
    await page.waitForTimeout(500);

    for (const label of filterLabels) {
      // 找到筛选项并点击
      const row = page.getByText(label, { exact: false }).locator('..');
      await expect(row).toBeVisible();
      await row.click();
      await page.waitForTimeout(400);

      // 截图
      await page.screenshot({ path: `screenshots/filter-${label}.png` });

      // 检查弹窗/Picker内容
      if (label === '货位状态' || label === '件数区间') {
        // 检查Picker弹窗
        const picker = page.locator('.adm-picker-popup, .adm-picker-view');
        await expect(picker).toBeVisible();
        // 检查有选项
        const options = picker.locator('.adm-picker-column-item');
        await expect(options.first()).toBeVisible();
        // 关闭Picker
        await page.keyboard.press('Escape');
      } else {
        // 检查弹窗内容
        const modal = page.locator('.ant-modal-content');
        await expect(modal).toBeVisible();
        // 检查有可选项或"不指定"按钮
        const btns = modal.getByRole('button');
        await expect(btns.first()).toBeVisible();
        // 关闭弹窗
        await page.getByRole('button', { name: /取消|关闭|不指定/i }).first().click();
      }
      await page.waitForTimeout(300);
    }
  });
}); 

const BASE_URL = 'http://localhost:8611/mobile-location-inventory';

// 筛选项的label及其在页面中的顺序
const filterLabels = [
  '商品编号',
  '颜色',
  '尺码',
  '数量',
  '货位',
  '货位状态',
  '件数区间',
];

test.describe('移动端仓库管理-筛选抽屉自动化验收', () => {
  test('筛选抽屉各项可正常点开且有内容', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    // 点击筛选按钮
    await page.getByRole('button', { name: /筛选/i }).click();
    await page.waitForTimeout(500);

    for (const label of filterLabels) {
      // 找到筛选项并点击
      const row = page.getByText(label, { exact: false }).locator('..');
      await expect(row).toBeVisible();
      await row.click();
      await page.waitForTimeout(400);

      // 截图
      await page.screenshot({ path: `screenshots/filter-${label}.png` });

      // 检查弹窗/Picker内容
      if (label === '货位状态' || label === '件数区间') {
        // 检查Picker弹窗
        const picker = page.locator('.adm-picker-popup, .adm-picker-view');
        await expect(picker).toBeVisible();
        // 检查有选项
        const options = picker.locator('.adm-picker-column-item');
        await expect(options.first()).toBeVisible();
        // 关闭Picker
        await page.keyboard.press('Escape');
      } else {
        // 检查弹窗内容
        const modal = page.locator('.ant-modal-content');
        await expect(modal).toBeVisible();
        // 检查有可选项或"不指定"按钮
        const btns = modal.getByRole('button');
        await expect(btns.first()).toBeVisible();
        // 关闭弹窗
        await page.getByRole('button', { name: /取消|关闭|不指定/i }).first().click();
      }
      await page.waitForTimeout(300);
    }
  });
}); 

const BASE_URL = 'http://localhost:8611/mobile-location-inventory';

// 筛选项的label及其在页面中的顺序
const filterLabels = [
  '商品编号',
  '颜色',
  '尺码',
  '数量',
  '货位',
  '货位状态',
  '件数区间',
];

test.describe('移动端仓库管理-筛选抽屉自动化验收', () => {
  test('筛选抽屉各项可正常点开且有内容', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    // 点击筛选按钮
    await page.getByRole('button', { name: /筛选/i }).click();
    await page.waitForTimeout(500);

    for (const label of filterLabels) {
      // 找到筛选项并点击
      const row = page.getByText(label, { exact: false }).locator('..');
      await expect(row).toBeVisible();
      await row.click();
      await page.waitForTimeout(400);

      // 截图
      await page.screenshot({ path: `screenshots/filter-${label}.png` });

      // 检查弹窗/Picker内容
      if (label === '货位状态' || label === '件数区间') {
        // 检查Picker弹窗
        const picker = page.locator('.adm-picker-popup, .adm-picker-view');
        await expect(picker).toBeVisible();
        // 检查有选项
        const options = picker.locator('.adm-picker-column-item');
        await expect(options.first()).toBeVisible();
        // 关闭Picker
        await page.keyboard.press('Escape');
      } else {
        // 检查弹窗内容
        const modal = page.locator('.ant-modal-content');
        await expect(modal).toBeVisible();
        // 检查有可选项或"不指定"按钮
        const btns = modal.getByRole('button');
        await expect(btns.first()).toBeVisible();
        // 关闭弹窗
        await page.getByRole('button', { name: /取消|关闭|不指定/i }).first().click();
      }
      await page.waitForTimeout(300);
    }
  });
}); 

const BASE_URL = 'http://localhost:8611/mobile-location-inventory';

// 筛选项的label及其在页面中的顺序
const filterLabels = [
  '商品编号',
  '颜色',
  '尺码',
  '数量',
  '货位',
  '货位状态',
  '件数区间',
];

test.describe('移动端仓库管理-筛选抽屉自动化验收', () => {
  test('筛选抽屉各项可正常点开且有内容', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    // 点击筛选按钮
    await page.getByRole('button', { name: /筛选/i }).click();
    await page.waitForTimeout(500);

    for (const label of filterLabels) {
      // 找到筛选项并点击
      const row = page.getByText(label, { exact: false }).locator('..');
      await expect(row).toBeVisible();
      await row.click();
      await page.waitForTimeout(400);

      // 截图
      await page.screenshot({ path: `screenshots/filter-${label}.png` });

      // 检查弹窗/Picker内容
      if (label === '货位状态' || label === '件数区间') {
        // 检查Picker弹窗
        const picker = page.locator('.adm-picker-popup, .adm-picker-view');
        await expect(picker).toBeVisible();
        // 检查有选项
        const options = picker.locator('.adm-picker-column-item');
        await expect(options.first()).toBeVisible();
        // 关闭Picker
        await page.keyboard.press('Escape');
      } else {
        // 检查弹窗内容
        const modal = page.locator('.ant-modal-content');
        await expect(modal).toBeVisible();
        // 检查有可选项或"不指定"按钮
        const btns = modal.getByRole('button');
        await expect(btns.first()).toBeVisible();
        // 关闭弹窗
        await page.getByRole('button', { name: /取消|关闭|不指定/i }).first().click();
      }
      await page.waitForTimeout(300);
    }
  });
}); 

const BASE_URL = 'http://localhost:8611/mobile-location-inventory';

// 筛选项的label及其在页面中的顺序
const filterLabels = [
  '商品编号',
  '颜色',
  '尺码',
  '数量',
  '货位',
  '货位状态',
  '件数区间',
];

test.describe('移动端仓库管理-筛选抽屉自动化验收', () => {
  test('筛选抽屉各项可正常点开且有内容', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    // 点击筛选按钮
    await page.getByRole('button', { name: /筛选/i }).click();
    await page.waitForTimeout(500);

    for (const label of filterLabels) {
      // 找到筛选项并点击
      const row = page.getByText(label, { exact: false }).locator('..');
      await expect(row).toBeVisible();
      await row.click();
      await page.waitForTimeout(400);

      // 截图
      await page.screenshot({ path: `screenshots/filter-${label}.png` });

      // 检查弹窗/Picker内容
      if (label === '货位状态' || label === '件数区间') {
        // 检查Picker弹窗
        const picker = page.locator('.adm-picker-popup, .adm-picker-view');
        await expect(picker).toBeVisible();
        // 检查有选项
        const options = picker.locator('.adm-picker-column-item');
        await expect(options.first()).toBeVisible();
        // 关闭Picker
        await page.keyboard.press('Escape');
      } else {
        // 检查弹窗内容
        const modal = page.locator('.ant-modal-content');
        await expect(modal).toBeVisible();
        // 检查有可选项或"不指定"按钮
        const btns = modal.getByRole('button');
        await expect(btns.first()).toBeVisible();
        // 关闭弹窗
        await page.getByRole('button', { name: /取消|关闭|不指定/i }).first().click();
      }
      await page.waitForTimeout(300);
    }
  });
}); 