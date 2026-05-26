import { defineConfig } from "vite";

/**
 * 生产构建使用相对路径，便于部署到 GitHub Pages
 *（例如 username.github.io 下的项目子路径），无需写死仓库名。
 */
export default defineConfig(({ command }) => ({
  root: ".",
  publicDir: "public",
  base: command === "build" ? "./" : "/",
}));
