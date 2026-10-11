/** ReqGen v4 — passcode rules, shared by the browser (instant hint) and the server (the check that counts). */

const COMMON = new Set([
  "000000", "111111", "222222", "333333", "444444", "555555", "666666", "777777", "888888", "999999",
  "123456", "654321", "112233", "121212", "123123", "696969", "159753", "147258", "789456", "102030",
  "101010", "007007", "520520", "131313", "123321", "456789", "987654", "111222", "998877", "100200",
]);

export function easyPasscode(code: string) {
  if (!/^\d{6}$/.test(code)) return "Use exactly six digits.";
  if (COMMON.has(code)) return "That passcode is too easy to guess. Choose another.";
  const d = code.split("").map(Number);
  const up = d.every((v, i) => i === 0 || v === (d[i - 1] + 1) % 10);
  const down = d.every((v, i) => i === 0 || v === (d[i - 1] + 9) % 10);
  if (up || down) return "Numbers in a row are too easy to guess. Choose another.";
  if (code.slice(0, 2).repeat(3) === code || code.slice(0, 3).repeat(2) === code) return "Repeating patterns are too easy to guess. Choose another.";
  if (new Set(d).size <= 2) return "Use at least three different digits.";
  return null;
}

