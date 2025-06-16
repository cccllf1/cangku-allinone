# 仓库管理系统前端（移动端）

本项目为仓库管理系统的移动端网页（React），支持商品入库、出库、盘点、断码补货、SKU管理、库位管理等功能，适配手机PDA扫码枪。

---

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动开发环境
```bash
npm start
```
- 默认访问地址：http://localhost:8610
- 也可通过内网IP访问（如 http://192.168.11.252:8610）

### 3. 打包生产环境
```bash
npm run build
```
- 打包后文件在 `build/` 目录
- 用于 Docker/Nginx 部署

---

## ⚙️ 依赖环境
- Node.js 16+（建议 LTS 版本）
- npm 8+
- 推荐使用 Chrome/Edge/国产浏览器最新版

---

## 📦 主要功能模块
- 商品入库、出库、盘点、断码补货
- SKU/商品/库位管理
- 条码扫码、PDA扫码枪适配
- API接口与后端服务对接
- 支持多仓库、多用户

---

## 📖 API文档入口
- 访问 [http://192.168.11.252:8611/api-docs.html](http://192.168.11.252:8611/api-docs.html) 查看完整接口文档
- 字段命名规范见 `../API-NAMING-STANDARD.md`

---

## 🛠️ 常见问题

1. **前端页面403/404？**
   - 检查 `build/` 目录是否存在，或 Docker/Nginx 配置是否正确。
2. **接口请求失败？**
   - 检查后端服务（8611端口）是否已启动，前后端网络是否互通。
3. **扫码无反应？**
   - 建议使用 Chrome/Edge 浏览器，或检查扫码枪是否为 HID 键盘模式。
4. **字段名报错？**
   - 请严格使用 snake_case 格式，详见 API-NAMING-STANDARD.md。

---

## 👤 维护人/联系方式
- 负责人：cccllf1
- GitHub: https://github.com/cccllf1/cangku-allinone
- 内网服务器：192.168.11.252

如有问题请先查阅 API 文档和本说明，再联系维护人。

---

## 📝 其它说明
- 本项目基于 [Create React App](https://github.com/facebook/create-react-app) 搭建
- 仅供公司/团队内部使用，严禁外泄源码
- 如需二次开发请遵循 API 命名规范
