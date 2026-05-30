/**
 * 微信订阅消息模板配置
 *
 * 模板ID 需在微信公众平台后台 (mp.weixin.qq.com) → 功能 → 订阅消息 中创建并获取
 * 创建模板后, 将模板ID 替换下方占位值
 *
 * 每个模板至少需要 2 个关键字: thing1 (消息标题), thing2 (通知内容)
 */
const SUBSCRIPTION_TEMPLATES = {
  announcement: {
    templateId: 'z4zC7BCDVfmk-Dvk0UbYkOdFRK6kVkJ4L4qYiNrYTAc',
    keywords: ['thing2', 'time3']
  },
  guide_update: {
    templateId: 'z4zC7BCDVfmk-Dvk0UbYkOdFRK6kVkJ4L4qYiNrYTAc',
    keywords: ['thing2', 'time3']
  }
};

module.exports = { SUBSCRIPTION_TEMPLATES };
