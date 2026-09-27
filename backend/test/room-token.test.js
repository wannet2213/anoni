const assert = require("node:assert/strict");
const test = require("node:test");
process.env.JWT_SECRET = "test-secret";
const { signRoomToken, verifyRoomToken } = require("../src/middleware/auth");

test("a room token is accepted only for the room it was issued for", () => {
  const token = signRoomToken("room-a");
  assert.equal(verifyRoomToken(token, "room-a"), true);
  assert.equal(verifyRoomToken(token, "room-b"), false);
});

test("missing, tampered or non-room tokens are rejected", () => {
  const token = signRoomToken("room-a");
  assert.equal(verifyRoomToken(undefined, "room-a"), false);
  assert.equal(verifyRoomToken("", "room-a"), false);
  assert.equal(verifyRoomToken(token.slice(0, -3) + "abc", "room-a"), false);
  assert.equal(verifyRoomToken(token, undefined), false);
});
