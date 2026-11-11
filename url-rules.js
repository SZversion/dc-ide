// Which URLs the workspace may load: dcinside + old.reddit (www/bare reddit only for the login flow).
const RD_HOME = 'https://old.reddit.com/r/pathofexile/';
const LOGIN = /^\/(login|account\/|svc\/shreddit\/)/;
const isWww = (h) => h === 'www.reddit.com' || h === 'reddit.com';

function parse(url) {
  try { const u = new URL(url); return u.protocol === 'https:' ? u : null; } catch (_) { return null; }
}

function toOldReddit(url) {
  const u = parse(url);
  if (!u || !isWww(u.hostname) || LOGIN.test(u.pathname)) return url;
  u.hostname = 'old.reddit.com';
  return u.href;
}

function isAllowed(url) {
  const u = parse(toOldReddit(url));
  if (!u) return false;
  const h = u.hostname;
  if (h === 'dcinside.com' || h.endsWith('.dcinside.com') || h === 'old.reddit.com') return true;
  return isWww(h); // only login paths survive toOldReddit
}

module.exports = { isAllowed, toOldReddit, RD_HOME };
