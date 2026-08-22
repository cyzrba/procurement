const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const COLLECTION = 'comments';

exports.main = async (event, context) => {
  const { action, data } = event;
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return { code: 401, message: '未登录' };
  }

  try {
    switch (action) {
      // 用户端
      case 'create':
        return await createComment(OPENID, data);
      case 'list':
        return await listComments(OPENID, data);
      case 'update':
        return await updateComment(OPENID, data);
      case 'delete':
        return await deleteComment(OPENID, data);
      // 管理端
      case 'listAll':
        return await listAllComments(OPENID, data);
      case 'deleteByAdmin':
        return await deleteCommentByAdmin(OPENID, data);
      default:
        return { code: -1, message: '未知操作' };
    }
  } catch (err) {
    console.error('[comment] 错误:', err);
    return { code: 500, message: '服务器内部错误' };
  }
};

// 通过 openId 查找当前登录用户（普通用户）
async function findUser(openId) {
  const res = await db.collection('users')
    .where({ openId, role: 'user', status: 'active' })
    .get();
  return res.data[0] || null;
}

// 通过 openId 查找当前登录管理员
async function findAdmin(openId) {
  const res = await db.collection('users')
    .where({ openId, role: 'admin' })
    .get();
  return res.data[0] || null;
}

function normalizeText(content) {
  return typeof content === 'string' ? content.trim() : '';
}

function normalizePage(page = 1, pageSize = 20) {
  return {
    page: Math.max(1, parseInt(page, 10) || 1),
    pageSize: Math.min(50, Math.max(1, parseInt(pageSize, 10) || 20))
  };
}

async function ensureCollection() {
  try {
    await db.createCollection(COLLECTION);
  } catch (err) {
    // 已存在集合时忽略
  }
}

// 用户发布留言（内容长度不限制）
async function createComment(openId, { content } = {}) {
  const user = await findUser(openId);
  if (!user) {
    return { code: 1002, message: '用户不存在或未登录，请重新登录' };
  }

  const text = normalizeText(content);
  if (!text) {
    return { code: 1001, message: '留言内容不能为空' };
  }

  await ensureCollection();

  const res = await db.collection(COLLECTION).add({
    data: {
      content: text,
      userId: user._id,
      userName: user.name,
      userPhone: user.phone || '',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });

  return {
    code: 0,
    data: {
      _id: res._id,
      content: text,
      userName: user.name,
      userPhone: user.phone || ''
    }
  };
}

// 用户查看自己的留言（最新发表的在最上面）
async function listComments(openId, params = {}) {
  const user = await findUser(openId);
  if (!user) {
    return { code: 1002, message: '用户不存在或未登录，请重新登录' };
  }

  const { page, pageSize } = normalizePage(params.page, params.pageSize);
  const where = { userId: user._id };

  try {
    const countRes = await db.collection(COLLECTION).where(where).count();
    const res = await db.collection(COLLECTION)
      .where(where)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    return {
      code: 0,
      data: {
        total: countRes.total,
        page,
        pageSize,
        list: res.data
      }
    };
  } catch (err) {
    if (err.errCode === -502005 || (err.message && err.message.includes('not exist'))) {
      return { code: 0, data: { total: 0, page, pageSize, list: [] } };
    }
    throw err;
  }
}

// 用户编辑自己的留言
async function updateComment(openId, { _id, content } = {}) {
  const user = await findUser(openId);
  if (!user) {
    return { code: 1002, message: '用户不存在或未登录，请重新登录' };
  }
  if (!_id) {
    return { code: 1001, message: '参数缺失' };
  }

  const text = normalizeText(content);
  if (!text) {
    return { code: 1001, message: '留言内容不能为空' };
  }

  const res = await db.collection(COLLECTION).doc(_id).get();
  if (!res.data) {
    return { code: 1004, message: '留言不存在或已被删除' };
  }
  if (res.data.userId !== user._id) {
    return { code: 1005, message: '只能编辑自己的留言' };
  }

  await db.collection(COLLECTION).doc(_id).update({
    data: {
      content: text,
      updatedAt: db.serverDate()
    }
  });

  return { code: 0, data: { _id, content: text } };
}

// 用户删除自己的留言
async function deleteComment(openId, { _id } = {}) {
  const user = await findUser(openId);
  if (!user) {
    return { code: 1002, message: '用户不存在或未登录，请重新登录' };
  }
  if (!_id) {
    return { code: 1001, message: '参数缺失' };
  }

  const res = await db.collection(COLLECTION).doc(_id).get();
  if (!res.data) {
    return { code: 1004, message: '留言不存在或已被删除' };
  }
  if (res.data.userId !== user._id) {
    return { code: 1005, message: '只能删除自己的留言' };
  }

  await db.collection(COLLECTION).doc(_id).remove();
  return { code: 0, data: { _id } };
}

// 管理员查看全部留言
async function listAllComments(openId, params = {}) {
  const admin = await findAdmin(openId);
  if (!admin) {
    return { code: 1003, message: '管理员身份验证失败，请重新登录管理后台' };
  }

  const { page, pageSize } = normalizePage(params.page, params.pageSize);

  // 按日期筛选：start/end 为毫秒时间戳（客户端按本地时区计算的一天范围）
  const base = db.collection(COLLECTION);
  let query = base;
  if (params.start && params.end) {
    const start = new Date(params.start);
    const end = new Date(params.end);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const _ = db.command;
      query = base.where({ createdAt: _.gte(start).and(_.lt(end)) });
    }
  }

  try {
    const countRes = await query.count();
    const res = await query
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    return {
      code: 0,
      data: {
        total: countRes.total,
        page,
        pageSize,
        list: res.data
      }
    };
  } catch (err) {
    if (err.errCode === -502005 || (err.message && err.message.includes('not exist'))) {
      return { code: 0, data: { total: 0, page, pageSize, list: [] } };
    }
    throw err;
  }
}

// 管理员删除留言（无编辑功能）
async function deleteCommentByAdmin(openId, { _id } = {}) {
  const admin = await findAdmin(openId);
  if (!admin) {
    return { code: 1003, message: '管理员身份验证失败，请重新登录管理后台' };
  }
  if (!_id) {
    return { code: 1001, message: '参数缺失' };
  }

  const res = await db.collection(COLLECTION).doc(_id).get();
  if (!res.data) {
    return { code: 1004, message: '留言不存在或已被删除' };
  }

  const targetName = res.data.userName || '';
  await db.collection(COLLECTION).doc(_id).remove();

  await writeLog({
    module: 'comment',
    action: 'delete',
    targetId: _id,
    targetName,
    detail: `删除用户「${targetName}」的留言`,
    operatorId: admin._id,
    operatorName: admin.name
  });

  return { code: 0, data: { _id } };
}

async function writeLog(logData) {
  try {
    await db.collection('admin_logs').add({
      data: {
        ...logData,
        createdAt: db.serverDate()
      }
    });
  } catch (err) {
    if (err.errCode === -502005 || (err.message && err.message.includes('not exist'))) {
      try {
        await db.createCollection('admin_logs');
        await db.collection('admin_logs').add({
          data: {
            ...logData,
            createdAt: db.serverDate()
          }
        });
      } catch (e2) {
        console.error('[comment] 日志写入失败:', e2);
      }
    } else {
      console.error('[comment] 日志写入失败:', err);
    }
  }
}
