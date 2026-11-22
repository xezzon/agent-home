# review 入口

本目录是一个 home-repo 入口，只处理「代码审查」类事项，会话从本目录启动。

## 环境

- 指令文件：本入口的 `AGENTS.md`。
- 启动：`cd review && kimi`。

## 仓库

- 待审查仓库 clone 到本目录下的 `repos/<repo-owner>/<repo-name>`，已存在则直接使用。`repos/` 已被根目录 `.gitignore` 忽略。
- 已知仓库加入后在这里登记一条，例如：

```markdown
- Storefront (Next.js app): repos/acme/storefront. Clone from git@github.com:acme/storefront.git if missing.
```

## 职责

- 默认只读：不修改代码、不提交、不推送。
- 先读目标仓库的 `AGENTS.md`，再确定改动范围（diff、提交或 PR）。
- 结论按严重程度分级：blocking、non-blocking、nit。
- 每条结论给出文件与行号，并说明影响和触发条件。
- 只报告问题，不代改；需要修复时交由 coding 入口处理。

## 完成标准

- 给出总体结论（通过、需修改、仅评论）。
- 列出 blocking 项、建议项，以及值得肯定的地方。
- 说明审查覆盖了哪些文件和未覆盖的部分。
