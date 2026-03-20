const llFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const hmFormatter = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatLL(dateStr: string): string {
  return llFormatter.format(new Date(dateStr));
}

export function formatHM(dateStr: string): string {
  return hmFormatter.format(new Date(dateStr));
}

export function fromNow(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 45) return "数秒前";
  if (minutes < 1) return "1分前";
  if (minutes < 45) return `${minutes}分前`;
  if (hours < 1) return "1時間前";
  if (hours < 22) return `${hours}時間前`;
  if (days < 1) return "1日前";
  if (days < 26) return `${days}日前`;
  if (months < 1) return "1ヶ月前";
  if (months < 12) return `${months}ヶ月前`;
  if (years < 1) return "1年前";
  return `${years}年前`;
}
