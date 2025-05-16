# 仓库管理系统 - 修复指南

## 最新修复：库位管理API认证问题

解决了库位管理页面无法添加货位的认证问题：

1. 修改了LocationManage.js使用带认证的API请求
2. 从直接使用axios改为使用带认证功能的api实例
3. 为所有API请求添加错误处理和日志记录
4. 确保localStorage中的token被正确应用

这些改进使得库位管理页面能够正确与后端API通信，支持添加、修改和删除货位功能。

### 如何应用修改

在NAS上执行以下命令：

```bash
# 进入项目目录
cd /volume1/docker/cangku-allinone

# 停止前端容器
docker-compose stop frontend

# 重新构建前端
docker-compose build frontend

# 启动前端容器
docker-compose up -d frontend
```

## 最新修复：个人信息页面认证问题

解决了个人信息页面显示401未授权错误的问题：

1. 完善了auth.js中的认证和错误处理逻辑
2. 增强了Profile.js中获取用户信息的容错性
3. 添加了详细的日志输出，方便诊断问题
4. 确保localStorage中token处理的一致性

这些改进使得个人信息页面能够正确显示当前用户名，并支持修改用户名和密码的功能。

### 如何应用修改

在NAS上执行以下命令：

```bash
# 进入项目目录
cd /volume1/docker/cangku-allinone

# 停止前端容器
docker-compose stop frontend

# 重新构建前端
docker-compose build frontend

# 启动前端容器
docker-compose up -d frontend
```

## 最新修复：统一API URL路径

解决了API请求中硬编码IP地址和端口的问题：

1. 修改了auth.js中的API URL，从`http://192.168.11.252:8611/api`改为`/api`
2. 统一了user.js中的API路径格式，去除了多余的`/api`前缀
3. 确保所有API请求使用相对路径而不是硬编码的IP和端口
4. 解决了货位管理、个人设置等功能的连接超时问题

这些修改保证系统可以适应不同环境部署，无论是本地开发还是NAS Docker容器。

### 如何应用修改

在NAS上执行以下命令：

```bash
# 进入项目目录
cd /volume1/docker/cangku-allinone

# 停止前端容器
docker-compose stop frontend

# 重新构建前端
docker-compose build frontend

# 启动前端容器
docker-compose up -d frontend
```

## 最新修复：产品管理API认证问题

解决了产品管理页面无法显示产品数据的认证问题：

1. 修改了ProductManage.js使用带认证的API请求
2. 从直接使用axios改为使用带认证功能的api实例
3. 增强了错误处理和数据过滤的健壮性
4. 修复了数据为空时可能导致的崩溃问题

这些改进使得产品管理页面能够正确获取和显示数据库中的产品信息，并支持添加、编辑和删除产品功能。

### 如何应用修改

在NAS上执行以下命令：

```bash
# 进入项目目录
cd /volume1/docker/cangku-allinone

# 停止前端容器
docker-compose stop frontend

# 重新构建前端
docker-compose build frontend

# 启动前端容器
docker-compose up -d frontend
```

## 之前的修复：API URL配置错误

我们修复了API URL配置错误导致的连接超时问题：

1. 在user.js中修改了API URL，从硬编码的IP地址改为使用相对路径
2. 这解决了货位管理页面无法添加新货位的问题
3. 也修复了个人设置页面的连接超时错误

## 之前的修复：个人设置页面问题

我们修复了个人设置页面的两个问题：

1. 当前用户名不显示
   - 修复了获取用户信息的数据解析问题
   - 正确处理后端返回的用户数据格式

2. 密码修改功能
   - 分离了用户名修改和密码修改的API调用
   - 优化了表单验证逻辑，使密码字段变为可选
   - 改进了错误处理和用户反馈

## 之前的修复：产品页面整合

为了简化系统，我们删除了重复的产品页面：

1. 删除了未使用的Products.js文件
2. 保留ProductManage.js作为唯一的产品管理页面
3. 确保路由配置正确指向ProductManage组件

## 之前的修复：产品页面导航问题

我们修复了产品管理页面的导航问题，具体修改如下：

1. 修复了路由配置中的冲突：删除了重复的`/products`路由定义
2. 确保`ProductManage`组件被正确使用并有导航栏

## 之前的修复：自动创建库位功能

为了改进用户体验，我们添加了当商品没有指定库位时自动创建默认库位的功能。

### 修改内容

1. 当用户未填写库位时，系统将自动使用名为"DEFAULT"的默认库位
2. 如果该默认库位不存在，系统会自动创建
3. 防止因缺少库位而导致入库失败
4. 增强错误处理，提供更详细的错误信息

## 之前的修复：API路径问题

### 发现的问题

在入库管理页面，扫描商品编码时出现404错误：
`Failed to load resources: the server responded with a status 404 (Not Found) api/products/code/P001:1`

### 问题原因

前端代码中的API路径不正确。在`Inbound.js`中发现了错误的API调用路径，试图通过`/api/products/${code}/`获取商品信息，而正确的路径应该是`/api/products/code/${code}`。

### 修复方法

请在NAS的SSH中执行以下操作：

```bash
# 进入项目目录
cd /volume1/docker/cangku-allinone

# 编辑文件
vi cangku-guanli/src/pages/Inbound.js

# 找到第182行左右的内容：
# const response = await fetch(`/api/products/${code}/`, {
# 修改为：
# const response = await fetch(`/api/products/code/${code}`, {

# 保存并退出

# 重新构建并重启前端容器
docker-compose build frontend
docker-compose up -d frontend
```

修复后，入库管理页面的商品编码扫描功能应该可以正常工作了。 