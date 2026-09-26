export const formatCurrency = (value) => {
  try {
    if (value == null || isNaN(value)) return '0đ';
    return new Intl.NumberFormat('vi-VN').format(Number(value)) + 'đ';
  } catch {
    return `${value}`;
  }
};
