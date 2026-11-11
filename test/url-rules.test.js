const test = require('node:test'); const assert = require('node:assert');
const { isAllowed, toOldReddit, normalize } = require('../url-rules');
test('allowed hosts', () => {
  assert.ok(isAllowed('https://gall.dcinside.com/board/lists/?id=x'));
  assert.ok(isAllowed('https://sign.dcinside.com/login'));
  assert.ok(isAllowed('https://old.reddit.com/r/pathofexile/'));
  assert.ok(isAllowed('https://www.reddit.com/login/?dest=x'));
  assert.ok(isAllowed('https://www.reddit.com/account/login'));
  assert.ok(isAllowed('https://www.reddit.com/svc/shreddit/x'));
  assert.ok(!isAllowed('https://www.pathofexile.com/forum'));
  assert.ok(!isAllowed('https://youtu.be/abc'));
  assert.ok(!isAllowed('https://evil.com/?u=gall.dcinside.com'));
  assert.ok(!isAllowed('https://dcinside.com.evil.com/'));
  assert.ok(!isAllowed('javascript:alert(1)'));
  assert.ok(!isAllowed('http://gall.dcinside.com/'));
  assert.ok(!isAllowed('not a url'));
});
test('www → old', () => {
  assert.equal(toOldReddit('https://www.reddit.com/r/pathofexile/comments/1xt2edm/x/?sort=new'),
    'https://old.reddit.com/r/pathofexile/comments/1xt2edm/x/?sort=new');
  assert.equal(toOldReddit('https://reddit.com/r/pathofexile/'), 'https://old.reddit.com/r/pathofexile/');
  assert.equal(toOldReddit('https://www.reddit.com/r/x/#c'), 'https://old.reddit.com/r/x/#c');
  assert.equal(toOldReddit('https://www.reddit.com/login/'), 'https://www.reddit.com/login/');
  assert.equal(toOldReddit('https://gall.dcinside.com/'), 'https://gall.dcinside.com/');
});
test('http dc upgrade, dc cdn, reddit aliases', () => {
  assert.equal(normalize('http://gall.dcinside.com/x'), 'https://gall.dcinside.com/x');
  assert.ok(isAllowed(normalize('http://gall.dcinside.com/x')));
  assert.equal(normalize('http://evil.com/?u=http://gall.dcinside.com/'), 'http://evil.com/?u=http://gall.dcinside.com/');
  assert.ok(isAllowed('https://image.dcinside.co.kr/x.jpg'));
  assert.ok(!isAllowed('https://dcinside.co.kr.evil.com/'));
  for (const h of ['np', 'new', 'm', 'sh']) assert.equal(toOldReddit('https://' + h + '.reddit.com/r/x/'), 'https://old.reddit.com/r/x/');
  assert.equal(toOldReddit('https://np.reddit.com/login'), 'https://old.reddit.com/login');
});
