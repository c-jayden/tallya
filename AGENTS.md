用户偏好：
- 当用户要求“提交代码”时，默认提交当前项目里的所有改动文件。
- 提交信息先参考对应项目既有提交信息格式；用户偏好简短提交信息，不写详细正文，除非用户明确要求。
- 提交代码时按照当前项目之前的提交信息格式来提交。

项目规则：
- 不要运行 `pnpm tauri dev`。

UI 约束：
- 所有可点击元素必须有 `cursor-pointer`，disabled 状态使用 `cursor-not-allowed`。
- Tailwind 4 能用 canonical class 的地方优先不用任意 px class。

验证约束：
- 不启动新的 dev server；如需查看网页或做浏览器验证，访问用户已运行的 `http://localhost:1420`。
- 常规验证只运行 `cargo check`、前端 lint 和 type-check。
- 修改前端逻辑后至少跑 type-check 和 lint。
