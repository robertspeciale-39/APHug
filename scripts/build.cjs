const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const modules = process.env.TRIVIA_NODE_MODULES || path.join(root, "node_modules");
const esbuild = require(path.join(modules, "esbuild"));

esbuild.buildSync({
  absWorkingDir: root,
  entryPoints: ["src/app.tsx"],
  outfile: "app.js",
  nodePaths: [modules],
  bundle: true,
  format: "iife",
  target: "chrome120",
  define: { "process.env.NODE_ENV": '"production"' },
  minify: true,
  legalComments: "inline",
});
const encoded = fs.readFileSync(path.join(root, "assets/music.ogg")).toString("base64");
fs.writeFileSync(path.join(root, "assets/music-data.js"), `window.musicData = "${encoded}";\n`);
