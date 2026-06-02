const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { action, data } = event;

  try {
    switch (action) {
      case 'create':
        return await createPriceRange(data);
      case 'update':
        return await updatePriceRange(data);
      case 'delete':
        return await deletePriceRange(data);
      case 'list':
        return await listPriceRanges(data);
      case 'match':
        return await matchPriceRange(data);
      default:
        return { code: -1, message: '未知操作' };
    }
  } catch (err) {
    console.error('[priceRange] 错误:', err);
    return { code: 500, message: '服务器内部错误' };
  }
};

async function createPriceRange({ label, min, max, enabled, operatorId, operatorName }) {
  if (!label || min === undefined || max === undefined) {
    return { code: 1001, message: '参数缺失' };
  }

  const res = await db.collection('priceRanges').add({
    data: {
      label,
      min,
      max,
      enabled: enabled !== undefined ? enabled : true,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });

  await writeLog({
    module: 'priceRange',
    action: 'create',
    targetId: res._id,
    targetName: label,
    detail: `新增价格区间「${label}」`,
    operatorId,
    operatorName
  });

  return { code: 0, data: { _id: res._id } };
}

async function updatePriceRange({ _id, label, min, max, enabled, operatorId, operatorName }) {
  if (!_id) return { code: 1001, message: '参数缺失' };

  const updateData = { updatedAt: db.serverDate() };
  if (label !== undefined) updateData.label = label;
  if (min !== undefined) updateData.min = min;
  if (max !== undefined) updateData.max = max;
  if (enabled !== undefined) updateData.enabled = enabled;

  await db.collection('priceRanges').doc(_id).update({ data: updateData });

  await writeLog({
    module: 'priceRange',
    action: 'update',
    targetId: _id,
    targetName: label || '',
    detail: `编辑价格区间「${label || ''}」`,
    operatorId,
    operatorName
  });

  return { code: 0, message: '更新成功' };
}

async function deletePriceRange({ _id, operatorId, operatorName }) {
  if (!_id) return { code: 1001, message: '参数缺失' };

  // 先获取价格区间名称
  const pr = await db.collection('priceRanges').doc(_id).get();

  // 检查是否有关联指南
  const guides = await db.collection('guides').where({ priceRangeId: _id }).get();
  if (guides.data.length > 0) {
    return { code: 1007, message: '该价格区间下有关联指南，无法删除' };
  }

  await db.collection('priceRanges').doc(_id).remove();

  await writeLog({
    module: 'priceRange',
    action: 'delete',
    targetId: _id,
    targetName: pr.data ? pr.data.label : '',
    detail: `删除价格区间「${pr.data ? pr.data.label : ''}」`,
    operatorId,
    operatorName
  });

  return { code: 0, message: '删除成功' };
}

async function listPriceRanges({ enabled } = {}) {
  const where = {};
  if (enabled !== undefined) where.enabled = enabled;

  const res = await db.collection('priceRanges')
    .where(where)
    .orderBy('min', 'asc')
    .get();

  return { code: 0, data: res.data };
}

async function matchPriceRange({ amount }) {
  if (amount === undefined) return { code: 1001, message: '参数缺失' };

  const res = await db.collection('priceRanges')
    .where({
      enabled: true,
      min: db.command.lte(amount),
      max: db.command.gt(amount)
    })
    .get();

  if (res.data.length === 0) {
    return { code: 1003, message: '未匹配到价格区间' };
  }

  return { code: 0, data: res.data[0] };
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
        console.error('[priceRange] 创建集合或写入失败:', e2);
      }
    } else {
      console.error('[priceRange] 日志写入失败:', err);
    }
  }
}
