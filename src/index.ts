import { ChatGPTAPI } from 'chatgpt'
import { Context, Schema } from 'koishi'

export interface Config {
  token: string
}

export const Config = Schema.object({
  token: Schema.string().description('OpenAI 的 Session Token').required(),
})

export function apply(ctx: Context, config: Config) {
  ctx.i18n.define('zh', require('./locales/zh-CN.yml'))

  const api = new ChatGPTAPI({ sessionToken: config.token, markdown: false })

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
