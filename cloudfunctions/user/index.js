const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'procurement-admin-secret-2026';
const JWT_EXPIRES = 7200; // 2小时

exports.main = async (event, context) => {
  const { action, data } = event;
  const wxContext = cloud.getWXContext();

  try {
    switch (action) {
      case 'userLogin':
        return await userLogin(data, wxContext);
      case 'adminLogin':
        return await adminLogin(data);
      case 'autoLogin':
        return await autoLogin(data, wxContext);
      case 'updateSubscription':
        return await updateSubscription(data, wxContext);
      case 'getUserInfo':
        return await getUserInfo(data);
      case 'updateUser':
        return await updateUser(data);
      case 'deleteUser':
        return await deleteUser(data);
      case 'createUser':
        return await createUser(data);
      case 'changePassword':
        return await changePassword(data);
      default:
        return { code: -1, message: '未知操作' };
    }
  } catch (err) {
    console.error('[user] 错误:', err);
    return { code: 500, message: '服务器内部错误' };
  }
};

// 普通用户登录
async function userLogin({ name, phone }, wxContext) {
  if (!name || !phone) {
    return { code: 1001, message: '参数缺失' };
  }

  const res = await db.collection('users')
    .where({ name, phone, role: 'user', status: 'active' })
    .get();

  if (res.data.length === 0) {
    return { code: 1002, message: '您不在授权名单中，请联系管理员' };
  }

  const user = res.data[0];

  // 绑定 openId
  if (wxContext.OPENID && user.openId !== wxContext.OPENID) {
    await db.collection('users').doc(user._id).update({
      data: { openId: wxContext.OPENID, lastLoginAt: db.serverDate() }
    });
  } else {
    await db.collection('users').doc(user._id).update({
      data: { lastLoginAt: db.serverDate() }
    });
  }

  const token = jwt.sign(
    { userId: user._id, role: 'user', name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  return {
    code: 0,
    data: {
      userId: user._id,
      name: user.name,
      phone: user.phone,
      token,
      expiresIn: JWT_EXPIRES
    }
  };
}

// 管理员登录
async function adminLogin({ username, password }) {
  if (!username || !password) {
    return { code: 1001, message: '参数缺失' };
  }

  const res = await db.collection('users')
    .where({ name: username, role: 'admin' })
    .get();

  if (res.data.length === 0) {
    return { code: 1005, message: '账号或密码错误' };
  }

  const admin = res.data[0];

  // 验证密码
  if (!bcrypt.compareSync(password, admin.password)) {
    return { code: 1005, message: '账号或密码错误' };
  }

  await db.collection('users').doc(admin._id).update({
    data: { lastLoginAt: db.serverDate() }
  });

  const token = jwt.sign(
    { userId: admin._id, role: 'admin', name: admin.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  return {
    code: 0,
    data: {
      userId: admin._id,
      username: admin.name,
      token,
      expiresIn: JWT_EXPIRES
    }
  };
}

// 自动登录（通过 openId 静默登录）
async function autoLogin(_data, wxContext) {
  const { OPENID } = wxContext;
  if (!OPENID) {
    return { code: 1003, message: '无法获取微信身份' };
  }

  const res = await db.collection('users')
    .where({ openId: OPENID, role: 'user', status: 'active' })
    .get();

  if (res.data.length === 0) {
    return { code: 1002, message: '未找到登录信息，请手动登录' };
  }

  const user = res.data[0];

  await db.collection('users').doc(user._id).update({
    data: { lastLoginAt: db.serverDate() }
  });

  const token = jwt.sign(
    { userId: user._id, role: 'user', name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  return {
    code: 0,
    data: {
      userId: user._id,
      name: user.name,
      phone: user.phone,
      token,
      expiresIn: JWT_EXPIRES
    }
  };
}

// 更新用户订阅设置
async function updateSubscription({ templates }, wxContext) {
  const { OPENID } = wxContext;
  if (!OPENID) {
    return { code: 1003, message: '无法获取微信身份' };
  }

  const res = await db.collection('users')
    .where({ openId: OPENID })
    .get();

  if (res.data.length === 0) {
    return { code: 1002, message: '用户不存在' };
  }

  const user = res.data[0];
  const validTypes = ['announcement', 'guide_update'];
  const sanitized = Array.isArray(templates)
    ? templates.filter(t => validTypes.includes(t))
    : [];

  await db.collection('users').doc(user._id).update({
    data: {
      subscribedTemplates: sanitized,
      updatedAt: db.serverDate()
    }
  });

  return {
    code: 0,
    data: { subscribedTemplates: sanitized }
  };
}

// 获取用户信息（根据 token）
async function getUserInfo(data) {
  if (!data || !data.userId) return { code: 1001, message: '参数缺失' };
  const { userId } = data;

  const res = await db.collection('users').doc(userId).get();
  if (!res.data) {
    return { code: 1002, message: '用户不存在' };
  }

  const { name, phone, role } = res.data;
  return { code: 0, data: { userId, name, phone, role } };
}

// 管理员编辑用户（仅限普通用户）
async function updateUser(data) {
  const { _id, name, phone, status, operatorId, operatorName } = data;
  if (!_id) {
    return { code: 1001, message: '参数缺失（_id）' };
  }

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (phone !== undefined) {
    if (!/^1\d{10}$/.test(phone)) {
      return { code: 1001, message: '手机号格式错误' };
    }
    // 检查手机号是否被其他用户占用
    const exist = await db.collection('users').where({ phone }).get();
    const conflict = exist.data.find(u => u._id !== _id);
    if (conflict) {
      return { code: 1006, message: '手机号已被其他用户使用' };
    }
    updateData.phone = phone;
  }
  if (status !== undefined) {
    if (!['active', 'disabled'].includes(status)) {
      return { code: 1001, message: '状态值无效' };
    }
    updateData.status = status;
  }
  updateData.updatedAt = db.serverDate();

  await db.collection('users').doc(_id).update({ data: updateData });

  const targetName = name || '';
  await writeLog({
    module: 'user',
    action: 'update',
    targetId: _id,
    targetName,
    detail: `编辑用户「${targetName}」`,
    operatorId,
    operatorName
  });

  return { code: 0, data: { _id, ...updateData } };
}

// 管理员删除用户
async function deleteUser(data) {
  const { _id, operatorId, operatorName } = data;
  if (!_id) {
    return { code: 1001, message: '参数缺失（_id）' };
  }

  const res = await db.collection('users').doc(_id).get();
  if (!res.data) {
    return { code: 1002, message: '用户不存在' };
  }
  if (res.data.role === 'admin') {
    return { code: 1005, message: '不能删除管理员账号' };
  }

  const targetName = res.data.name;
  await db.collection('users').doc(_id).remove();

  await writeLog({
    module: 'user',
    action: 'delete',
    targetId: _id,
    targetName,
    detail: `删除用户「${targetName}」`,
    operatorId,
    operatorName
  });

  return { code: 0, data: { _id } };
}

async function createUser({ name, phone, status, operatorId, operatorName }) {
  if (!name || !phone) {
    return { code: 1001, message: '参数缺失' };
  }
  if (!/^1\d{10}$/.test(phone)) {
    return { code: 1001, message: '手机号格式错误' };
  }

  const exist = await db.collection('users').where({ phone }).get();
  if (exist.data.length > 0) {
    return { code: 1006, message: '手机号已被其他用户使用' };
  }

  const res = await db.collection('users').add({
    data: {
      name: name.trim(),
      phone: phone.trim(),
      role: 'user',
      status: status || 'active',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });

  await writeLog({
    module: 'user',
    action: 'create',
    targetId: res._id,
    targetName: name.trim(),
    detail: `新增用户「${name.trim()}」`,
    operatorId,
    operatorName
  });

  return { code: 0, data: { _id: res._id, name, phone, status: status || 'active' } };
}

// 管理员修改自己的密码
async function changePassword(data) {
  const { newPassword, operatorId, operatorName } = data;
  if (!newPassword || newPassword.length < 6) {
    return { code: 1001, message: '密码长度不能小于6位' };
  }
  if (!operatorId) {
    return { code: 1001, message: '参数缺失（operatorId）' };
  }

  // 查找管理员用户
  const res = await db.collection('users').doc(operatorId).get();
  if (!res.data) {
    return { code: 1002, message: '用户不存在' };
  }
  if (res.data.role !== 'admin') {
    return { code: 1005, message: '仅管理员可修改密码' };
  }

  // 加密新密码并更新
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(newPassword, salt);
  await db.collection('users').doc(operatorId).update({
    data: { password: hash, updatedAt: db.serverDate() }
  });

  // 审计日志
  await writeLog({
    module: 'user',
    action: 'changePassword',
    targetId: operatorId,
    targetName: operatorName || res.data.name,
    detail: `管理员「${operatorName || res.data.name}」修改了自己的密码`,
    operatorId,
    operatorName
  });

  return { code: 0, data: { message: '密码修改成功' } };
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
        console.error('[user] 创建集合或写入失败:', e2);
      }
    } else {
      console.error('[user] 日志写入失败:', err);
    }
  }
}
