export function modelDisplayName(id = '') {
  const match = /^doubao-(seedream|seedance)-(\d+)-(\d+)(?:-(lite|pro|fast|mini))?(?:-|$)/i.exec(id);
  if (match) return `${match[1] === 'seedream' ? 'Seedream' : 'Seedance'} ${match[2]}.${match[3]}${match[4] ? ` ${match[4][0].toUpperCase()}${match[4].slice(1)}` : ''}`;
  return id;
}

export function taskCost(billing) {
  if (billing?.amount === undefined || billing.amount === null) return '';
  const currency = billing.currency || 'CNY';
  return `${currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : `${currency} `}${billing.amount}`;
}

export function statusTone(status) {
  return status === 'failed' ? 'error' : status === 'submission_unknown' || status === 'prepared' ? 'warning' : status === 'succeeded' ? 'success' : status === 'cancelled' ? 'muted' : 'pending';
}
