const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { action, data } = event;

  try {
    switch (action) {
      case 'list':
        return await listLogs(data);
      case 'deleteBatch':
        return await deleteBatchLogs(data);
      default:
        return { code: -1, message: '未知操作' };
    }
  } catch (err) {
    console.error('[adminLog] 错误:', err);
    return { code: 500, message: '服务器内部错误' };
  }
};

async function listLogs({ module, page = 1, pageSize = 50 } = {}) {
  const where = {};
  if (module) where.module = module;

  try {
    const countRes = await db.collection('admin_logs').where(where).count();

    const res = await db.collection('admin_logs')
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

async function deleteBatchLogs({ ids } = {}) {
  if (!ids || !ids.length) {
    return { code: 1001, message: '参数缺失' };
  }

  const _ = db.command;
  await db.collection('admin_logs')
    .where({ _id: _.in(ids) })
    .remove();

  return { code: 0, data: { deleted: ids.length } };
}
