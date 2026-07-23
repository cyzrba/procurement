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

async function createCategory({ name, description, media, operatorId, operatorName }) {
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
      media: media || [],
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

async function updateCategory({ _id, name, description, media, operatorId, operatorName }) {
  if (!_id) return { code: 1001, message: '参数缺失' };

  // 收集旧文件的 fileId 用于清理
  const oldCat = await db.collection('categories').doc(_id).get();
  const oldMedia = (oldCat.data && oldCat.data.media) || [];
  const oldFileIds = new Set(oldMedia.map(m => m.fileId).filter(Boolean));
  const newMedia = media || [];
  const newFileIds = new Set(newMedia.map(m => m.fileId).filter(Boolean));

  const updateData = { updatedAt: db.serverDate() };
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (media !== undefined) updateData.media = media;

  await db.collection('categories').doc(_id).update({ data: updateData });

  // 清理已删除的云存储文件
  const orphanedFileIds = [...oldFileIds].filter(id => !newFileIds.has(id));
  if (orphanedFileIds.length > 0) {
    try {
      await cloud.deleteFile({ fileList: orphanedFileIds });
    } catch (err) {
      console.error('[category] 清理文件失败:', err);
    }
  }

  const targetName = name || (oldCat.data ? oldCat.data.name : '');
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

  // 先获取类目信息
  const cat = await db.collection('categories').doc(_id).get();

  // 检查是否有关联指南
  const guides = await db.collection('guides').where({ categoryId: _id }).get();
  if (guides.data.length > 0) {
    return { code: 1007, message: '该类目下有关联指南，无法删除' };
  }

  // 清理关联的云存储文件
  const media = (cat.data && cat.data.media) || [];
  const fileIds = media.map(m => m.fileId).filter(Boolean);
  if (fileIds.length > 0) {
    try {
      await cloud.deleteFile({ fileList: fileIds });
    } catch (err) {
      console.error('[category] 删除类目时清理文件失败:', err);
    }
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
    data: res.data.map(({ _id, name, description, status, media }) => ({
      _id, name, description, status, media: media || []
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
