# 预缴保费：实际一次性应交金额

在本地运行：

```bash
npm install
npm run dev
```

浏览器打开终端里提示的地址即可。

## 计算规则（与需求一致）

- 名义总保费 `T`，分 `n` 年等额缴，每期 `P = T/n`。
- 客户实缴一次性 `X`；第 0 时刻先扣 `P`，账户余额按第 1 个年利率滚存一年后再扣 `P`，重复至第 `n−1` 年。
- 共输入 **`n−1` 个**年利率（第 1 个计息年度到第 `n−1` 个）。
- 约束：第 `n−1` 年末扣完当期 `P` 后，账户余额 **恰好等于** `P`（最后一期由账户支付）。

由此从末态倒推 `X`，并在界面中给出逐年验算。

## 构建静态文件

```bash
npm run build
```

产物在 `dist/`，可部署到任意静态站点。

## 部署到 GitHub Pages（远程访问）

1. 在 GitHub 上新建仓库，把本目录推送到该仓库（默认分支为 `main` 或 `master` 均可）。
2. 打开仓库 **Settings → Pages**。
3. **Build and deployment** 里 **Source** 选择 **GitHub Actions**（不要选「Deploy from a branch」的旧方式，否则不会跑本工作流）。
4. 在 **Actions** 里确认工作流 **Deploy GitHub Pages** 已成功执行；完成后 **Settings → Pages** 顶部会显示站点地址，一般为：
   - `https://<你的用户名>.github.io/<仓库名>/`

之后每次推送到 `main` 或 `master`，都会自动重新构建并更新线上页面。

生产构建已配置为 **相对资源路径**（`vite` 的 `base: './'`），子路径部署无需再改仓库名。

### 若 Actions 里构建失败

- 确认仓库根目录即为本项目（含 `package.json`、`index.html`）。
- 在 **Actions** 中点开失败的任务查看日志。
