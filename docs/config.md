# 配置项

## 登录设置

### sessionToken

- 类型：`string`
- 必选项

ChatGPT 会话令牌。

### cloudflareToken

- 类型：`string`
- 必选项

Cloudflare 会话令牌。

### endpoint

- 类型：`string`
- 默认值：`https://chat.openai.com/`

ChatGPT API 的地址。

### headers

- 类型：`Dict<string>`

要附加的额外请求头。

### proxyAgent

- 类型：`string`

使用的代理服务器地址。

### markdown

- 类型：`boolean`
- 默认值：`false`

是否以 Markdown 格式回复。

## 基础设置

### appellation

- 类型：`boolean`
- 默认值：`true`

是否自动回复带称呼的消息。

### prefix

- 类型：`string[]`
- 默认值：`['!', '！']`

消息前缀。带此前缀的消息将被回复。

### interaction

- 类型：`'user' | 'channel' | 'both'`
- 默认值：`'channel'`

上下文共享方式。详情请参考[对话上下文](./context.md)。
