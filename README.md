# 院内采购决策树 · 微信小程序

基于**微信云开发**的采购指南智能推送系统。用户通过选择采购类目和预算区间，即可匹配对应的采购指南；管理员可通过后台管理类目、价格区间、指南、用户及消息推送。

---

## 项目概览

| 项目 | 说明 |
|------|------|
| **AppID** | `wx1064c076fd98dffe` |
| **云环境** | `cloud1-d6g9vtjt1327cb3fc` |
| **基础库** | `3.16.1` |
| **技术栈** | 微信小程序 + 云开发（云函数 / 云数据库 / 云存储） |
| **认证方式** | 普通用户：姓名+手机号；管理员：用户名+密码 |
| **配色主题** | 主色 `#1a7a7a` 青色，辅色 `#e8a838` 琥珀金，背景 `#f7f3ee` 暖白 |

### 业务流程图

```
用户端：
  登录(姓名+手机) → 首页选择类目 → 选择预算区间 → 匹配指南列表 → 查看指南详情+下载附件
  └─ 我的 → 消息中心 / 微信订阅开关 / 退出登录

管理端：
  登录(用户名+密码) → 管理后台仪表盘
  ├─ 类目管理 (增删改查)
  ├─ 价格区间管理 (增删改查)
  ├─ 采购指南管理 (增删改查 + 发布/下架 + 附件上传)
  ├─ 用户管理 (增删改 + Excel批量导入)
  └─ 消息推送 (编辑消息 + 订阅推送)
```

---

## 文件结构

```
n:\procurement\
│
├── project.config.json          # 微信开发者工具项目配置（appid、云函数根目录、基础库版本等）
├── project.private.config.json  # 开发者私有配置（覆盖项目配置，不提交版本库）
├── uploadCloudFunction.sh       # 云函数部署脚本：通过微信 CLI 批量上传云函数
├── README.md                    # 本文件：项目说明文档
│
├── cloudfunctions/              # ========== 云函数目录（后端） ==========
│   │
│   ├── category/                # 类目管理云函数
│   │   ├── index.js             #   入口：类目的 create / update / delete / list
│   │   └── package.json         #   依赖：wx-server-sdk
│   │
│   ├── guide/                   # 采购指南管理云函数
│   │   ├── index.js             #   入口：指南的 CRUD + publish/unpublish + match(匹配)
│   │   └── package.json         #   依赖：wx-server-sdk
│   │
│   ├── message/                 # 消息推送云函数
│   │   ├── index.js             #   入口：消息 CRUD + 订阅消息批量推送(sendSubscription)
│   │   └── package.json         #   依赖：wx-server-sdk
│   │
│   ├── priceRange/              # 价格区间管理云函数
│   │   ├── index.js             #   入口：价格区间的 CRUD + match(金额匹配区间)
│   │   └── package.json         #   依赖：wx-server-sdk
│   │
│   ├── upload/                  # 文件上传云函数
│   │   ├── index.js             #   入口：获取云存储文件临时下载链接(getTempFileURL)
│   │   └── package.json         #   依赖：wx-server-sdk
│   │
│   ├── user/                    # 用户认证云函数
│   │   ├── index.js             #   入口：用户登陆 / 管理员登陆 / 自动登陆 / 订阅管理 / 用户管理
│   │   ├── package.json         #   依赖：wx-server-sdk + bcryptjs + jsonwebtoken
│   │   └── package-lock.json    #   依赖锁定
│   │
│   └── userImport/              # 用户批量导入云函数
│       ├── index.js             #   入口：读取 Excel 文件 → 解析用户数据 → 批量写入数据库
│       ├── package.json         #   依赖：wx-server-sdk + xlsx
│       └── package-lock.json    #   依赖锁定
│
└── miniprogram/                 # ========== 小程序前端目录 ==========
    │
    ├── app.js                   # 小程序入口：初始化云开发环境(cloud.init)、设置全局数据
    ├── app.json                 # 全局配置：注册所有页面、配置 tabBar(采购/我的)、窗口样式
    ├── app.wxss                 # 全局样式：CSS 变量设计系统、按钮/输入框重置、动画(fadeIn)、无障碍
    ├── envList.js               # 环境列表占位（空数组，未使用）
    ├── sitemap.json             # 站点地图：允许微信搜索索引所有页面
    │
    ├── config/                  # ---------- 配置文件 ----------
    │   └── subscription.js      #   微信订阅消息模板 ID 配置（公告通知 / 指南更新）
    │
    ├── images/                  # ---------- 图片资源 ----------
    │   ├── tab-home.png         #   tabBar "采购" 未选中图标
    │   ├── tab-home-active.png  #   tabBar "采购" 选中图标
    │   ├── tab-my.png           #   tabBar "我的" 未选中图标
    │   └── tab-my-active.png    #   tabBar "我的" 选中图标
    │
    ├── utils/                   # ---------- 工具函数库 ----------
    │   ├── auth.js              #   认证状态管理：存储/读取 token 和用户信息、判断管理员、登出
    │   ├── cloud.js             #   云函数调用封装：统一调用 wx.cloud.callFunction，封装所有 API
    │   └── util.js              #   通用工具函数：格式化金额(¥)、日期、价格标签、空值处理
    │
    └── pages/                   # ---------- 页面目录 ----------
        │
        ├── login/               # 登录页（入口页）
        │   ├── login.js         #   逻辑：普通用户登陆 / 管理员登陆 / 自动登陆 → 跳转首页或后台
        │   ├── login.json       #   配置：导航栏标题"登录"
        │   ├── login.wxml       #   模板：渐变背景 + 毛玻璃卡片 + 表单切换动画
        │   └── login.wxss       #   样式：登录页专属样式
        │
        ├── home/                # 首页 / 采购助手（Tab 1）
        │   ├── home.js          #   逻辑：三步流程 → 选类目 → 选预算 → 匹配指南
        │   ├── home.json        #   配置：导航栏标题"采购助手"
        │   ├── home.wxml        #   模板：步骤指示器 + 类目卡片 + 预算区间单选
        │   └── home.wxss        #   样式：首页专属样式
        │
        ├── my/                  # 个人中心（Tab 2）
        │   ├── my.js            #   逻辑：个人信息展示 + 消息入口 + 微信订阅开关 + 退出登录
        │   ├── my.json          #   配置：导航栏标题"我的"
        │   ├── my.wxml          #   模板：头像卡片 + 菜单列表 + 订阅开关
        │   └── my.wxss          #   样式：个人中心专属样式
        │
        ├── guide-list/          # 指南匹配结果列表
        │   ├── guide-list.js    #   逻辑：接收匹配结果 → 列表展示 → 点击查看详情
        │   ├── guide-list.json  #   配置：导航栏标题"匹配结果"
        │   ├── guide-list.wxml  #   模板：预算信息横幅 + 指南卡片列表 + 重新选择
        │   └── guide-list.wxss  #   样式：结果列表页专属样式
        │
        ├── guide-detail/        # 指南详情页
        │   ├── guide-detail.js  #   逻辑：加载指南完整内容 → 富文本渲染 → 附件下载
        │   ├── guide-detail.json#   配置：导航栏标题"指南详情"
        │   ├── guide-detail.wxml#   模板：封面图 + 标题/元信息 + rich-text 正文 + 附件列表
        │   └── guide-detail.wxss#   样式：详情页专属样式
        │
        ├── messages/            # 消息中心
        │   ├── messages.js      #   逻辑：分页加载消息列表 + 下拉刷新 + 触底加载更多
        │   ├── messages.json    #   配置：导航栏标题"消息中心" + 开启下拉刷新
        │   ├── messages.wxml    #   模板：消息卡片列表
        │   └── messages.wxss    #   样式：消息页专属样式
        │
        └── admin/               # ---------- 管理后台 ----------
            │
            ├── dashboard/       # 管理后台仪表盘
            │   ├── dashboard.js #   逻辑：权限校验 → 5 宫格导航菜单
            │   ├── dashboard.json#  配置：导航栏标题"管理后台"
            │   ├── dashboard.wxml#  模板：深色渐变头部 + 2 列宫格导航 + 帮助提示
            │   └── dashboard.wxss#  样式：仪表盘专属样式
            │
            ├── category/        # 类目管理
            │   ├── category.js  #   逻辑：类目列表 + 新增/编辑弹窗 + 删除确认
            │   ├── category.json#   配置：导航栏标题"类目管理"
            │   ├── category.wxml#   模板：列表 + 底部弹窗表单
            │   └── category.wxss#   样式：类目管理页样式
            │
            ├── price-range/     # 价格区间管理
            │   ├── price-range.js   #   逻辑：区间列表 + 新增/编辑弹窗（min/max/enabled）+ 删除
            │   ├── price-range.json #   配置：导航栏标题"价格区间管理"
            │   ├── price-range.wxml #   模板：列表（含启用/禁用状态标签）+ 弹窗表单
            │   └── price-range.wxss #   样式：价格区间页样式
            │
            ├── guide/           # 采购指南管理
            │   ├── guide.js     #   逻辑：指南列表（状态筛选）+ 新增/编辑（上传封面+附件+富文本）+ 发布/下架/删除
            │   ├── guide.json   #   配置：导航栏标题"采购指南管理"
            │   ├── guide.wxml   #   模板：状态筛选项 + 指南卡片（含状态徽章）+ 复杂表单弹窗
            │   └── guide.wxss   #   样式：指南管理页样式
            │
            ├── user/            # 用户管理
            │   ├── user.js      #   逻辑：用户列表 + 编辑弹窗 + 删除 + Excel 批量导入及结果反馈
            │   ├── user.json    #   配置：导航栏标题"用户管理"
            │   ├── user.wxml    #   模板：列表 + 编辑弹窗 + 导入按钮 + 导入结果详情
            │   └── user.wxss    #   样式：用户管理页样式
            │
            └── message/         # 消息推送管理
                ├── message.js   #   逻辑：消息列表 + 新建消息 + 触发订阅推送 + 推送结果反馈
                ├── message.json #   配置：导航栏标题"消息推送"
                ├── message.wxml #   模板：消息列表 + 新建弹窗 + 推送确认对话框
                └── message.wxss #   样式：消息推送页样式
```

---

## 架构分层

```
┌──────────────────────────────────────────────────────────┐
│                   miniprogram (前端)                       │
│  ┌─────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  pages/  │  │   utils/     │  │  config/ + images/  │ │
│  │ 12 个页面 │  │ auth.js     │  │ 订阅模板 + 图标资源   │ │
│  │          │  │ cloud.js    │  │                      │ │
│  │          │  │ util.js     │  │                      │ │
│  └────┬─────┘  └──────┬───────┘  └──────────────────────┘ │
│       │               │                                    │
│       │    wx.cloud.callFunction()                         │
└───────┼───────────────┼────────────────────────────────────┘
        │               │
┌───────┴───────────────┴────────────────────────────────────┐
│                  cloudfunctions (后端)                       │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌─────────────┐  │
│  │ category │ │  guide   │ │  message  │ │ priceRange  │  │
│  │  类目CRUD │ │ 指南CRUD │ │ 消息+推送  │ │  价格区间    │  │
│  └──────────┘ └──────────┘ └───────────┘ └─────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐                  │
│  │   user   │ │userImport│ │  upload   │                  │
│  │ 用户+认证 │ │ Excel导入 │ │ 文件下载   │                  │
│  └──────────┘ └──────────┘ └───────────┘                  │
│       │               │               │                    │
└───────┴───────────────┴───────────────┴────────────────────┘
        │               │               │
┌───────┴───────────────┴───────────────┴────────────────────┐
│                    微信云开发基础设施                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  云数据库     │  │   云存储      │  │  订阅消息服务     │  │
│  │ 5 个集合     │  │ 封面+附件+Excel│  │  微信模板消息    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 云数据库集合

| 集合名 | 说明 | 关键字段 |
|--------|------|----------|
| `users` | 用户表 | `name`, `phone`, `password`(管理员), `role`(user/admin), `openId`, `status`, `subscribedTemplates` |
| `categories` | 采购类目表 | `name`, `description`, `status`(active) |
| `priceRanges` | 价格区间表 | `label`, `min`, `max`, `enabled` |
| `guides` | 采购指南表 | `title`, `coverImage`, `content`(HTML), `categoryId`, `priceRangeId`, `attachments`, `status`(draft/published/unpublished) |
| `messages` | 消息表 | `title`, `content`, `type`, `targetType`, `targetUserIds`, `subscriptionStats` |

---

## 云函数 API 速览

### 用户模块 (`user`)
| action | 说明 |
|---------|------|
| `userLogin` | 普通用户登录（姓名+手机号） |
| `adminLogin` | 管理员登录（用户名+密码，bcrypt 验证） |
| `autoLogin` | 基于 openId 的静默自动登录 |
| `updateSubscription` | 更新用户订阅模板类型 |
| `getUserInfo` | 获取用户详情 |
| `updateUser` | 管理员编辑用户信息 |
| `deleteUser` | 管理员删除用户 |

### 类目模块 (`category`)
| action | 说明 |
|---------|------|
| `list` | 获取全部类目列表 |
| `create` | 新增类目 |
| `update` | 编辑类目 |
| `delete` | 删除类目（有指南引用时禁止删除） |

### 价格区间模块 (`priceRange`)
| action | 说明 |
|---------|------|
| `list` | 获取全部价格区间（按 min 升序） |
| `create` | 新增价格区间 |
| `update` | 编辑价格区间 |
| `delete` | 删除价格区间（有指南引用时禁止删除） |
| `match` | 根据金额匹配最小区间 |

### 指南模块 (`guide`)
| action | 说明 |
|---------|------|
| `list` | 分页获取指南列表（支持状态和类目筛选） |
| `detail` | 获取指南详情 |
| `create` | 新建指南（草稿状态） |
| `update` | 编辑指南 |
| `publish` / `unpublish` | 发布 / 下架指南 |
| `delete` | 删除指南 |
| `match` | 根据类目+预算区间匹配合适的已发布指南 |

### 消息模块 (`message`)
| action | 说明 |
|---------|------|
| `list` | 分页获取消息列表 |
| `create` | 新建消息 |
| `sendSubscription` | 向订阅用户批量推送微信订阅消息 |

### 导入模块 (`userImport`)
| action | 说明 |
|---------|------|
| `upload` | 解析 Excel 文件并批量导入用户 |

### 上传模块 (`upload`)
| action | 说明 |
|---------|------|
| `getTempFileURL` | 获取云存储文件的临时下载链接 |

---

## 数据流示例

### 用户采购流程
```
1. login/login.js
   └→ cloud.userLogin({ name, phone })
      └→ cloudfunctions/user/index.js → userLogin()
         └→ users 表查询 + openId 绑定 → 返回 JWT token
            └→ auth.save(token, user) → wx.setStorageSync

2. home/home.js
   └→ cloud.getCategories() → categories 表
   └→ cloud.getPriceRanges() → priceRanges 表
   └→ 用户选择后 → cloud.matchGuides(categoryId, priceRangeId)
      └→ cloudfunctions/guide/index.js → match()
         └→ guides 表查询 (status=published, categoryId, priceRangeId)
         └→ 返回匹配指南列表 → 跳转 guide-list 页

3. guide-detail/guide-detail.js
   └→ cloud.getGuideDetail(id) → guides 表
   └→ 附件下载 → cloud.getTempFileURL(fileIds) → wx.downloadFile → wx.openDocument
```

### 管理后台流程
```
1. login/login.js
   └→ cloud.adminLogin({ username, password })
      └→ cloudfunctions/user/index.js → adminLogin()
         └→ users 表查询 → bcrypt.compareSync → 返回 JWT token
         └→ 跳转 admin/dashboard/dashboard

2. admin/guide/guide.js (创建指南)
   └→ wx.chooseImage → wx.cloud.uploadFile (封面上传)
   └→ wx.chooseMessageFile → wx.cloud.uploadFile (附件上传)
   └→ cloud.createGuide({ title, content, categoryId, priceRangeId, attachments, ... })

3. admin/message/message.js (推送消息)
   └→ cloud.createMessage({ title, content, type, targetType })
   └→ cloud.sendSubscriptionMessage(messageId)
      └→ cloudfunctions/message/index.js → sendSubscription()
         └→ 遍历订阅用户 → cloud.openapi.subscribeMessage.send
```

---

## 认证与安全

| 项目 | 说明 |
|------|------|
| **用户认证** | 姓名+手机号验证，登录绑定 openId |
| **管理员认证** | 用户名+密码，密码经 bcrypt 哈希存储 |
| **JWT Token** | 管理后台和用户均签发 JWT，有效期 2 小时 |
| **自动登录** | 通过微信 openId 实现静默自动登录 |
| **前端鉴权** | `auth.isAdmin()` 检查用户角色，管理员页面入口做权限校验 |

---

## 开发环境

1. 克隆仓库后用**微信开发者工具**打开项目根目录
2. 确保已开通云开发并配置环境 ID 为 `cloud1-d6g9vtjt1327cb3fc`
3. 在开发者工具中右键云函数目录 → 上传并部署（或执行 `uploadCloudFunction.sh`）
4. 在云开发控制台创建上述 5 个数据库集合并设置适当权限
5. 编译运行即可预览

---

## 参考文档

- [微信云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [微信小程序开发指南](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [订阅消息开发指南](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message.html)
