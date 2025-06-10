# Test info

- Name: 筛选抽屉自动化验收
- Location: /Volumes/docker/cangku-allinone/tests/filter-drawer.spec.ts:3:5

# Error details

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /筛选/ })

    at /Volumes/docker/cangku-allinone/tests/filter-drawer.spec.ts:5:50
```

# Page snapshot

```yaml
- heading "仓库管理系统" [level=2]
- img "user"
- textbox "用户名": wms
- img "lock"
- textbox "密码"
- img "eye-invisible"
- button "login 登录":
  - img "login"
  - text: 登录
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | test('筛选抽屉自动化验收', async ({ page }) => {
   4 |   await page.goto('http://192.168.11.252:8610/mobile-location-inventory');
>  5 |   await page.getByRole('button', { name: /筛选/ }).click();
     |                                                  ^ Error: locator.click: Test timeout of 30000ms exceeded.
   6 |
   7 |   const filterLabels = [
   8 |     '商品编号：',
   9 |     '颜色：',
  10 |     '尺码：',
  11 |     '数量：',
  12 |     '货位：',
  13 |     '货位状态：',
  14 |     '件数区间：'
  15 |   ];
  16 |
  17 |   for (const label of filterLabels) {
  18 |     const row = page.getByText(label, { exact: false }).locator('..');
  19 |     await row.click();
  20 |     const modal = page.locator('.ant-modal, .adm-popup, .adm-picker');
  21 |     await expect(modal).toBeVisible({ timeout: 3000 });
  22 |     await page.screenshot({ path: `screenshots/filter-${encodeURIComponent(label)}.png` });
  23 |     const modalText = await modal.innerText();
  24 |     expect(modalText.trim().length).toBeGreaterThan(0);
  25 |     const cancelBtn = modal.getByRole('button', { name: /取消|关闭|×/ });
  26 |     if (await cancelBtn.isVisible()) {
  27 |       await cancelBtn.click();
  28 |     } else {
  29 |       const closeBtn = modal.locator('.ant-modal-close, .adm-popup-close');
  30 |       if (await closeBtn.isVisible()) {
  31 |         await closeBtn.click();
  32 |       }
  33 |     }
  34 |     await expect(modal).toBeHidden({ timeout: 2000 });
  35 |   }
  36 | });
```