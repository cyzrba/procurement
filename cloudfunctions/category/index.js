const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { action, data } = event;

  try {
    switch (action) {
      case 'create':
        return await createCategory(data);
      case 'update':
        return await updateCategory(data);
      case 'delete':
        return await deleteCategory(data);
      case 'list':
        return await listCategories(data);
      default:
        return { code: -1, message: '未知操作' };
    }
  } catch (err) {
    console.error('[category] 错误:', err);
    return { code: 500, message: '服务器内部错误' };
  }
};

async function createCategory({ name, description, operatorId, operatorName }) {
  if (!name) return { code: 1001, message: '类目名称必填' };

  // 检查是否已存在
  const exist = await db.collection('categories').where({ name }).get();
  if (exist.data.length > 0) {
    return { code: 1006, message: '类目名称已存在' };
  }

  const res = await db.collection('categories').add({
    data: {
      name,
      description: description || '',
      status: 'active',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });

  await writeLog({
    module: 'category',
    action: 'create',
    targetId: res._id,
    targetName: name,
    detail: `新增类目「${name}」`,
    operatorId,
    operatorName
  });

  return { code: 0, data: { _id: res._id } };
}

async function updateCategory({ _id, name, description, operatorId, operatorName }) {
  if (!_id) return { code: 1001, message: '参数缺失' };

  const updateData = { updatedAt: db.serverDate() };
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;

  await db.collection('categories').doc(_id).update({ data: updateData });

  const targetName = name || '';
  await writeLog({
    module: 'category',
    action: 'update',
    targetId: _id,
    targetName,
    detail: `编辑类目「${targetName}」`,
    operatorId,
    operatorName
  });

  return { code: 0, message: '更新成功' };
}

async function deleteCategory({ _id, operatorId, operatorName }) {
  if (!_id) return { code: 1001, message: '参数缺失' };

  // 先获取类目名称
  const cat = await db.collection('categories').doc(_id).get();

  // 检查是否有关联指南
  const guides = await db.collection('guides').where({ categoryId: _id }).get();
  if (guides.data.length > 0) {
    return { code: 1007, message: '该类目下有关联指南，无法删除' };
  }

  await db.collection('categories').doc(_id).remove();

  await writeLog({
    module: 'category',
    action: 'delete',
    targetId: _id,
    targetName: cat.data ? cat.data.name : '',
    detail: `删除类目「${cat.data ? cat.data.name : ''}」`,
    operatorId,
    operatorName
  });

  return { code: 0, message: '删除成功' };
}

async function listCategories({ status } = {}) {
  const where = {};
  if (status) where.status = status;

  const res = await db.collection('categories')
    .where(where)
    .get();

  return {
    code: 0,
    data: res.data.map(({ _id, name, description, status }) => ({
      _id, name, description, status
    }))
  };
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
        console.error('[category] 创建集合或写入失败:', e2);
      }
    } else {
      console.error('[category] 日志写入失败:', err);
    }
  }
}
