const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { action, data } = event;

  try {
    switch (action) {
      case 'getTempFileURL':
        return await getTempFileURL(data);
      default:
        return { code: -1, message: '未知操作' };
    }
  } catch (err) {
    console.error('[upload] 错误:', err);
    return { code: 500, message: '服务器内部错误' };
  }
};

async function getTempFileURL({ fileList }) {
  if (!fileList || !Array.isArray(fileList)) {
    return { code: 1001, message: '参数缺失' };
  }

  const res = await cloud.getTempFileURL({ fileList });
  return { code: 0, data: res.fileList };
}
