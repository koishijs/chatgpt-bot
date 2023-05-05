import ExpiryMap from 'expiry-map'
import { createParser } from 'eventsource-parser'
import { Context, Dict, Quester, Schema, SessionError, trimSlash } from 'koishi'
import internal, { Writable } from 'stream'
import { v4 as uuidv4 } from 'uuid'

import * as types from './types'
import { transform } from './utils'

const KEY_ACCESS_TOKEN = 'accessToken'

export interface Conversation {
  conversationId?: string
  messageId?: string
  message: string
}

class ChatGPT {
  protected http: Quester
  // stores access tokens for up to 10 seconds before needing to refresh
  protected _accessTokenCache = new ExpiryMap<string, string>(10 * 1000)

  constructor(ctx: Context, public config: ChatGPT.Config) {
    this.http = ctx.http.extend(config)
  }

  async getIsAuthenticated() {
    try {
      await this.refreshAccessToken()
      return true
    } catch (err) {
      return false
    }
  }

  async ensureAuth() {
    return await this.refreshAccessToken()
  }

  /**
   * Sends a message to ChatGPT, waits for the response to resolve, and returns
   * the response.
   *
   * @param message - The plaintext message to send.
   * @param opts.conversationId - Optional ID of the previous message in a conversation
   */
  async sendMessage(conversation: Conversation): Promise<Required<Conversation>> {
    let { conversationId, messageId = uuidv4(), message } = conversation

    const accessToken = await this.refreshAccessToken()
    
    if(!conversationId){
      message = this.config.initialPrompt + "\n" + message
    }
    
    const body: types.ConversationJSONBody = {
      action: 'next',
      conversation_id: conversationId,
      messages: [
        {
          id: uuidv4(),
          role: 'user',
          content: {
            content_type: 'text',
            parts: [message],
          },
        },
      ],
      model: this.config.model,
      parent_message_id: messageId,
    }

    let data: internal.Readable
    try {
      const resp = await this.http.axios<internal.Readable>(this.config.conversationEndpoint, {
        method: 'POST',
        responseType: 'stream',
        data: body,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          cookie: `cf_clearance=${this.config.cloudflareToken};__Secure-next-auth.session-token=${this.config.sessionToken}`,
          referer: 'https://chat.openai.com/chat',
          authority: 'chat.openai.com',
        },
      })

      data = resp.data
    } catch (err) {
      if (Quester.isAxiosError(err)) {
        switch (err.response?.status) {
          case 401:
            throw new SessionError('commands.chatgpt.messages.unauthorized')
          case 404:
            throw new SessionError('commands.chatgpt.messages.conversation-not-found')
          case 429:
            throw new SessionError('commands.chatgpt.messages.too-many-requests')
          case 500:
          case 503:
            throw new SessionError('commands.chatgpt.messages.service-unavailable', [err.response.status])
          default:
            throw err
        }
      }
    }

    let response = ''
    return await new Promise<Required<Conversation>>((resolve, reject) => {
      let messageId: string
      let conversationId: string
      const parser = createParser((event) => {
        if (event.type === 'event') {
          const { data } = event
          if (data === '[DONE]') {
            return resolve({ message: response, messageId, conversationId })
          }
          try {
            const parsedData: types.ConversationResponseEvent = JSON.parse(data)
            const message = parsedData.message
            conversationId = parsedData.conversation_id

            if (message) {
              messageId = message?.id
              let text = message?.content?.parts?.[0]

              if (text) {
                if (!this.config.markdown) {
                  text = transform(text)
                }

                response = text
              }
            }
          } catch (err) {
            reject(err)
          }
        }
      })
      data.pipe(new Writable({
        write(chunk: string | Buffer, _encoding, cb) {
          parser.feed(chunk.toString())
          cb()
        },
      }))
    })
  }

  async refreshAccessToken(): Promise<string> {
    const cachedAccessToken = this._accessTokenCache.get(KEY_ACCESS_TOKEN)
    if (cachedAccessToken) {
      return cachedAccessToken
    }
    if (this.config.accessToken) {
      return this.config.accessToken
    }

    try {
      const res = await this.http.get(this.config.sessionEndpoint, {
        headers: {
          cookie: `cf_clearance=${this.config.cloudflareToken};__Secure-next-auth.session-token=${this.config.sessionToken}`,
          referer: 'https://chat.openai.com/chat',
          authority: 'chat.openai.com',
        },
      })

      const accessToken = res?.accessToken

      if (!accessToken) {
        console.warn('no auth token', res)
        throw new Error('Unauthorized')
      }

      this._accessTokenCache.set(KEY_ACCESS_TOKEN, accessToken)
      return accessToken
    } catch (err: any) {
      throw new Error(`ChatGPT failed to refresh auth token: ${err.toString()}`)
    }
  }
}

namespace ChatGPT {
  export interface Config {
    accessToken?: string
    sessionToken: string
    cloudflareToken: string
    endpoint: string
    conversationEndpoint: string
    sessionEndpoint: string
    markdown?: boolean
    headers?: Dict<string>
    proxyAgent?: string
    model: string
    initialPrompt?: string
  }

  export const Config: Schema<Config> = Schema.object({
    endpoint: Schema.string().description('ChatGPT API 的域名。').default('https://chat.openai.com'),
    conversationEndpoint: Schema.string().description('ChatGPT API 的对话端点。').default('/backend-api/conversation'),
    sessionEndpoint: Schema.string().description('ChatGPT API 的记录端点。').default('/api/auth/session'),
    accessToken: Schema.string().description('ChatGPT 会话令牌。为空时可自动获取，手动访问获取：https://chat.openai.com/api/auth/session').default(''),
    sessionToken: Schema.string().role('secret').description('ChatGPT 会话令牌。').required(),
    cloudflareToken: Schema.string().role('secret').description('Cloudflare 令牌。').required(),
    initialPrompt: Schema.string().description('初始提示词'),
    model: Schema.string().description('模型').default('text-davinci-002-render'),
    headers: Schema.dict(String).description('要附加的额外请求头。').default({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
    }),
    proxyAgent: Schema.string().role('link').description('使用的代理服务器地址。'),
    markdown: Schema.boolean().hidden().default(false),
  }).description('登录设置')
}

export default ChatGPT
