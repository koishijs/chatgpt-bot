# 配置项

## 登录设置

<!-- ### markdown

- 类型：`boolean`
- 默认值：`false`

是否以 Markdown 格式回复。 -->

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
