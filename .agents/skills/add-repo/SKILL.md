---
name: add-repo
description: 把 git 仓库登记到某个入口的 AGENTS.md，只写指针，不 clone。用户给出一个或多个 git 地址并要求添加、登记、接入到某个入口时使用。
---

# 添加仓库

Home Repo 模式（见 `docs/the-home-repo-pattern.md`）：入口的 `AGENTS.md` 只放每个仓库的导航指针，agent 用到时才 clone。本技能只登记指针，不 clone、不创建 `repos/` 目录。

## 输入

- 仓库 remote 地址（一个或多个）。
- 目标入口：仓库根目录下含 `AGENTS.md` 的子目录。用户没说明每个仓库去哪个入口时，列出现有入口并询问。

## 步骤

1. 读目标入口的 `AGENTS.md`，找到 `## 仓库` 一节。
2. 对每个 remote：
   - `<repo-owner>` 取地址中的 owner，`<repo-name>` 去掉 `.git`；本地路径为 `repos/<repo-owner>/<repo-name>`。
   - 已登记同一 remote 的，跳过并告知用户。
   - 用 `gh api repos/<owner>/<name> --jq .description` 取说明，用 `gh api repos/<owner>/<name>/contents/AGENTS.md` 判断仓库是否自带 `AGENTS.md`。`gh` 不可用或无权限时，说明凭 remote 名称与用户描述填写，hint 省略，并告知用户。
3. 在该节已有条目之后、下一个 `##` 标题之前追加指针，每个仓库一行：

   ```markdown
   - <name> (<what it is>): repos/<owner>/<name>. Clone from <remote> if missing.
   ```

   - `<what it is>` 一句话：用途加技术栈。
   - 仓库自带 `AGENTS.md` 时，行尾追加 ` Read its AGENTS.md first.`
   - 保留文件里的示例代码块，不替换、不删除。
4. 超过约 20 个仓库时，改为每个领域一个文件，入口 `AGENTS.md` 指向这些文件；先与用户确认。

## 完成标准

- 每个给定 remote 要么新增了一行指针，要么已说明因重复而跳过。
- `git diff` 只涉及目标入口的 `AGENTS.md`。
- 入口目录下没有新增 `repos/`；若已存在 clone，保持原样。
- 向用户汇报新增的条目和未能确认的 hint。
