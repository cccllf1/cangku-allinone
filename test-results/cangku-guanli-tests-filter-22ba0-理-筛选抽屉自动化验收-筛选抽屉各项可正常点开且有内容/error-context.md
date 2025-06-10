# Test info

- Name: 移动端仓库管理-筛选抽屉自动化验收 >> 筛选抽屉各项可正常点开且有内容
- Location: /Volumes/docker/cangku-allinone/cangku-guanli/tests/filter-drawer.spec.ts:17:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8611/mobile-location-inventory
Call log:
  - navigating to "http://localhost:8611/mobile-location-inventory", waiting until "load"

    at /Volumes/docker/cangku-allinone/cangku-guanli/tests/filter-drawer.spec.ts:18:16
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | const BASE_URL = 'http://localhost:8611/mobile-location-inventory';
   4 |
   5 | // 筛选项的label及其在页面中的顺序
   6 | const filterLabels = [
   7 |   '商品编号',
   8 |   '颜色',
   9 |   '尺码',
  10 |   '数量',
  11 |   '货位',
  12 |   '货位状态',
  13 |   '件数区间',
  14 | ];
  15 |
  16 | test.describe('移动端仓库管理-筛选抽屉自动化验收', () => {
  17 |   test('筛选抽屉各项可正常点开且有内容', async ({ page }) => {
> 18 |     await page.goto(BASE_URL);
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8611/mobile-location-inventory
  19 |     await page.waitForLoadState('networkidle');
  20 |     // 点击筛选按钮
  21 |     await page.getByRole('button', { name: /筛选/i }).click();
  22 |     await page.waitForTimeout(500);
  23 |
  24 |     for (const label of filterLabels) {
  25 |       // 找到筛选项并点击
  26 |       const row = page.getByText(label, { exact: false }).locator('..');
  27 |       await expect(row).toBeVisible();
  28 |       await row.click();
  29 |       await page.waitForTimeout(400);
  30 |
  31 |       // 截图
  32 |       await page.screenshot({ path: `screenshots/filter-${label}.png` });
  33 |
  34 |       // 检查弹窗/Picker内容
  35 |       if (label === '货位状态' || label === '件数区间') {
  36 |         // 检查Picker弹窗
  37 |         const picker = page.locator('.adm-picker-popup, .adm-picker-view');
  38 |         await expect(picker).toBeVisible();
  39 |         // 检查有选项
  40 |         const options = picker.locator('.adm-picker-column-item');
  41 |         await expect(options.first()).toBeVisible();
  42 |         // 关闭Picker
  43 |         await page.keyboard.press('Escape');
  44 |       } else {
  45 |         // 检查弹窗内容
  46 |         const modal = page.locator('.ant-modal-content');
  47 |         await expect(modal).toBeVisible();
  48 |         // 检查有可选项或"不指定"按钮
  49 |         const btns = modal.getByRole('button');
  50 |         await expect(btns.first()).toBeVisible();
  51 |         // 关闭弹窗
  52 |         await page.getByRole('button', { name: /取消|关闭|不指定/i }).first().click();
  53 |       }
  54 |       await page.waitForTimeout(300);
  55 |     }
  56 |   });
  57 | }); 
```