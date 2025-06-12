# 🏭 仓库管理系统 API 字段命名规范

## 📌 基本原则

1. **统一使用下划线命名法（snake_case）**
   - ✅ 正确：`product_id`, `location_code`, `sku_code`, `stock_quantity`, `created_at`, `updated_at`
   - ❌ 错误：`productId`, `locationCode`, `skuCode`, `quantity`, `createdAt`, `updatedAt`
2. **字段命名必须一致，不允许多种格式混用**
3. **相同业务含义的字段在前端、后端、数据库必须保持完全一致**

---

## 🎯 标准字段命名对照表

| 功能         | 标准字段名           | 禁止使用         | 说明           |
|--------------|----------------------|------------------|----------------|
| 商品ID       | `product_id`         | `productId`      | 商品唯一标识   |
| 商品编码     | `product_code`       | `productCode`    | 商品业务编码   |
| 商品名称     | `product_name`       | `productName`    | 商品展示名称   |
| 商品分类     | `category_id`        | `categoryId`     | 分类ID         |
| 库位ID       | `location_id`        | `locationId`     | 库位唯一标识   |
| 库位编码     | `location_code`      | `locationCode`   | 库位业务编码   |
| 库位名称     | `location_name`      | `locationName`   | 库位名称       |
| SKU编码      | `sku_code`           | `skuCode`        | SKU业务编码    |
| SKU颜色      | `sku_color`          | `skuColor`       | SKU颜色属性    |
| SKU尺寸      | `sku_size`           | `skuSize`        | SKU尺寸属性    |
| 批次号       | `batch_number`       | `batchNumber`    | 商品批次编号   |
| 外部条码     | `external_code`      | `externalCode`   | 单个外部条码   |
| 外部条码列表 | `external_codes`     | `externalCodes`  | 外部条码数组   |
| 图片路径     | `image_path`         | `imagePath`      | 商品图片路径   |
| 是否有SKU    | `has_sku`            | `hasSku`         | 是否包含SKU    |
| 用户ID       | `user_id`            | `userId`         | 用户唯一标识   |
| 库存数量     | `stock_quantity`     | `quantity`, `stockQty` | 整数单位 |
| 可用库存     | `available_quantity` | `avlQty`         | 可销售数量     |
| 创建时间     | `created_at`         | `createdAt`, `createTime` | ISO8601格式 |
| 更新时间     | `updated_at`         | `updatedAt`, `updateTime` | ISO8601格式 |
| 是否删除     | `is_deleted`         | `deletedFlag`    | 布尔值         |

---

## 📝 命名细则

1. **所有字段必须使用`snake_case`格式（小写字母+下划线）**
2. **禁止使用`camelCase`、缩写（除行业通用）等其它命名格式**
3. **布尔类型字段**：以`is_`或`has_`开头，如`is_active`, `has_sku`
4. **时间字段**：以`_at`结尾，如`created_at`, `updated_at`
5. **唯一ID/编码**：统一为`[entity]_id`、`[entity]_code`，如`order_id`, `warehouse_code`
6. **保持命名一致性**：相同概念使用相同字段名
7. **外部条码相关字段**：一律用 `external_code`（单个）和 `external_codes`（数组），禁止 camelCase 和其它变体。

---

## 📥📤 入库/出库接口标准参数

### 入库接口 `/api/inbound`
```json
{
  "product_id": "string",      // 商品ID（可选，与product_code二选一）
  "product_code": "string",    // 商品编码（可选，与product_id二选一）
  "location_id": "string",     // 库位ID（可选，与location_code二选一）
  "location_code": "string",   // 库位编码（可选，与location_id二选一）
  "sku_code": "string",        // SKU编码（可选）
  "stock_quantity": "number",  // 数量（必需）
  "batch_number": "string",    // 批次号（可选）
  "notes": "string"            // 备注（可选）
}
```

### 出库接口 `/api/outbound`
```json
{
  "product_id": "string",      // 商品ID（可选，与product_code二选一）
  "product_code": "string",    // 商品编码（可选，与product_id二选一）
  "location_id": "string",     // 库位ID（可选，与location_code二选一）
  "location_code": "string",   // 库位编码（可选，与location_id二选一）
  "sku_code": "string",        // SKU编码（可选）
  "stock_quantity": "number"   // 数量（必需）
}
```

---

## 📥📤 外部条码接口参数示例

### 单个外部条码
```json
{
  "sku_code": "PROD001-RED-L",
  "external_code": "1234567890"
}
```

### 外部条码数组
```json
{
  "sku_code": "PROD001-RED-L",
  "external_codes": ["1234567890", "9876543210"]
}
```

---

## 📊 其它接口标准

### 商品查询 `/api/products/code/:code`
- 路径参数：`code` - 可以是商品编码或SKU编码
- 如果是SKU编码（包含"-"），系统自动解析

### 外部条码查询 `/api/products/external-code/:code`
- 路径参数：`code` - 外部条码

### 库存调整 `/api/inventory/adjust`
```json
{
  "product_code": "string",    // 商品编码或SKU编码（必需）
  "location_code": "string",   // 库位编码（必需）
  "stock_quantity": "number",  // 调整数量，正数增加，负数减少（必需）
  "batch_number": "string",    // 批次号（可选）
  "notes": "string"            // 备注（可选）
}
```

### SKU外部条码管理
- 获取SKU外部条码：`/api/sku/:sku_code/external-codes`
- 添加SKU外部条码：`/api/sku/:sku_code/external-codes`
- 根据外部条码查找SKU：`/api/sku/external/:external_code`

---

## ⚠️ 兼容性处理

- 为了向后兼容，API暂时同时支持两种格式：
  ```js
  // 后端接收参数时，同时支持：
  const product_id = req.body.product_id || req.body.productId;
  const location_code = req.body.location_code || req.body.locationCode;
  const sku_code = req.body.sku_code || req.body.skuCode;
  const stock_quantity = req.body.stock_quantity || req.body.quantity;
  ```
- 但是**新开发的功能必须严格使用标准命名**
- 3个月后移除 camelCase 和 quantity 支持，只保留 snake_case 标准字段

---

## 🛠️ 实施步骤

1. 立即执行（后端）
   - [ ] 更新所有API接口，统一使用snake_case
   - [ ] 保留向后兼容性支持（过渡期）
   - [ ] 更新API文档
2. 前端更新
   - [ ] 移动端应用更新字段名
   - [ ] Web端应用更新字段名
   - [ ] 测试所有接口兼容性
3. 逐步移除兼容性
   - [ ] 3个月后移除 camelCase 和 quantity 支持
   - [ ] 只保留 snake_case 标准字段

---

## 📝 代码示例

### ✅ 正确的API调用示例

```js
// 入库
fetch('/api/inbound', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    product_code: "129092-黑色-XL",
    location_code: "A01-01-01",
    stock_quantity: 5,
    sku_code: "129092-黑色-XL",
    batch_number: "BATCH001"
  })
});

// 出库
fetch('/api/outbound', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    product_code: "129092-黑色-XL",
    location_code: "A01-01-01",
    stock_quantity: 1,
    sku_code: "129092-黑色-XL"
  })
});
```

### ❌ 错误的API调用示例

```js
// 不要这样混用！
fetch('/api/inbound', {
  method: 'POST',
  body: JSON.stringify({
    productCode: "129092-黑色-XL",    // ❌ 错误格式
    location_code: "A01-01-01",       // ✅ 正确格式
    skuCode: "129092-黑色-XL",        // ❌ 错误格式
    quantity: 5                        // ❌ 错误格式
  })
});
```

---

## 🎯 给GPT和开发者的指导

1. **所有字段名必须使用snake_case格式**
2. **参考上面的标准字段对照表**
3. **新功能不允许使用camelCase或quantity**
4. **有疑问时查看此文档**

> 📢 **重要提醒**：请所有开发者（包括AI助手）在编写API相关代码时，必须参考此命名规范文档。任何新的API接口都必须严格遵循snake_case命名规范。

---

**最后更新时间：2024年12月**  
**文档版本：v1.1**  
**适用范围：仓库管理系统所有API接口** 