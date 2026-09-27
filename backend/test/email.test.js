const assert = require("node:assert/strict");
const test = require("node:test");
const { buildFrontendUrl } = require("../src/email");

test("builds account links on the current trusted HTTPS origin", () => {
  assert.equal(
    buildFrontendUrl("/verify?token=abc", "https://chanonim.web.id").href,
    "https://chanonim.web.id/verify?token=abc",
  );
});

test("rejects origins that are not canonical HTTPS origins", () => {
  for (const origin of ["", "http://chanonim.web.id", "https://evil.example/path", "https://evil.example?next=x"]) {
    assert.throws(() => buildFrontendUrl("/verify?token=abc", origin));
  }
});
