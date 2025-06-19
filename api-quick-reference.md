# 🏭 仓库管理系统 API 快速参考

## 📋 基础信息

- **基础URL**: `http://192.168.11.252:8611/api`
- **认证方式**: Bearer Token
  - **命名规范**: 严格使用 `snake_case`，禁止 `camelCase`
  - **必填操作员**: 所有修改操作必须传递 `operator_id`
  - **只支持变体商品**: 系统不支持简单商品，所有商品都必须有颜色和尺寸结构

## 📝 标准字段名对照表

**重要说明**: 所有API接口必须严格按照以下标准字段名进行调用，**禁止使用简化字段名或兼容性字段名**。缺少标准字段时必须报错，不能用其他字段代替。

| 功能 | 标准字段名 | 禁止使用 | 说明 |
|------|------------|----------|------|
| 商品ID | `product_id` | `productId` | 商品唯一标识 |
| 商品编码 | `product_code` | `productCode` | 商品业务编码 |
| 商品名称 | `product_name` | `productName` | 商品展示名称 |
| 商品分类 | `category_id` | `categoryId` | 分类ID |
| 库位ID | `location_id` | `locationId` | 库位唯一标识 |
| 库位编码 | `location_code` | `locationCode` | 库位业务编码 |
| 库位名称 | `location_name` | `locationName` | 库位名称 |
| SKU编码 | `sku_code` | `skuCode` | SKU业务编码 |
| SKU颜色 | `sku_color` | `skuColor` | SKU颜色属性 |
| SKU尺寸 | `sku_size` | `skuSize` | SKU尺寸属性 |
| 批次号 | `batch_number` | `batchNumber` | 商品批次编号 |
| 外部条码 | `external_code` | `externalCode` | 单个外部条码 |
| 外部条码列表 | `external_codes` | `externalCodes` | 外部条码数组 |
| SKU图片 | `image_path` | `image` | SKU图片路径 |
| 是否有SKU | `has_sku` | `hasSku` | 是否包含SKU |
| 用户ID | `user_id` | `userId` | 用户唯一标识 |
| 用户名 | `user_name` | `userName` | 用户登录名 |
| 角色 | `role` | `userRole` | 用户角色 |
| 操作员ID | `operator_id` | `operatorId`, `op_id` | 记录操作员身份，所有涉及库存调整、转移、入库、出库等操作必须传递 |
| 库存数量 | `stock_quantity` | `quantity`, `stockQty` | 整数单位 |
| 可用库存 | `available_quantity` | `avlQty` | 可销售数量 |
| 创建时间 | `created_at` | `createdAt`, `createTime` | ISO8601格式 |
| 更新时间 | `updated_at` | `updatedAt`, `updateTime` | ISO8601格式 |
| 操作时间 | `operated_at` | `operatedAt`, `operateTime` | ISO8601格式 |
| 是否删除 | `is_deleted` | `deletedFlag` | 布尔值 |
| 是否紧急 | `is_urgent` | `isUrgent`, `urgent` | 布尔值，标记紧急操作 |
| 操作备注 | `notes` | `note`, `remark` | 操作说明文本 |
| 源库位ID | `from_location_id` | `fromLocationId` | 转移出库位唯一标识 |
| 源库位编码 | `from_location_code` | `fromLocationCode` | 转移出库位编码 |
| 目标库位ID | `to_location_id` | `toLocationId` | 转移入库位唯一标识 |
| 目标库位编码 | `to_location_code` | `toLocationCode` | 转移入库位编码 |
| 商品总库存 | `total_quantity` | `total_qty`, `qty` | 商品下所有SKU的库存合计 |
| **统计计数字段命名** | | | |
| SKU总数量 | `total_sku_count` | `sku_count`, `skuCount` | 商品下SKU的总数量 |
| 库位总数量 | `total_location_count` | `location_count`, `locationCount` | 涉及的库位总数量 |
| 颜色总数量 | `total_color_count` | `color_count`, `colorCount` | 商品颜色总数量 |
| **多层级数量字段命名** | | | |
| 库位层级数量 | `sku_location_quantity` | `locationQty`, `loc_qty` | 单个SKU在特定库位的数量，用于库存操作、库位管理 |
| SKU层级数量 | `sku_total_quantity` | `skuQty`, `sku_qty` | 单个SKU在所有库位的总数量，用于商品管理、库存调整 |
| 颜色层级数量 | `color_total_quantity` | `colorQty`, `color_qty` | 某颜色下所有尺寸的总数量，用于商品管理、颜色统计 |
| 商品层级数量 | `product_total_quantity` | `productQty`, `prod_qty` | 整个商品所有SKU的总数量，用于商品列表、总体统计 |

## 字段命名唯一性规范

**核心原则**: 每个字段都有唯一、明确的含义，严禁一个含义多个字段名，或一个字段名多个含义。

### 数量字段的唯一性定义

| 字段名 | 唯一含义 | 使用场景 | 禁止使用 |
|--------|----------|----------|----------|
| `inbound_quantity` | 入库数量 | POST /inbound 请求参数 | `quantity`, `stock_quantity` |
| `outbound_quantity` | 出库数量 | POST /outbound 请求参数 | `quantity`, `stock_quantity` |
| `target_quantity` | 库存调整目标数量 | POST /inventory/adjust 请求参数 | `stock_quantity`, `quantity` |
| `transfer_quantity` | 库存转移数量 | POST /inventory/transfer 请求参数 | `stock_quantity`, `quantity` |
| `stock_quantity` | 库位级实际库存 | 数据库存储和响应字段 | `quantity`, `qty` |
| `sku_location_quantity` | SKU在单个库位的数量 | 响应字段（计算值） | `location_qty` |
| `sku_total_quantity` | SKU在所有库位的总数量 | 响应字段（计算值） | `sku_qty` |
| `color_total_quantity` | 颜色层级总数量 | 响应字段（计算值） | `color_qty` |
| `product_total_quantity` | 商品层级总数量 | 响应字段（计算值） | `product_qty` |

### 统计字段的唯一性定义

| 字段名 | 唯一含义 | 使用场景 | 禁止使用 |
|--------|----------|----------|----------|
| `total_sku_count` | SKU总数量统计 | GET /products 响应 | `sku_count`, `skuCount` |
| `total_location_count` | 库位总数量统计 | GET /products 响应 | `location_count`, `locationCount` |
| `total_color_count` | 颜色总数量统计 | GET /products 响应 | `color_count`, `colorCount` |

## 字段命名规范

### 多层级数量字段命名
系统中不同层级的数量字段有统一的命名规范：

| 字段名 | 层级 | 说明 | 使用场景 |
|--------|------|------|----------|
| `sku_location_quantity` | 库位层级 | 单个SKU在特定库位的数量 | 库存操作、库位管理 |
| `sku_total_quantity` | SKU层级 | 单个SKU在所有库位的总数量 | 商品管理、库存调整 |
| `color_total_quantity` | 颜色层级 | 某颜色下所有尺寸的总数量 | 商品管理、颜色统计 |
| `product_total_quantity` | 商品层级 | 整个商品所有SKU的总数量 | 商品列表、总体统计 |

### 层级关系图
```
商品(Product) - product_total_quantity
├── 颜色(Color) - color_total_quantity  
│   ├── SKU(尺寸) - sku_total_quantity
│   │   ├── 库位A - sku_location_quantity
│   │   └── 库位B - sku_location_quantity
│   └── SKU(尺寸) - sku_total_quantity
└── 颜色(Color) - color_total_quantity
    └── ...
```

## 📊 总数量字段命名规范

| 字段名 | 层级 | 说明 | 示例值 |
|--------|------|------|--------|
| `sku_total_quantity` | SKU层级 | 单个SKU在所有库位的总数量 | 120 |
| `color_total_quantity` | 颜色层级 | 某颜色下所有尺寸的总数量 | 350 |
| `product_total_quantity` | 商品层级 | 整个商品所有SKU的总数量 | 800 |
| `sku_location_quantity` | 库位层级 | SKU在特定库位的数量 | 50 |

**层级关系**: 商品 → 颜色 → SKU(尺寸) → 库位，数量字段按层级逐级汇总

## 🔐 认证接口

| 方法 | 路径 | 说明 | 主要参数 |
|------|------|------|----------|
| POST | `/auth/login` | 用户登录 | `username`, `password` |
| POST | `/auth/register` | 注册用户 | `username`, `password`, `role` |
| GET | `/auth/me` | 当前用户信息 | - |
| GET | `/auth/users` | 用户列表（管理员） | - |
| POST | `/auth/change_password` | 修改密码 | `old_password`, `new_password` |

## 📦 商品管理

| 方法 | 路径 | 说明 | 主要参数 |
|------|------|------|----------|
| GET | `/products` | 商品列表 | `page`, `page_size`, `search`, `category_code_1`, `has_stock_only` |
| GET | `/products/:id` | 商品详情 | - |
| GET | `/products/code/:code` | 按编码查商品 | - |
| GET | `/products/external-code/:code` | 按外部码查商品 | - |
| POST | `/products` | 创建商品 | `product_code`, `product_name`, `colors`, `category_code_1`, `operator_id` |
| PUT | `/products/:id` | 更新商品 | `operator_id`, `product_name`, `colors`, `category_code_1` |
| DELETE | `/products/:id` | 删除商品 | `operator_id`, `notes` |

### 商品查询接口详情

#### GET /products - 商品列表（增强版，包含库存统计）
**查询参数**:
- `page` (number): 页码，从1开始，默认1
- `page_size` (number): 每页条数，默认20，最大100
- `search` (string): 搜索关键词，支持商品编码、商品名称模糊查询
- `category_code_1` (string): 按一级分类筛选
- `category_code_2` (string): 按二级分类筛选  
- `has_stock_only` (boolean): 只显示有库存的商品，默认false

**响应格式** (现在包含完整库存统计信息):
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "product_id": "64f9a1b2c3d4e5f6789abc01",
        "product_code": "SHIRT-001",
        "product_name": "经典衬衫",
        "product_total_quantity": 280,    // 商品总库存
        "total_sku_count": 4,             // SKU总数量
        "total_location_count": 3,        // 库位总数量  
        "total_color_count": 2,           // 颜色总数量
        "colors": [
          {
            "color": "红",
            "color_total_quantity": 150,  // 该颜色总库存
            "total_sku_count": 2,         // 该颜色SKU数量
            "total_location_count": 2,    // 该颜色库位数量
            "sizes": [
              {
                "sku_code": "SHIRT-001-红-L",
                "sku_total_quantity": 100, // 该SKU总库存
                "locations": [
                  {
                    "location_code": "A01-01-01",
                    "stock_quantity": 60    // 库位级别库存
                  }
                ]
              }
            ]
          }
        ],
        "skus": [...] // 扁平SKU列表（兼容性）
      }
    ],
    "pagination": {
      "current_page": 1,
      "page_size": 20,
      "total_count": 25,
      "total_pages": 2,
      "has_next_page": true,
      "has_prev_page": false
    }
  }
}
```

**🔥 新特性**:
- **多层级库存统计**: 商品→颜色→SKU→库位的完整库存数据
- **统计信息**: 包含total_sku_count、total_location_count、total_color_count等统计
- **库位明细**: 每个SKU在各库位的具体库存分布
- **与原/inventory/by-product一致**: 返回相同格式的库存结构（该接口已删除）

#### GET /products/:id - 商品详情
**路径参数**: `id` (string) - 商品ID（MongoDB ObjectId）

#### DELETE /products/:id - 删除商品
**请求参数**:
- `operator_id` (string, 必需): 操作人ID
- `notes` (string, 可选): 删除原因说明
- `is_urgent` (boolean, 可选): 是否紧急操作

**安全检查**: 商品有库存时拒绝删除，返回错误信息

### 商品创建响应示例
层级结构：商品 → 颜色 → 尺寸，响应包含所有层级的总数量字段：
```json
{
  "data": {
    "product_id": "64f9a1b2c3d4e5f6789abc01",
    "product_code": "SHIRT-001",
    "product_name": "经典衬衫",
    "product_total_quantity": 0,
    "colors": [
      {
        "color": "红",
        "image_path": "/uploads/shirt-red.jpg",
        "color_total_quantity": 0,
        "sizes": [
          {
            "sku_size": "L",
            "sku_code": "SHIRT-001-红-L",
            "sku_total_quantity": 0
          }
        ]
      }
    ]
  }
}
```

## 📊 库存管理（推荐接口）

| 方法 | 路径 | 说明 | 主要参数 |
|------|------|------|----------|
| **GET** | **`/inventory/location`** | **🔧 统一库位查询（推荐）** | `location_code`, `page`, `page_size`, `has_stock_only` |
| GET | `/inventory/location/:location_code` | 📍 RESTful风格库位查询 | - |
| ~~GET~~ | ~~`/inventory/by-product`~~ | **🗑️ 已删除** | - | 功能已整合到 `/products` |

| POST | `/inventory/adjust` | 库存盘点调整 | `location_code`, `sku_code`, `target_quantity`, `operator_id` |
| POST | `/inventory/transfer` | 库存转移 | `sku_code`, `from_location_code`, `to_location_code`, `transfer_quantity`, `operator_id` |

### 统一库位查询接口说明
- **查询所有库位**: `GET /inventory/location` （返回所有有库存的库位，支持分页）
- **查询指定库位**: `GET /inventory/location?location_code=A01-01-01` 或 `GET /inventory/location/A01-01-01` （两种写法效果相同）
- **分页查询**: `GET /inventory/location?page=2&page_size=20` （分页返回库位列表）
- **包含零库存**: `GET /inventory/location?has_stock_only=false` （显示所有商品包括零库存）

## 📥📤 入库出库

| 方法 | 路径 | 说明 | 主要参数 |
|------|------|------|----------|
| POST | `/inbound` | 商品入库 | `sku_code`, `location_code`, `inbound_quantity` |
| POST | `/outbound` | 商品出库 | `sku_code`, `location_code`, `outbound_quantity` |

## 📍 库位管理

| 方法 | 路径 | 说明 | 主要参数 |
|------|------|------|----------|
| GET | `/locations` | 库位列表 | `page`, `page_size`, `search` |
| GET | `/locations/:id` | 库位详情 | - |
| GET | `/locations/code/:location_code` | 按编码查库位 | - |
| POST | `/locations` | 创建库位 | `location_code`, `location_name`, `operator_id` |
| PUT | `/locations/:id` | 更新库位 | `location_name`, `operator_id` |
| DELETE | `/locations/:id` | 删除库位 | - |

## 🔗 外部条码管理

| 方法 | 路径 | 说明 | 主要参数 |
|------|------|------|----------|
| **GET** | **`/products/external-code/:code`** | **按外部码查商品（推荐）** | **智能查询，支持SKU级自动选择** |
| GET | `/sku/:sku_code/external-codes` | 获取SKU外部码 | - |
| POST | `/sku/:sku_code/external-codes` | 添加外部码 | `external_code`, `operator_id` |
| DELETE | `/sku/:sku_code/external-codes/:external_code` | 删除外部码 | - |
| GET | `/products/:id/external-codes` | 获取商品外部码 | - |
| POST | `/products/:id/external-codes` | 添加商品外部码 | `code`, `source`, `description` |

### 外部条码查询说明
- **商品级外部条码**: 返回商品信息，用户需手动选择颜色尺码
- **SKU级外部条码**: 返回 `matched_sku` 字段，**自动选择对应的颜色尺码**
- **统一体验**: SKU级外部条码查询 = SKU编码查询（用户体验完全一致）

## 🖼️ 文件上传

| 方法 | 路径 | 说明 | 主要参数 |
|------|------|------|----------|
| POST | `/upload/image` | 上传图片 | `image` (multipart) |

## ⚠️ 常见错误代码

| 错误代码 | HTTP状态 | 说明 |
|----------|----------|------|
| `INVALID_PARAMETERS` | 400 | 参数无效 |
| `UNAUTHORIZED` | 401 | 未认证 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `INSUFFICIENT_STOCK` | 400 | 库存不足 |
| `API_DEPRECATED` | 410 | 接口已废弃 |

## 🎯 核心业务流程

### 1. 商品创建流程
```bash
# 1. 登录获取token
POST /auth/login {"username": "admin", "password": "123456"}

# 2. 创建变体商品（如衣服，有多个颜色尺寸）
POST /products {
  "product_code": "SHIRT-001",
  "product_name": "经典衬衫",
  "unit": "件",
  "category_code_1": "CLOTHING",
  "category_name_1": "服装",
  "category_code_2": "TOPS", 
  "category_name_2": "上装",
  "colors": [
    {
      "color": "红",
      "image_path": "/uploads/shirt-red.jpg",
      "sizes": [{"size": "L"}, {"size": "XL"}]
    }
  ],
  "operator_id": "user123"
}

# 注意：系统不支持简单商品，所有商品都必须有颜色和尺寸结构
```

### 2. 商品入库流程
```bash
# 1. 登录获取token
POST /auth/login {"username": "admin", "password": "123456"}

# 2. 商品入库（商品必须预先存在，可自动创建库位）
POST /inbound {
  "sku_code": "PROD001-RED-L",
  "location_code": "A1-B2-C3",
  "inbound_quantity": 100
}
```

### 3. 库存查询流程
```bash
# 按库位查询（盘点场景）
GET /inventory/location

# 按商品查询（商品管理场景）
GET /products?page=1&page_size=50
```

### 4. 库存调整流程
```bash
# 盘点调整（直接设置目标数量）
POST /inventory/adjust {
  "location_code": "A1-B2-C3", 
  "sku_code": "PROD001-RED-L",
  "target_quantity": 95,
  "operator_id": "user123",
  "notes": "盘点修正"
}
```

### 5. 库存转移流程
```bash
# 库位间转移
POST /inventory/transfer {
  "sku_code": "PROD001-RED-L",
  "from_location_code": "A1-B2-C3",
  "to_location_code": "D4-E5-F6", 
  "transfer_quantity": 20,
  "operator_id": "user123"
}
```

## 💡 重要提醒

1. **字段命名**: 严格使用 `snake_case`，如 `product_code`、`location_code`
2. **废弃接口**: 不要使用 `/inventory` 等已废弃接口
3. **操作审计**: 所有修改操作必须传递 `operator_id`
4. **智能解析**: 入库时可直接使用 SKU 编码，系统自动解析（商品必须预先存在）
5. **库存检查**: 出库前系统会自动检查库存是否充足

## 📖 完整文档

详细的接口说明请查看：[API完整文档](./api-docs-complete.html) 