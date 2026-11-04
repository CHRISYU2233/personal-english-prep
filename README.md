# 个人英语备考工具

选择四级、六级、雅思、托福、多邻国或其他目标，自行生成或导入学习材料。项目处于早期开发，功能和限制如下。

## 目前能做什么

- 制作适用于各考试目标的 AI 生成提示，并粘贴导入 JSON。
- 可选使用个人 OpenRouter 密钥生成材料、请求听读写译文本反馈。
- 词汇自评与简单到期复习；听力使用用户选择的本地音频文件。
- 阅读、写作、翻译草稿自动保存；支持本机备份导出与恢复。

AI 材料不代表官方题目、评分或考试建议，应自行核对。此项目不是任何考试机构的官方产品。不提供原版真题、听力录音、官方评分、多设备云同步或原文内批注。多邻国英语测试与 Duolingo 的商标属于其各自权利人。

## 快速开始

需要 Python 3 和现代浏览器：

```bash
python -m http.server 5174 --bind 127.0.0.1
```

打开 `http://127.0.0.1:5174/exam-setup.html`。选择考试和目标，复制提示到 AI，再粘贴 JSON；或配置自己的 OpenRouter 密钥和模型并点击生成。浏览器直接打开文件可能无法加载模块。按 Ctrl+C 停止服务。

## 材料格式

```json
{
  "title": "今日学习",
  "plan": ["复习词汇", "阅读练习"],
  "vocabulary": [{"word":"assess","meaning":"评估","example":"We assess results.","translation":"我们评估结果。"}],
  "listening": {"transcript":"A short original transcript.","question":"What is the topic?"},
  "reading": {"passage":"A short original passage.","question":"What is the main idea?"},
  "writing":"Describe a learning habit.",
  "translation":"坚持学习需要耐心。"
}
```

题材必须由你自行提供、原创或具备使用许可；不要未经授权分享考试真题、录音或其他受保护内容。监听材料可选本机音频，本地文件不上传；刷新后需要重新选择。

## AI 与隐私

手动导入无需密钥。OpenRouter 密钥仅留在页面输入框中，不写入项目文件或本地存储；刷新后需要重新输入。仅在可信网站和设备使用并设置额度限制。点击生成或反馈时，考试目标或所选作答会发送给 OpenRouter 及其上游模型供应商，可能收费；模型、处理方式、地区支持与价格以服务商为准。导入资料与草稿保存在浏览器，可通过备份导出迁移。清除浏览器数据会删除未备份的内容；服务端没有用户账号或同步。

## 检查

需要 Node.js：

```bash
node exam-profiles-test.mjs
node training-test.mjs
node ai-client-test.mjs
```

测试覆盖考试选项、导入校验、单词间隔和模拟 AI 请求；不代表在所有手机或真实模型上均已验证。

## 许可

本项目代码采用 MIT 许可证，见 LICENSE。考试名称和商标归其权利人所有。使用者自行负责其导入内容的权利和准确性。
