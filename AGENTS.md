# Agent Home

本仓库是 home-repo 的管理仓库：集中维护按职责划分的入口，以及各入口的指令文件和导航指针。业务代码不写在这里，代码仓库 clone 到入口目录下使用。

## 入口

| 入口 | 处理事项 |
| --- | --- |
| `coding/` | 功能实现、缺陷修复 |
| `review/` | 代码审查，只读 |

**入口即独立 Home Repo。** 这是本仓库对 [Home Repo 模式](docs/the-home-repo-pattern.md) 的有意偏离：标准做法是一个 Home Repo、会话从仓库根目录启动；本仓库按职责拆成多个入口，每个入口各自是一个 Home Repo，持有自己的 `AGENTS.md`、技能和 `repos/`，会话从入口目录启动，并且只加载该入口的配置：

```sh
cd coding
kimi
```

入口的指令文件统一为 `AGENTS.md`。

## 仓库位置

所有 git 仓库默认 clone 到当前入口下的 `repos/<repo-owner>/<repo-name>`：

```
coding/repos/<repo-owner>/<repo-name>
review/repos/<repo-owner>/<repo-name>
```

- `<repo-owner>` 取远端地址中的 owner，`<repo-name>` 去掉 `.git`。
- 目标路径已存在时直接使用；只有缺失时才 clone。
- 不要 clone 到本仓库根目录，也不要跨入口复制或移动仓库。
- `repos/` 已被仓库根目录的 `.gitignore` 忽略，不要提交其中的内容。

## 工作约定

- 先读当前入口的 `AGENTS.md`，再开始操作。
- 各入口的指令与 clone 相互独立；跨入口只读，不改其他入口的配置或 clone。
- 新增跨入口共享的内容时，先征求用户意见；默认不建立共享层。
- `.env` 等密钥文件保持原样：不读取、不复制、不提交。
- 涉及用户偏好或不可逆操作时先确认。

## 参考

- Home Repo 模式原文：[docs/the-home-repo-pattern.md](docs/the-home-repo-pattern.md)
