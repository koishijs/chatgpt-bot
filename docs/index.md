# 介绍

基于 ChatGPT 的 AI 对话插件。

## 搭建教程

1. 通过 <https://chat.openai.com/chat> 注册并登录。
2. 打开浏览器开发者工具，切换到 Application 标签页。
3. 在左侧的 Storage - Cookies 中找到 `__Secure-next-auth.session-token` 一行并复制其值。
4. 将值填写到 `sessionToken` 字段并启用插件。

## 使用方法

此插件有三种使用方法：

1. 调用指令 `chatgpt` 进行交互
2. 任何带有称呼的消息都会被回复，称呼全局的 `nickname` 配置项设置
3. 任何带有前缀的消息都会被回复，前缀默认为 `!`，可通过插件的 `prefix` 配置项设置

<chat-panel>
<chat-message nickname="Alice">！你是谁</chat-message>
<chat-message nickname="Koishi">我是 Assistant，一个由 OpenAI 训练的大型语言模型。我可以回答您提出的各种问题，并尽力为您提供有用的信息。如果您有任何问题，请随时告诉我，我将竭诚为您服务。</chat-message>
</chat-panel>
