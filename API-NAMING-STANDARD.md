# 🏭 仓库管理系统 API 字段命名规范

## 📌 基本原则

### 1. 统一使用下划线命名法（snake_case）
✅ **正确：** `product_id`, `location_code`, `sku_code`  
❌ **错误：** `productId`, `locationCode`, `skuCode`

### 2. 字段命名必须一致，不允许多种格式混用

## 🎯 标准字段命名对照表

| 功能 | **标准字段名** | ❌ 禁止使用 | 说明 |
|------|---------------|------------|------|
| 商品ID | `product_id` | `productId` | 商品的唯一标识符 |
| 商品编码 | `product_code` | `productCode` | 商品的业务编码 |
| 库位ID | `location_id` | `locationId` | 库位的唯一标识符 |
| 库位编码 | `location_code` | `locationCode` | 库位的业务编码 |
| SKU编码 | `sku_code` | `skuCode` | SKU的业务编码 |
| SKU颜色 | `sku_color` | `skuColor` | SKU的颜色属性 |
| SKU尺寸 | `sku_size` | `skuSize` | SKU的尺寸属性 |
| 批次号 | `batch_number` | `batchNumber` | 商品批次编号 |
| 外部条码 | `external_code` | `externalCode` | 外部系统条码 |
| 图片路径 | `image_path` | `imagePath` | 商品图片路径 |
| 是否有SKU | `has_sku` | `hasSku` | 商品是否包含SKU |
| 用户ID | `user_id` | `userId` | 用户唯一标识符 |

## 📥📤 入库/出库接口标准参数

### 入库接口 `/api/inbound`
```json
{
  "product_id": "string",      // 商品ID（可选，与product_code二选一）
  "product_code": "string",    // 商品编码（可选，与product_id二选一）
  "location_id": "string",     // 库位ID（可选，与location_code二选一）
  "location_code": "string",   // 库位编码（可选，与location_id二选一）
  "sku_code": "string",        // SKU编码（可选）
  "quantity": "number",        // 数量（必需）
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
  "quantity": "number"         // 数量（必需）
}
```

## 🔍 商品查询接口标准

### 根据编码查询商品 `/api/products/code/:code`
- 路径参数：`code` - 可以是商品编码或SKU编码
- 如果是SKU编码（包含"-"），系统自动解析

### 根据外部条码查询 `/api/products/external-code/:code`
- 路径参数：`code` - 外部条码

## 📊 库存接口标准

### 库存调整 `/api/inventory/adjust`
```json
{
  "product_code": "string",    // 商品编码或SKU编码（必需）
  "location_code": "string",   // 库位编码（必需）
  "quantity": "number",        // 调整数量，正数增加，负数减少（必需）
  "batch_number": "string",    // 批次号（可选）
  "notes": "string"            // 备注（可选）
}
```

## 🎯 SKU相关接口标准

### SKU外部条码管理
- 获取SKU外部条码：`/api/sku/:sku_code/external-codes`
- 添加SKU外部条码：`/api/sku/:sku_code/external-codes`
- 根据外部条码查找SKU：`/api/sku/external/:external_code`

## ⚠️ 兼容性处理

### 为了向后兼容，API暂时同时支持两种格式：
```javascript
// 后端接收参数时，同时支持：
const productId = req.body.product_id || req.body.productId;
const locationCode = req.body.location_code || req.body.locationCode;
const skuCode = req.body.sku_code || req.body.skuCode;
```

### 但是**新开发的功能必须严格使用标准命名**

## 🛠️ 实施步骤

### 1. 立即执行（后端）
- [ ] 更新所有API接口，统一使用snake_case
- [ ] 保留向后兼容性支持
- [ ] 更新API文档

### 2. 前端更新
- [ ] 移动端应用更新字段名
- [ ] Web端应用更新字段名
- [ ] 测试所有接口兼容性

### 3. 逐步移除兼容性
- [ ] 3个月后移除camelCase支持
- [ ] 只保留snake_case格式

## 📝 代码示例

### ✅ 正确的API调用示例

```javascript
// 入库
fetch('/api/inbound', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    product_code: "129092-黑色-XL",
    location_code: "A01-01-01",
    quantity: 5,
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
    quantity: 1,
    sku_code: "129092-黑色-XL"
  })
});
```

### ❌ 错误的API调用示例

```javascript
// 不要这样混用！
fetch('/api/inbound', {
  method: 'POST',
  body: JSON.stringify({
    productCode: "129092-黑色-XL",    // ❌ 错误格式
    location_code: "A01-01-01",       // ✅ 正确格式
    skuCode: "129092-黑色-XL"         // ❌ 错误格式
  })
});
```

## 🎯 给GPT和开发者的指导

### 当GPT协助API开发时，请严格遵循：

1. **所有字段名必须使用snake_case格式**
2. **参考上面的标准字段对照表**
3. **新功能不允许使用camelCase**
4. **有疑问时查看此文档**

### 提醒所有开发者：

> 📢 **重要提醒**：请所有开发者（包括AI助手）在编写API相关代码时，必须参考此命名规范文档。任何新的API接口都必须严格遵循snake_case命名规范。

---

**最后更新时间：** 2024年12月  
**文档版本：** v1.0  
**适用范围：** 仓库管理系统所有API接口 