// Which URLs the workspace may load: dcinside + old.reddit (www/bare reddit only for the login flow).
const RD_HOME = 'https://old.reddit.com/r/pathofexile/';
const LOGIN = /^\/(login|account\/|svc\/shreddit\/)/;
const isWww = (h) => h === 'www.reddit.com' || h === 'reddit.com';
const isRedditAlias = (h) => isWww(h) || /^(np|new|m|sh)\.reddit\.com$/.test(h);

function parse(url) {
  try { const u = new URL(url); return u.protocol === 'https:' ? u : null; } catch (_) { return null; }
}

function toOldReddit(url) {
  const u = parse(url);
  if (!u || !isRedditAlias(u.hostname) || (isWww(u.hostname) && LOGIN.test(u.pathname))) return url;
  u.hostname = 'old.reddit.com';
  return u.href;
}

// Old posts link plain-http dc URLs; load them over https (parse() only accepts https).
const upgradeDc = (url) => url.replace(/^http:(\/\/(?:[\w-]+\.)*dcinside\.com(?:[/?#:]|$))/i, 'https:$1');
const normalize = (url) => toOldReddit(upgradeDc(url));

function isAllowed(url) {
  const u = parse(toOldReddit(url));
  if (!u) return false;
  const h = u.hostname;
  if (h === 'dcinside.com' || h.endsWith('.dcinside.com') || h.endsWith('.dcinside.co.kr') || h === 'old.reddit.com') return true;
  return isWww(h); // only login paths survive toOldReddit
}

module.exports = { isAllowed, toOldReddit, normalize, RD_HOME };
