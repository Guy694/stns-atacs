/** "5 นาทีที่แล้ว" แบบสั้น ใช้ nowMs จากเซิร์ฟเวอร์เพื่อให้ผลตรงกันทั้งตอน render ฝั่งเซิร์ฟเวอร์และเบราว์เซอร์ */
export function formatRelativeThai(value: string | null | undefined, nowMs: number) {
  if (!value) return "-";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "-";
  const seconds = Math.round((nowMs - time) / 1000);
  if (seconds < 60) return seconds < -60 ? "ในอนาคต" : "เมื่อสักครู่";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} วันที่แล้ว`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} เดือนที่แล้ว`;
  return `${Math.floor(days / 365)} ปีที่แล้ว`;
}
