# coding 入口

本目录是一个 home-repo 入口，只处理「编码实现」类事项，会话从本目录启动。

## 环境

- 指令文件：本入口的 `AGENTS.md`。
- 启动：`cd coding && kimi`。

## 仓库

- Clone 到本目录下的 `repos/<repo-owner>/<repo-name>`，已存在则直接使用。`repos/` 已被根目录 `.gitignore` 忽略。
- 已知仓库加入后在这里登记一条，例如：

```markdown
- Storefront (Next.js app): repos/acme/storefront. Clone from git@github.com:acme/storefront.git if missing.
```

## 职责

- 实现功能、修复缺陷，并补齐或更新测试。
- 遵循目标仓库自己的 `AGENTS.md`、构建命令和测试命令。
- 不改变与本任务无关的代码，不顺手重构。
- 需要跨仓库改动时，先说明涉及哪些仓库和调用关系。

## 完成标准

- 目标仓库的构建与测试通过。
- 说明改动范围、验证命令，以及未能验证的部分。
