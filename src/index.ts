import { ChatGPTAPI } from 'chatgpt'
import { Context, Schema } from 'koishi'

export interface Config {
  token: string
  appellation: boolean
  prefix?: string
}

export const Config: Schema<Config> = Schema.object({
  token: Schema.string().description('OpenAI 的 Session Token').required(),
  appellation: Schema.boolean().description('是否使用称呼触发对话'),
  prefix: Schema.string().description('使用特定前缀触发对话'),
})

export function apply(ctx: Context, config: Config) {
  ctx.i18n.define('zh', require('./locales/zh-CN'))

  const api = new ChatGPTAPI({ sessionToken: config.token, markdown: false })

  ctx.middleware(async (session, next) => {
    if (session.parsed?.appel) {
      session.execute('chatgpt ' + session.parsed.content)
    } else if (config.prefix && session.content.startsWith(config.prefix)) {
      session.execute('chatgpt ' + session.content.slice(config.prefix.length))
    } else {
      return next()
    }
  })

  ctx.command('chatgpt')
    .action(async ({ session }, input) => {
      try {
        // ensure the API is properly authenticated (optional)
        await api.ensureAuth()
      } catch (err) {
        return session.text('.invalid-token')
      }

      // send a message and wait for the response
      const response = await api.sendMessage(input)

      return response
    })
}
