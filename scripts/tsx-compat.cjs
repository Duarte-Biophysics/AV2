// Node on some locked-down Windows hosts cannot resolve os.userInfo() for tsx.
if (typeof process.geteuid !== "function") {
  process.geteuid = () => process.env.USERNAME || process.env.USER || "greencode";
}
const os = require("node:os");
const systemUserInfo = os.userInfo;
os.userInfo = (...args) => {
  try { return systemUserInfo(...args); }
  catch { return { username: process.env.USERNAME || process.env.USER || "greencode", uid: -1, gid: -1, shell: "", homedir: os.tmpdir() }; }
};
const preload = `--require="${__filename.replaceAll("\\", "/")}"`;
if (!process.env.NODE_OPTIONS?.includes(__filename)) {
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ""} ${preload}`.trim();
}
