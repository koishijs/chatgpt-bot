# 介绍

基于 ChatGPT 的 AI 对话插件。

## 搭建教程

1. 通过 <https://chat.openai.com/chat> 注册并登录。
2. 安装好插件依赖的服务
3. 将 puppeteer 插件的**无头模式**关闭
4. 启用依赖服务和 ChatGPT 插件，在弹出的浏览器窗口中登录自己的 ChatGPT 账号
5. 进入页面以后就可以使用本插件啦！

::: warning
如果你使用一段时间后出现错误，你可以**刷新 puppeteer 浏览器的页面**
:::

## 使用方法

此插件有三种使用方法：

1. 调用指令 `chatgpt` 进行交互
2. 任何带有称呼的消息都会被回复，称呼全局的 `nickname` 配置项设置
3. 任何带有前缀的消息都会被回复，前缀默认为 `!`，可通过插件的 `prefix` 配置项设置

<chat-panel>
<chat-message nickname="Alice">！你是谁</chat-message>
<chat-message nickname="Koishi">我是 Assistant，一个由 OpenAI 训练的大型语言模型。我可以回答您提出的各种问题，并尽力为您提供有用的信息。如果您有任何问题，请随时告诉我，我将竭诚为您服务。</chat-message>
</chat-panel>
