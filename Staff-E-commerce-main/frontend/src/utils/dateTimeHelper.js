/**
 * Helper functions for consistent timezone handling across the application.
 * All dates from API are in UTC. Use these methods to convert for display/comparison.
 * Vietnam timezone is UTC+7.
 */

const vietnamParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

/**
 * Convert UTC date to Vietnam time
 * The API sends UTC instants ("...Z"). The returned Date's local getters (getDate/getHours...) show the
 * Vietnamese wall-clock time, whatever time zone the browser itself is in. Adding 7 hours by hand gave the
 * wrong day on machines already set to Vietnam time.
 * @param {string|Date} utcDate - UTC date string or Date object
 * @returns {Date} Date in Vietnam timezone
 */
export const toVietnamTime = (utcDate) => {
  if (!utcDate) return null;
  const date = new Date(utcDate);
  if (Number.isNaN(date.getTime())) return null;
  const part = Object.fromEntries(vietnamParts.formatToParts(date).map(({ type, value }) => [type, Number(value)]));
  return new Date(part.year, part.month - 1, part.day, part.hour, part.minute, part.second);
};

/**
 * Get current Vietnam date (date only, for comparisons)
 * @returns {Date} Current date in Vietnam timezone (time set to 00:00:00)
 */
export const getVietnamToday = () => {
  const vnNow = toVietnamTime(new Date());
  return new Date(vnNow.getFullYear(), vnNow.getMonth(), vnNow.getDate());
};

/**
 * Format UTC datetime for display in Vietnam timezone
 * @param {string|Date} utcDate - UTC date string or Date object
 * @param {string} format - 'date' | 'datetime' | 'time'
 * @returns {string} Formatted date string
 */
export const formatVietnam = (utcDate, format = 'date') => {
  if (!utcDate) return 'N/A';
  
  const vnDate = toVietnamTime(utcDate);
  
  const day = String(vnDate.getDate()).padStart(2, '0');
  const month = String(vnDate.getMonth() + 1).padStart(2, '0');
  const year = vnDate.getFullYear();
  const hours = String(vnDate.getHours()).padStart(2, '0');
  const minutes = String(vnDate.getMinutes()).padStart(2, '0');
  
  switch (format) {
    case 'datetime':
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    case 'time':
      return `${hours}:${minutes}`;
    default:
      return `${day}/${month}/${year}`;
  }
};

/**
 * Check if a UTC date is in the past (compared to Vietnam today)
 * @param {string|Date} utcEndDate - UTC end date
 * @returns {boolean}
 */
export const isExpired = (utcEndDate) => {
  if (!utcEndDate) return false;
  const vnEndDate = toVietnamTime(utcEndDate);
  const vnToday = getVietnamToday();
  return vnEndDate.setHours(0, 0, 0, 0) < vnToday.getTime();
};

/**
 * Check if a UTC date is in the future (compared to Vietnam today)
 * @param {string|Date} utcStartDate - UTC start date
 * @returns {boolean}
 */
export const isScheduled = (utcStartDate) => {
  if (!utcStartDate) return false;
  const vnStartDate = toVietnamTime(utcStartDate);
  const vnToday = getVietnamToday();
  return vnStartDate.setHours(0, 0, 0, 0) > vnToday.getTime();
};

/**
 * Check if current Vietnam date is within the date range (inclusive)
 * @param {string|Date} utcStartDate - UTC start date
 * @param {string|Date} utcEndDate - UTC end date
 * @returns {boolean}
 */
export const isWithinRange = (utcStartDate, utcEndDate) => {
  const vnToday = getVietnamToday();
  
  const startOk = !utcStartDate || toVietnamTime(utcStartDate).setHours(0, 0, 0, 0) <= vnToday.getTime();
  const endOk = !utcEndDate || toVietnamTime(utcEndDate).setHours(0, 0, 0, 0) >= vnToday.getTime();
  
  return startOk && endOk;
};

/**
 * Get promotion status based on its properties
 * @param {Object} promotion - Promotion object returned by the API
 * @returns {Object} { status: string, label: string, color: string }
 */
export const getPromotionStatus = (promotion) => {
  if (!promotion?.active) {
    return { status: 'inactive', label: 'Không hoạt động', color: 'gray' };
  }
  
  if (isExpired(promotion.endDate)) {
    return { status: 'expired', label: 'Hết hạn', color: 'red' };
  }
  
  if (isScheduled(promotion.startDate)) {
    return { status: 'scheduled', label: 'Chưa bắt đầu', color: 'yellow' };
  }
  
  if (promotion.usageLimit && promotion.usedCount >= promotion.usageLimit) {
    return { status: 'exhausted', label: 'Hết lượt', color: 'orange' };
  }
  
  return { status: 'active', label: 'Đang hoạt động', color: 'green' };
};

export default {
  toVietnamTime,
  getVietnamToday,
  formatVietnam,
  isExpired,
  isScheduled,
  isWithinRange,
  getPromotionStatus,
};
