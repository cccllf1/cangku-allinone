# 🏭 仓库管理系统 API 字段命名规范

## 📌 基本原则

1. **统一使用下划线命名法（snake_case）**
   - ✅ 正确：`product_id`, `location_code`, `sku_code`, `stock_quantity`, `created_at`, `updated_at`
   - ❌ 错误：`productId`, `locationCode`, `skuCode`, `quantity`, `createdAt`, `updatedAt`
2. **字段命名必须一致，不允许多种格式混用**
3. **相同业务含义的字段在前端、后端、数据库必须保持完全一致**
4. **所有变量名、对象属性名、临时变量名、结构体字段名等也必须使用snake_case标准命名**
   - 不仅API参数和数据库字段，前端/后端所有代码中的变量、对象属性、临时数据结构等都必须用snake_case。
   - 禁止camelCase、PascalCase、缩写等其它风格。
   - 例如：
     - ✅ 正确：`sku_code`, `product_code`, `stock_quantity`
     - ❌ 错误：`code`, `skuCode`, `productCode`, `qty`
   - 这样可以保证全链路（接口、数据库、前端、后端、临时变量）命名风格完全一致，方便维护和排查。

## 🚫 禁止兜底写法（字段名混用）

### 规范要求

- 每个字段只能有唯一、标准的字段名。
- 严禁用其它字段名兜底或兼容。
- 例如：商品编码就是 `product_code`，SKU 编码就是 `sku_code`，库位编码就是 `location_code`。
- 如果数据中缺少标准字段，必须报错或提示，绝不能用其它字段兜底。

### 反面案例（错误写法）

```js
// ❌ 错误：用 SKU 代替商品编码
const code = obj.product_code || obj.sku_code; // 禁止
// ❌ 错误：用 code 代替 location_code
const loc = obj.location_code || obj.code; // 禁止
```

### 正面案例（正确写法）

```js
// ✅ 正确：只用标准字段
const code = obj.product_code;
if (!code) throw new Error('缺少 product_code 字段'); // 必须报错或提示

const loc = obj.location_code;
if (!loc) throw new Error('缺少 location_code 字段');
```

### 说明

- 商品编码就是商品编码，SKU 编码就是 SKU 编码，不能混用。
- 如果你发现数据里没有标准字段，必须排查数据来源和接口实现，不能用其它字段兜底。
- 兜底写法会掩盖数据结构不规范、数据丢失等问题，导致后期难以维护和排查。
- 只有严格报错，才能让开发者及时发现和修正问题，保证数据结构和接口规范。

> 举例说明：
>
> - 商品编码（`product_code`）就是商品编码，绝不能用 SKU 编码（`sku_code`）来代替。如果商品编码丢失，必须查明原因，不能用 SKU 编码兜底，否则会导致数据混乱，后果严重。

**结论：**
> 禁止任何字段名兜底写法，找不到标准字段就必须报错或提示，不能用其它字段代替。

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
| SKU图片      | image_path      | image      | SKU图片路径，每个SKU独立 |
| 是否有SKU    | `has_sku`            | `hasSku`         | 是否包含SKU    |
| 用户ID       | `user_id`            | `userId`         | 用户唯一标识   |
| 用户名       | `user_name`           | `userName`       | 用户登录名     |
| 角色         | `role`               | `userRole`       | 用户角色       |
| 操作员ID     | `operator_id`        | `operatorId`, `op_id` | 记录操作员身份，所有涉及库存调整、转移、入库、出库等操作必须传递 |
| 库存数量     | `stock_quantity`     | `quantity`, `stockQty` | 整数单位 |
| 可用库存     | `available_quantity` | `avlQty`         | 可销售数量     |
| 创建时间     | `created_at`         | `createdAt`, `createTime` | ISO8601格式 |
| 更新时间     | `updated_at`         | `updatedAt`, `updateTime` | ISO8601格式 |
| 是否删除     | `is_deleted`         | `deletedFlag`    | 布尔值         |
| 源库位ID     | `from_location_id`   | `fromLocationId` | 转移出库位唯一标识 |
| 源库位编码   | `from_location_code` | `fromLocationCode` | 转移出库位编码 |
| 目标库位ID   | `to_location_id`     | `toLocationId`   | 转移入库位唯一标识 |
| 目标库位编码 | `to_location_code`   | `toLocationCode` | 转移入库位编码 |
| 商品总库存   | `total_quantity`    | `total_qty`, `qty`  | 商品下所有SKU的库存合计 |

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
  "location_id": "string",     // 库位ID（可选与location_code二选一）
  "location_code": "string",   // 库位编码（可选，与location_id二选一）
  "sku_code": "string",        // SKU编码（可选）
  "stock_quantity": "number"   // 数量（必需）
}
```

### 库存转移接口标准参数

### 转移接口 `/api/inventory/transfer`
```json
{
  "sku_code": "string",           // SKU编码（必填，唯一定位商品+规格+颜色）
  "product_id": "string",         // 商品ID（可选，与product_code二选一，辅助定位）
  "product_code": "string",       // 商品编码（可选，与product_id二选一，辅助定位）
  "from_location_id": "string",   // 源库位ID（可选，与from_location_code二选一）
  "from_location_code": "string", // 源库位编码（可选，与from_location_id二选一）
  "to_location_id": "string",     // 目标库位ID（可选，与to_location_code二选一）
  "to_location_code": "string",   // 目标库位编码（可选，与to_location_id二选一）
  "stock_quantity": 8,             // 转移数量（必填，整数）
  "batch_number": "string",       // 批次号（可选）
  "notes": "string"               // 备注（可选）
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

### SKU结构标准示例
```json
{
  "sku_code": "PROD001-RED-L",
  "sku_color": "红色",
  "sku_size": "L",
  "image_path": "/uploads/prod001-red-l.jpg",
  "external_codes": ["123456789"]
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

## 📚 常用库存查询接口说明

### 1. 按库位聚合库存

#### 接口：`GET /api/inventory/by-location`

- **功能**：按库位聚合展示所有商品的库存明细。
- **请求参数**：无（可直接 GET 请求）
- **返回结构**：
  ```json
  {
    "success": true,
    "data": [
      {
        "location_code": "西8排1架6层4位",
        "items": [
          {
            "product_id": "6832e24966142406d2ef0dca",
            "product_code": "129092",
            "product_name": "129092",
            "sku_code": "129092-黄色-M",
            "stock_quantity": 8,
            "image_path": "/uploads/product-xxx.jpg"
          }
          // ...更多SKU
        ]
      }
      // ...更多库位
    ],
    "error_code": null,
    "error_message": null
  }
  ```
- **典型用途**：
  - 查询某个库位下所有商品/所有SKU的库存明细
  - 前端库位视图、盘点、转移等场景

---

### 2. 按商品聚合库存

#### 接口：`GET /api/inventory/by-product?page=1&pageSize=1000`

- **功能**：按商品聚合展示所有商品的所有SKU、颜色、尺码、各库位库存明细。
- **请求参数**：
  - `page`（可选，默认1）：页码
  - `pageSize`（可选，默认50）：每页条数
  - `code`（可选）：指定商品编码，仅返回该商品
- **返回结构**：
  ```json
  {
    "success": true,
    "data": [
      {
        "product_id": "6832e24966142406d2ef0dca",
        "product_code": "129092",
        "product_name": "129092",
        "unit": "件",
        "image_path": "/uploads/product-xxx.jpg",
        "has_sku": true,
        "total_quantity": 321,
        "sku_count": 24,
        "location_count": 7,
        "color_count": 6,
        "colors": [
          {
            "color": "黄色",
            "image_path": "/uploads/product-xxx.jpeg",
            "sizes": [
              {
                "sku_size": "M",
                "sku_code": "129092-黄色-M",
                "total_quantity": 8,
                "locations": [
                  { "location_code": "西8排1架6层4位", "stock_quantity": 8 }
                ]
              }
              // ...更多尺码
            ],
            "total_quantity": 35,
            "sku_count": 4,
            "location_count": 2
          }
          // ...更多颜色
        ],
        "skus": [
          {
            "sku_code": "129092-黄色-M",
            "sku_color": "黄色",
            "sku_size": "M",
            "image_path": "/uploads/product-xxx.jpeg"
          }
          // ...更多SKU
        ]
      }
      // ...更多商品
    ],
    "pagination": {
      "page": 1,
      "pageSize": 1000,
      "total": 5
    },
    "error_code": null,
    "error_message": null
  }
  ```
- **典型用途**：
  - 查询某个商品所有SKU、所有颜色、所有尺码、所有库位的库存分布
  - 前端商品视图、SKU管理、库存分析等场景

---

### 3. 盘点/库存调整接口

#### 接口：`POST /api/inventory/adjust`

- **功能**：对指定商品、库位、SKU进行库存盘点或调整，直接覆盖目标库存数量。
- **请求方式**：POST
- **请求参数**：
  - `product_code`（必填）：商品编码
  - `location_code`（必填）：库位编码
  - `sku_code`（必填）：SKU编码
  - `stock_quantity`（必填）：盘点后目标库存数量（整数，直接覆盖）
  - `batch_number`（可选）：批次号
  - `notes`（可选）：备注
  - `operator_id`（可选）：操作员ID
  - `is_urgent`（可选）：是否紧急

- **请求体示例**：
  ```json
  {
    "product_code": "129092",
    "location_code": "西8排1架6层4位",
    "sku_code": "129092-黄色-M",
    "stock_quantity": 10,
    "batch_number": "BATCH001",
    "notes": "盘点修正"
  }
  ```

- **返回结构**：
  ```json
  {
    "success": true,
    "data": {
      "location_code": "西8排1架6层4位",
      "product_code": "129092",
      "sku_code": "129092-黄色-M",
      "previous_quantity": 8,
      "adjusted_quantity": 2,
      "current_quantity": 10,
      "batch_number": "BATCH001",
      "operator_id": "684c5acd5cf064a67653d0c0",
      "adjusted_at": "2024-06-15T12:00:00.000Z",
      "notes": "盘点修正"
    },
    "error_code": null,
    "error_message": null
  }
  ```

- **典型用途**：
  - 盘点时直接修正某个SKU在某库位的实际库存
  - 处理库存异常、手动调整等场景

---

### 4. 库存转移接口

#### 接口：`POST /api/inventory/transfer`

- **功能**：将指定SKU从一个库位转移到另一个库位，常用于货位整理、移库等场景。
- **请求方式**：POST
- **请求参数**：
  - `sku_code`（必填）：SKU编码
  - `from_location_code`（必填）：源库位编码
  - `to_location_code`（必填）：目标库位编码
  - `stock_quantity`（必填）：转移数量（整数）
  - `product_code`（可选）：商品编码（辅助定位）
  - `batch_number`（可选）：批次号
  - `notes`（可选）：备注

- **请求体示例**：
  ```json
  {
    "sku_code": "129092-黄色-M",
    "from_location_code": "西8排1架6层4位",
    "to_location_code": "西8排2架6层4位",
    "stock_quantity": 1,
    "notes": "移库操作"
  }
  ```

- **返回结构**：
  ```json
  {
    "success": true,
    "data": {
      "sku_code": "129092-黄色-M",
      "from_location": "西8排1架6层4位",
      "to_location": "西8排2架6层4位",
      "stock_quantity": 1,
      "batch_number": null,
      "notes": "移库操作"
    },
    "error_code": null,
    "error_message": null
  }
  ```

- **典型用途**：
  - 货位整理、移库、合并分散库存
  - 生产、发货前的库位优化

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

## 📋 API测试用例集

### 1. 库存查询测试

```js
// ✅ 正确的库存查询
fetch('/api/inventory/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    location_code: "A01-01-01",
    product_code: "129092",
    sku_code: "129092-黑色-XL",
    batch_number: "BATCH001",
    include_empty: false
  })
});

// ❌ 错误的库存查询
fetch('/api/inventory/query', {
  method: 'POST',
  body: JSON.stringify({
    locationCode: "A01-01-01",    // ❌ 错误：使用了驼峰命名
    productId: "129092",          // ❌ 错误：使用了驼峰命名
    skuCode: "129092-黑色-XL",    // ❌ 错误：使用了驼峰命名
    includeEmpty: false           // ❌ 错误：使用了驼峰命名
  })
});
```

### 2. SKU管理测试

```js
// ✅ 正确的SKU创建
fetch('/api/sku/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    product_code: "129092",
    sku_code: "129092-黑色-XL",
    sku_color: "黑色",
    sku_size: "XL",
    stock_quantity: 100,
    image_path: "/uploads/129092-black-xl.jpg",
    external_codes: ["EXT001", "EXT002"]
  })
});

// ❌ 错误的SKU创建
fetch('/api/sku/create', {
  method: 'POST',
  body: JSON.stringify({
    productCode: "129092",         // ❌ 错误格式
    skuCode: "129092-黑色-XL",     // ❌ 错误格式
    color: "黑色",                 // ❌ 错误格式
    size: "XL",                    // ❌ 错误格式
    qty: 100,                      // ❌ 错误格式
    imagePath: "/uploads/img.jpg"  // ❌ 错误格式
  })
});
```

### 3. 批量操作测试

```js
// ✅ 正确的批量库存调整
fetch('/api/inventory/batch-adjust', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    adjustments: [
      {
        location_code: "A01-01-01",
        sku_code: "129092-黑色-XL",
        stock_quantity: 10,
        batch_number: "BATCH001"
      },
      {
        location_code: "A01-01-02",
        sku_code: "129092-红色-L",
        stock_quantity: -5,
        batch_number: "BATCH002"
      }
    ],
    notes: "批量库存调整",
    operator_id: "OP001",
    is_urgent: false
  })
});
```

### 4. 响应格式标准

```js
// ✅ 标准响应格式
{
  "success": true,
  "data": {
    "product_code": "129092",
    "location_code": "A01-01-01",
    "stock_quantity": 100,
    "updated_at": "2024-01-01T12:00:00.000Z",
    "operator_id": "OP001"
  },
  "error_code": null,
  "error_message": null
}

// ✅ 错误响应格式
{
  "success": false,
  "data": null,
  "error_code": "STOCK_INSUFFICIENT",
  "error_message": "库存不足",
  "details": {
    "requested_quantity": 100,
    "available_quantity": 50,
    "location_code": "A01-01-01",
    "sku_code": "129092-黑色-XL"
  }
}
```

### 5. 测试检查清单

- [ ] 所有请求参数使用snake_case
- [ ] 所有响应字段使用snake_case
- [ ] 检查是否存在遗漏的驼峰命名
- [ ] 验证时间字段格式（ISO8601）
- [ ] 确认布尔字段命名（is_*, has_*）
- [ ] 验证数量字段统一使用stock_quantity
- [ ] 检查错误响应格式的一致性

### 6. 商品详情查询测试

```js
// ✅ 正确的商品ID查询
fetch('/api/products/12345', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
}).then(response => response.json())
  .then(data => {
    // 正确的响应格式
    console.log({
      product_id: data.product_id,
      product_code: data.product_code,
      product_name: data.product_name,
      stock_quantity: data.stock_quantity,
      created_at: data.created_at,
      updated_at: data.updated_at,
      has_sku: data.has_sku,
      image_path: data.image_path
    });
  });

// ✅ 正确的商品编码查询
fetch('/api/products/code/129092', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
}).then(response => response.json())
  .then(data => {
    // 正确的响应格式
    console.log({
      product_code: data.product_code,
      product_name: data.product_name,
      skus: data.skus.map(sku => ({
        sku_code: sku.sku_code,
        sku_color: sku.sku_color,
        sku_size: sku.sku_size,
        stock_quantity: sku.stock_quantity,
        image_path: sku.image_path,
        external_codes: sku.external_codes
      }))
    });
  });

// ❌ 错误的商品查询（不规范的响应处理）
fetch('/api/products/12345')
  .then(response => response.json())
  .then(data => {
    console.log({
      productId: data.productId,        // ❌ 错误：使用了驼峰命名
      productName: data.productName,    // ❌ 错误：使用了驼峰命名
      qty: data.quantity,               // ❌ 错误：使用了缩写
      createTime: data.createTime       // ❌ 错误：使用了驼峰命名且不规范
    });
  });
```

### 7. 商品详情接口规范

#### 7.1 GET `/api/products/:id` 响应格式

```json
{
  "success": true,
  "data": {
    "product_id": "12345",
    "product_code": "129092",
    "product_name": "测试商品",
    "category_id": "CAT001",
    "stock_quantity": 100,
    "has_sku": true,
    "image_path": "/uploads/products/129092.jpg",
    "is_active": true,
    "created_at": "2024-01-01T12:00:00.000Z",
    "updated_at": "2024-01-01T12:00:00.000Z"
  },
  "error_code": null,
  "error_message": null
}
```

#### 7.2 GET `/api/products/code/:code` 响应格式

```json
{
  "success": true,
  "data": {
    "product_code": "129092",
    "product_name": "测试商品",
    "skus": [
      {
        "sku_code": "129092-黑色-XL",
        "sku_color": "黑色",
        "sku_size": "XL",
        "stock_quantity": 50,
        "image_path": "/uploads/skus/129092-black-xl.jpg",
        "external_codes": ["EXT001", "EXT002"],
        "is_active": true
      }
    ],
    "total_quantity": 100,
    "created_at": "2024-01-01T12:00:00.000Z",
    "updated_at": "2024-01-01T12:00:00.000Z"
  },
  "error_code": null,
  "error_message": null
}
```

#### 7.3 错误响应格式

```json
{
  "success": false,
  "data": null,
  "error_code": "PRODUCT_NOT_FOUND",
  "error_message": "商品不存在",
  "details": {
    "product_id": "12345",
    "request_time": "2024-01-01T12:00:00.000Z"
  }
}
```

### 8. 测试要点

- [ ] 验证所有响应字段使用snake_case
- [ ] 确保时间字段使用ISO8601格式
- [ ] 检查是否包含必要的元数据字段（created_at, updated_at）
- [ ] 验证布尔值字段命名（is_*, has_*）
- [ ] 确认数量字段使用完整名称（stock_quantity而非quantity）
- [ ] 检查嵌套对象中的字段命名是否规范
- [ ] 验证错误响应格式的一致性

### 9. 库存调整接口测试

```js
// ✅ 正确的库存调整请求
fetch('/api/inventory/adjust', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    location_code: "A01-01-01",
    product_code: "129092",
    sku_code: "129092-黑色-XL",
    stock_quantity: 10,          // 正数增加库存，负数减少库存
    batch_number: "BATCH001",    // 可选
    notes: "手动库存调整",       // 可选
    operator_id: "OP001",
    is_urgent: false
  })
});

// ❌ 错误的库存调整请求
fetch('/api/inventory/adjust', {
  method: 'POST',
  body: JSON.stringify({
    locationCode: "A01-01-01",     // ❌ 错误：使用了驼峰命名
    productCode: "129092",         // ❌ 错误：使用了驼峰命名
    skuCode: "129092-黑色-XL",     // ❌ 错误：使用了驼峰命名
    qty: 10,                       // ❌ 错误：使用了缩写
    batchNo: "BATCH001",           // ❌ 错误：使用了缩写
    operatorId: "OP001"            // ❌ 错误：使用了驼峰命名
  })
});

// ✅ 正确的响应格式
{
  "success": true,
  "data": {
    "location_code": "A01-01-01",
    "product_code": "129092",
    "sku_code": "129092-黑色-XL",
    "previous_quantity": 90,
    "adjusted_quantity": 10,
    "current_quantity": 100,
    "batch_number": "BATCH001",
    "operator_id": "OP001",
    "adjusted_at": "2024-01-01T12:00:00.000Z",
    "notes": "手动库存调整"
  },
  "error_code": null,
  "error_message": null
}

// ✅ 库存不足的错误响应
{
  "success": false,
  "data": null,
  "error_code": "INSUFFICIENT_STOCK",
  "error_message": "库存不足",
  "details": {
    "location_code": "A01-01-01",
    "sku_code": "129092-黑色-XL",
    "requested_quantity": 100,
    "available_quantity": 50
  }
}
```

### 10. 库存调整接口规范说明

1. 请求参数规范：
   - `location_code`: 库位编码（必填）
   - `product_code`: 商品编码（必填）
   - `sku_code`: SKU编码（可选）
   - `stock_quantity`: 调整数量（必填，正数增加，负数减少）
   - `batch_number`: 批次号（可选）
   - `notes`: 备注说明（可选）
   - `operator_id`: 操作员ID（必填）
   - `is_urgent`: 是否紧急（可选，默认false）

2. 响应字段规范：
   - 所有字段统一使用snake_case
   - 数量相关字段必须使用`_quantity`后缀
   - 时间字段必须使用ISO8601格式
   - 布尔类型字段使用`is_`前缀

3. 错误处理规范：
   - 库存不足：INSUFFICIENT_STOCK
   - 库位不存在：LOCATION_NOT_FOUND
   - 商品不存在：PRODUCT_NOT_FOUND
   - SKU不存在：SKU_NOT_FOUND
   - 参数错误：INVALID_PARAMETERS

4. 测试要点：
   - [ ] 验证正数调整（入库）
   - [ ] 验证负数调整（出库）
   - [ ] 验证库存不足情况
   - [ ] 验证批次号处理
   - [ ] 验证操作记录完整性
   - [ ] 检查所有字段命名规范
   - [ ] 验证错误响应格式

> 📝 **注意事项**：
> 1. 库存调整必须是原子操作
> 2. 调整前必须检查库存是否充足
> 3. 所有调整操作必须记录操作人
> 4. 批次号可选但建议填写

---

> 📢 **重要提醒**：请所有开发者（包括AI助手）在编写API相关代码时，必须参考此命名规范文档。任何新的API接口都必须严格遵循snake_case命名规范。

---

**最后更新时间：2024年12月**  
**文档版本：v1.2**  
**适用范围：仓库管理系统所有API接口**

---

## 🗝️ 数据库管理员账号备份（仅限开发环境）

> **请妥善保管，生产环境请勿明文存储密码！**

- MongoDB 管理员用户名：admin_user
- MongoDB 管理员密码：your_strong_password
- 认证数据库：admin
- 端口：8612
- 连接字符串示例：

  ```
  mongodb://admin_user:your_strong_password@192.168.11.252:8612/?authSource=admin
  ``` 

## 🗝️ 测试账号与认证信息（仅限开发环境）

> **请勿用于生产环境！仅供开发调试。**

- **测试账号**  
  用户名：`wms`  
  密码：`123456`

- **常用 Bearer Token（如有时效请及时更新）**  
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNjg0YzVhY2Q1Y2YwNjRhNjc2NTNkMGMwIiwiaWF0IjoxNzQ5ODM0NzIwfQ.YpumiMKufoclgWpu87ZE7gd0KfTb0--kWMgbpN7gnDE
```

- **常用 Cookie 示例**  
```
_ga=GA1.1.94067315.1698883120; _SSID=3CE8ZZPbpLAoiLlnvHqEuUpfGTQl8AuyD1TIPWJrXVk; did=8r6ov2dqHWUWGX7SBmI0NOnl42dyE07e5H2aI86a4lgwuH2fnAPMdor0nXsmxzbq3v6Rv6h9F_dyNUJfcAsRUQ; Hm_lvt_996fb35897c8f1320b8bd028e32a9dea=1732187435,1734104440; _pk_id.1.7d01=6a3addeff9703acf.1746174460.; ViewLibrary=shared_space; ViewType=folder; stay_login=1; cids=1; id=qslli0scNrhwbEJnH3N0yHay6n_idDRAMN8vsdY-WnkAFi2owPlRp6IvjGwAu2phQ7zvlZ87iEmC61TDtZgvEs; _CrPoSt=cHJvdG9jb2w9aHR0cHM6OyBwb3J0PTUwMDE7IHBhdGhuYW1lPS87; io=QnNTEuIcNKxCpqcIAAB-
```

- **常用 curl 示例**  
```bash
curl -X POST http://192.168.11.252:8610/api/inventory/transfer \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNjg0YzVhY2Q1Y2YwNjRhNjc2NTNkMGMwIiwiaWF0IjoxNzQ5ODM0NzIwfQ.YpumiMKufoclgWpu87ZE7gd0KfTb0--kWMgbpN7gnDE' \
  -b '_ga=GA1.1.94067315.1698883120; ...' \
  -d '{"sku_code": "129092-黄色-M", "from_location_code": "西8排1架6层4位", "to_location_code": "西8排2架6层4位", "stock_quantity": 1}'
```

- **常用商品/库存数据片段**  
```
// 只保留部分示例，完整数据请见历史消息或数据库
{
    "sku_code": "129092-黄色-M",
    "from_location_code": "西8排1架6层4位",
    "to_location_code": "西8排2架6层4位",
    "stock_quantity": 8
}
// ...如需完整商品/库存结构，可粘贴历史消息内容
```

### "无货位"标准约定

- **location_code: "无货位"**
- 代表未分配具体货架/货位的库存
- 所有移库、清库位等操作，目标库位统一传 "无货位"
- 数据库应有一条 location_code 为 "无货位" 的库位记录
- 禁止用空字符串、null 或其它变体兜底

### 合计库存字段命名规范

- 所有合计数量字段统一用 `total_quantity`，禁止使用 `total_qty`、`qty` 等缩写。
- 例如：
  - 商品总库存：`total_quantity`
  - 颜色下总库存：`total_quantity`
- 说明：保持与 `stock_quantity`、`available_quantity` 等命名风格一致，便于全链路一致性和维护。