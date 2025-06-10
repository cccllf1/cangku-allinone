import { test, expect } from '@playwright/test';

test('筛选抽屉自动化验收', async ({ page }) => {
  await page.goto('http://192.168.11.252:8610/mobile-location-inventory');
  await page.getByRole('button', { name: /筛选/ }).click();

  const filterLabels = [
    '商品编号：',
    '颜色：',
    '尺码：',
    '数量：',
    '货位：',
    '货位状态：',
    '件数区间：'
  ];

  for (const label of filterLabels) {
    const row = page.getByText(label, { exact: false }).locator('..');
    await row.click();
    const modal = page.locator('.ant-modal, .adm-popup, .adm-picker');
    await expect(modal).toBeVisible({ timeout: 3000 });
    await page.screenshot({ path: `screenshots/filter-${encodeURIComponent(label)}.png` });
    const modalText = await modal.innerText();
    expect(modalText.trim().length).toBeGreaterThan(0);
    const cancelBtn = modal.getByRole('button', { name: /取消|关闭|×/ });
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
    } else {
      const closeBtn = modal.locator('.ant-modal-close, .adm-popup-close');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    }
    await expect(modal).toBeHidden({ timeout: 2000 });
  }
});