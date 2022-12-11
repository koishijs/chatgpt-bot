import ChatGPT from './api'
import {Context, h, Logger, Schema, Session, SessionError} from 'koishi'

const logger = new Logger('chatgpt')

const interaction = ['user', 'channel', 'both'] as const
export type Interaction = typeof interaction[number]

export interface Config extends ChatGPT.Config {
  appellation: boolean
  prefix: string[]
  /**
   * Configure how to share the conversation context between users:
   *
   * - `user`: every user has its own context, across all channels
   * - `channel`: every channel has its own context, no matter which user is talking
   * - `both`: every user has its own context in each channel
   *
   * @see https://github.com/koishijs/chatgpt-bot/pull/15
   */
  interaction: Interaction
}

export const Config: Schema<Config> = Schema.intersect([
  ChatGPT.Config,
  Schema.object({
    appellation: Schema.boolean().description('是否使用称呼触发对话。').default(true),
    prefix: Schema.union([
      Schema.array(String),
      Schema.transform(String, (prefix) => [prefix]),
    ] as const).description('使用特定前缀触发对话。').default(['!', '！']),
    interaction: Schema.union([
      Schema.const('user' as const).description('用户独立'),
      Schema.const('channel' as const).description('频道独立'),
      Schema.const('both' as const).description('频道内用户独立'),
    ]).description('上下文共享方式。').default('channel'),
  }),
])

const conversations = new Map<string, { messageId: string; conversationId: string }>()

export function apply(ctx: Context, config: Config) {
  ctx.i18n.define('zh', require('./locales/zh-CN'))

  const api = new ChatGPT(ctx, config)

  const getContextKey = (session: Session, config: Config) => {
    switch (config.interaction) {
      case 'user':
        return session.uid
      case 'channel':
        return session.cid
      case 'both':
        const {platform, channelId, userId} = session
        return `${platform}:${channelId}:${userId}`
    }
  }

  const replyMessage = (session, message: string): string => {
    return h('quote', {id: session.messageId}) + message
  }

  ctx.middleware(async (session, next) => {
    if (session.parsed?.appel) {
      return session.execute('chatgpt ' + session.parsed.content)
    }
    for (const prefix of config.prefix) {
      if (!prefix || !session.content.startsWith(prefix)) continue
      return session.execute('chatgpt ' + session.content.slice(prefix.length))
    }
    return next()
  })

  ctx.command('chatgpt <input:text>')
    .option('reset', '-r')
    .action(async ({options, session}, input) => {
      const key = getContextKey(session, config)

      if (options?.reset) {
        conversations.delete(key)
        return replyMessage(session, session.text('.reset-success'))
      }

      input = input?.trim()
      if (!input) {
        await session.send(session.text('.expect-prompt'))
        input = await session.prompt()
      }

      try {
        // ensure the API is properly authenticated (optional)
        await api.ensureAuth()
      } catch (error) {
        logger.warn(error)
        return replyMessage(session, session.text('.invalid-token'))
      }

      try {
        // send a message and wait for the response
        const {conversationId, messageId} = conversations.get(key) ?? {}
        const response = await api.sendMessage({message: input, conversationId, messageId})
        conversations.set(key, {conversationId: response.conversationId, messageId: response.messageId})
        return replyMessage(session, response.message)
      } catch (error) {
        logger.warn(error)
        if (error instanceof SessionError) throw error
        throw new SessionError('commands.chatgpt.messages.unknown-error')
      }
    })
}
