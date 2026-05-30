const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 订阅消息模板ID（需与 miniprogram/config/subscription.js 保持一致）
// 在微信公众平台 → 功能 → 订阅消息 中创建模板后替换下方占位值
const SUBSCRIPTION_TEMPLATES = {
  announcement: { templateId: 'z4zC7BCDVfmk-Dvk0UbYkOdFRK6kVkJ4L4qYiNrYTAc' },
  guide_update: { templateId: 'z4zC7BCDVfmk-Dvk0UbYkOdFRK6kVkJ4L4qYiNrYTAc' }
};

exports.main = async (event, context) => {
  const { action, data } = event;

  try {
    switch (action) {
      case 'create':
        return await createMessage(data);
      case 'list':
        return await listMessages(data);
      case 'send':
        return await sendMessage(data);
      case 'sendSubscription':
        return await sendSubscription(data);
      default:
        return { code: -1, message: '未知操作' };
    }
  } catch (err) {
    console.error('[message] 错误:', err);
    return { code: 500, message: '服务器内部错误' };
  }
};

async function createMessage({ title, content, type, targetType, targetUserIds, createdBy }) {
  if (!title || !content) return { code: 1001, message: '参数缺失' };

  const res = await db.collection('messages').add({
    data: {
      title,
      content,
      type: type || 'announcement',
      targetType: targetType || 'all',
      targetUserIds: targetUserIds || [],
      createdBy: createdBy || '',
      createdAt: db.serverDate()
    }
  });

  return { code: 0, data: { messageId: res._id, recipientCount: 0 } };
}

async function listMessages({ page = 1, pageSize = 20 }) {
  const countRes = await db.collection('messages').count();
  const total = countRes.total;

  const res = await db.collection('messages')
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();

  return {
    code: 0,
    data: {
      total,
      page,
      pageSize,
      list: res.data
    }
  };
}

async function sendMessage(data) {
  // 简化版：创建消息 + 管理端标记推送
  return await createMessage(data);
}

async function sendSubscription({ messageId }) {
  if (!messageId) return { code: 1001, message: '参数缺失' };

  // 1. 获取消息
  const msgRes = await db.collection('messages').doc(messageId).get();
  if (!msgRes.data) return { code: 1004, message: '消息不存在' };
  const message = msgRes.data;

  // 2. 检查模板配置
  const msgType = message.type || 'announcement';
  const template = SUBSCRIPTION_TEMPLATES[msgType];
  if (!template || !template.templateId || template.templateId.startsWith('YOUR_')) {
    return { code: 1005, message: '订阅消息模板未配置，请在云函数中设置模板ID' };
  }

  // 3. 构建用户查询 — 只发给已订阅该类型且有 openId 的活跃用户
  const _ = db.command;
  let userQuery = {
    role: 'user',
    status: 'active',
    openId: _.neq(''),
    subscribedTemplates: msgType
  };

  // 如果消息指定了目标用户，额外过滤
  if (message.targetType === 'specific' && message.targetUserIds && message.targetUserIds.length > 0) {
    userQuery = { ...userQuery, _id: _.in(message.targetUserIds) };
  }

  // 4. 分页获取目标用户（cloud DB limit=100）
  let users = [];
  let offset = 0;
  const pageSize = 100;
  let hasMore = true;

  while (hasMore) {
    const res = await db.collection('users').where(userQuery).skip(offset).limit(pageSize).get();
    users = users.concat(res.data);
    offset += pageSize;
    hasMore = res.data.length === pageSize;
  }

  if (users.length === 0) {
    return { code: 0, data: { total: 0, sent: 0, failed: 0, errors: [], message: '没有已订阅的用户' } };
  }

  // 5. 逐用户发送订阅消息
  let sent = 0;
  let failed = 0;
  const errors = [];

  for (const user of users) {
    try {
      // 格式化发布时间
      const pad = n => String(n).padStart(2, '0');
      const now = new Date();
      const publishTime = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

      await cloud.openapi.subscribeMessage.send({
        touser: user.openId,
        templateId: template.templateId,
        page: 'pages/my/my',
        data: {
          thing2: { value: (message.content || '').substring(0, 20) },
          time3: { value: publishTime }
        },
        miniprogramState: 'formal'
      });
      sent++;
    } catch (err) {
      console.error('[sendSubscription] 发送失败 userId=' + user._id + ', openId=' + user.openId + ', error:', err);
      failed++;
      errors.push({ userId: user._id, error: String(err.message || err).substring(0, 100) });
    }
  }

  // 6. 记录发送统计
  try {
    await db.collection('messages').doc(messageId).update({
      data: {
        subscriptionSentAt: db.serverDate(),
        subscriptionStats: { total: users.length, sent, failed }
      }
    });
  } catch (_) {
    // 统计记录失败不影响主流程
  }

  return {
    code: 0,
    data: { total: users.length, sent, failed, errors }
  };
}
