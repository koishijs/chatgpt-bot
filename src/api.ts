import ExpiryMap from 'expiry-map'
import { createParser } from 'eventsource-parser'
import { Context, Quester, Schema } from 'koishi'
import internal, { Writable } from 'stream'
import { v4 as uuidv4 } from 'uuid'

import * as types from './types'
import { markdownToText } from './utils'

const KEY_ACCESS_TOKEN = 'accessToken'

export interface Conversation {
  id?: string
  message: string
}

class ChatGPT {
  protected http: Quester
  // stores access tokens for up to 10 seconds before needing to refresh
  protected _accessTokenCache = new ExpiryMap<string, string>(10 * 1000)

  constructor(ctx: Context, public config: ChatGPT.Config) {
    this.http = ctx.http.extend({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
      },
    })
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
    const { id = uuidv4(), message } = conversation

    const accessToken = await this.refreshAccessToken()

    const newId = uuidv4()
    const body: types.ConversationJSONBody = {
      action: 'next',
      messages: [
        {
          id: newId,
          role: 'user',
          content: {
            content_type: 'text',
            parts: [message],
          },
        },
      ],
      model: 'text-davinci-002-render',
      parent_message_id: id,
    }

    const url = `https://chat.openai.com/backend-api/conversation`

    const { data } = await this.http.axios<internal.Readable>(url, {
      method: 'POST',
      responseType: 'stream',
      data: body,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    let response = ''
    return await new Promise<Required<Conversation>>((resolve, reject) => {
      const parser = createParser((event) => {
        if (event.type === 'event') {
          const { data } = event
          if (data === '[DONE]') {
            return resolve({ message: response, id: newId })
          }
          try {
            const parsedData: types.ConversationResponseEvent = JSON.parse(data)
            const message = parsedData.message

            if (message) {
              let text = message?.content?.parts?.[0]

              if (text) {
                if (!this.config.markdown) {
                  text = markdownToText(text)
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

    try {
      const res = await this.http.get('https://chat.openai.com/api/auth/session', {
        headers: {
          cookie: `__Secure-next-auth.session-token=${this.config.sessionToken}`,
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
    sessionToken: string
    markdown?: boolean
  }

  export const Config: Schema<Config> = Schema.object({
    sessionToken: Schema.string().description('ChatGPT 会话令牌。').required(),
    markdown: Schema.boolean().hidden().default(false),
  })
}

export default ChatGPT
