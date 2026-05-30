/**
 * 通用工具函数
 */

// 金额格式化
const formatAmount = (val) => {
  if (!val && val !== 0) return '';
  return '¥' + Number(val).toLocaleString('zh-CN');
};

// 日期格式化
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  return `${Y}-${M}-${D}`;
};

// 日期时间格式化
const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${Y}-${M}-${D} ${h}:${m}`;
};

// 价格区间标签
const formatPriceLabel = (label) => {
  if (label === 'Infinity') return '以上';
  return label;
};

// 空值占位
const nvl = (val, placeholder = '-') => {
  return (val === null || val === undefined || val === '') ? placeholder : val;
};

module.exports = {
  formatAmount,
  formatDate,
  formatDateTime,
  formatPriceLabel,
  nvl
};
