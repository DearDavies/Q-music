// 使用设备本地时间；07:00 起日间，19:00 起夜间。
export const isNightTime = (date = new Date()): boolean => date.getHours() < 7 || date.getHours() >= 19
