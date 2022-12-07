import ChatGPT from './api'
import { Context, Logger, Schema, Session, SessionError } from 'koishi'

const logger = new Logger('chatgpt')

const conversationContext = ['user', 'channel', 'both'] as const
export type ConversationContext = typeof conversationContext[number]

export interface Config extends ChatGPT.Config {
  appellation: boolean
  prefix: string[]
  conversationContext: ConversationContext
}

export const Config: Schema<Config> = Schema.intersect([
  ChatGPT.Config,
  Schema.object({
    appellation: Schema.boolean().description('是否使用称呼触发对话。').default(true),
    prefix: Schema.union([
      Schema.array(String),
      Schema.transform(String, (prefix) => [prefix]),
    ] as const).description('使用特定前缀触发对话。').default(['!', '！']),
    conversationContext: Schema.union([
      Schema.const('user').description('用户独立'),
      Schema.const('channel').description('频道独立'),
      Schema.const('both').description('频道内用户独立'),
    ]).description('对话历史上下文缓存方式。').default('channel')
  }),
])

const conversations = new Map<string, { messageId: string; conversationId: string }>()

export function apply(ctx: Context, config: Config) {
  ctx.i18n.define('zh', require('./locales/zh-CN'))

  const api = new ChatGPT(ctx, config)

  const getMapKey = (() => {
    switch (config.conversationContext) {
      case 'user':
        return (session: Session) => session.uid
      case 'channel':
        return (session: Session) => session.cid
      case 'both':
        return (session: Session) => `${session.cid}:${session.uid}`
    }
  })()

  ctx.middleware(async (session, next) => {
    if (session.parsed?.appel) {
      return session.execute('chatgpt ' + session.parsed.content)
    }
    for (const prefix of config.prefix) {
      if (!prefix || !session.content.startsWith(prefix)) continue
      return session.execute('chatgpt ' + session.content.slice(config.prefix.length))
    }
    return next()
  })

  ctx.command('chatgpt <input:text>')
    .option('reset', '-r')
    .action(async ({ options, session }, input) => {
      const mapKey = getMapKey(session)

      if (options?.reset) {
        conversations.delete(mapKey)
        return session.text('.reset-success')
      }

      input = input.trim()
      if (!input) {
        await session.send(session.text('.expect-prompt'))
        input = await session.prompt()
      }

      try {
        // ensure the API is properly authenticated (optional)
        await api.ensureAuth()
      } catch (err) {
        return session.text('.invalid-token')
      }

      try {
        // send a message and wait for the response
        const { conversationId, messageId } = conversations.get(mapKey) ?? {}
        const response = await api.sendMessage({ message: input, conversationId, messageId })
        conversations.set(mapKey, { conversationId: response.conversationId, messageId: response.messageId })
        return response.message
      } catch (error) {
        logger.warn(error)
        throw new SessionError('commands.chatgpt.messages.unknown-error')
      }
    })
}
