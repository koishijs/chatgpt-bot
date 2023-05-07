import { Context, Dict, Schema, SessionError, Time } from 'koishi'
import { v4 as uuidv4 } from 'uuid'
import type { } from '@koishijs/cache'
import type { Page } from 'koishi-plugin-puppeteer'

import * as types from './types'

const KEY_ACCESS_TOKEN = 'access-token'
const KEY_SESSION_TOKEN = 'session-token'

export interface Conversation {
  conversationId?: string
  messageId?: string
  message: string
}

declare module '@koishijs/cache' {
  interface Tables {
    'chatgpt/cookies': string
  }
}

class ChatGPT {
  protected page: Page
  protected ready: Promise<void>

  constructor(protected ctx: Context) {
    this.ready = this.start()
  }

  protected async start() {
    this.page = await this.ctx.puppeteer.page()
    let sessionToken = await this.ctx.cache.get('chatgpt/cookies', KEY_SESSION_TOKEN)
    if (sessionToken) await this.page.setCookie({
      name: '__Secure-next-auth.session-token',
      value: sessionToken,
      domain: 'chat.openai.com',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      sameParty: false,
      sourceScheme: 'Secure',
      sourcePort: 443,
    })
    await this.page.evaluateOnNewDocument(`Object.defineProperties(navigator, { webdriver:{ get: () => false } })`)
    await this.page.goto('https://chat.openai.com/chat')
    await this.page.waitForResponse('https://chat.openai.com/api/auth/session', { timeout: Time.minute * 10 })
    const cookies = await this.page.cookies('https://chat.openai.com')
    sessionToken = cookies.find(c => c.name === '__Secure-next-auth.session-token')?.value
    if (!sessionToken) throw new Error('Can not get session token.')
    await this.ctx.cache.set('chatgpt/cookies', KEY_SESSION_TOKEN, sessionToken, Time.day * 30)
  }

  async getIsAuthenticated() {
    await this.ready
    try {
      await this.refreshAccessToken()
      return true
    } catch (err) {
      return false
    }
  }

  async ensureAuth() {
    await this.ready
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
    await this.ready
    const { conversationId, messageId = uuidv4(), message } = conversation

    const accessToken = await this.refreshAccessToken()

    const body: types.ConversationJSONBody = {
      action: 'next',
      conversation_id: conversationId,
      messages: [
        {
          id: uuidv4(),
          author: {
            role: 'user'
          },
          content: {
            content_type: 'text',
            parts: [
              message,
            ]
          }
        }
      ],
      parent_message_id: messageId,
      model: 'text-davinci-002-render-sha',
    }

    const res = await this.page.evaluate((body, accessToken) => {
      return new Promise(async (resolve: (value: string) => void, reject) => {
        const decoder = new TextDecoder()
        const res = await fetch('https://chat.openai.com/backend-api/conversation', {
          method: 'POST',
          body: body,
          headers: {
            authorization: `Bearer ${accessToken}`,
            accept: 'text/event-stream',
            'content-type': 'application/json',
          }
        })

        if (!res.ok) return reject(res.status)

        let data: any
        setTimeout(() => resolve(data), 2 * 60 * 1000)
        res.body.pipeTo(new WritableStream({
          write(chunk) {
            const chunks = decoder.decode(chunk).split('\n')
            for (const chunk of chunks) {
              if (!chunk) continue
              if (chunk.startsWith('data: [DONE]')) {
                return resolve(data)
              }
              try {
                const raw = chunk.replace('data: ', '')
                JSON.parse(raw)
                data = raw
              } catch {}
            }
          }
        }))
      })
    }, JSON.stringify(body), accessToken)
      .then(r => JSON.parse(r))
      .catch((e: Error) => {
        if (e.message.includes('501')) throw new SessionError('commands.chatgpt.messages.unauthorized')
        if (e.message.includes('404')) throw new SessionError('commands.chatgpt.messages.conversation-not-found')
        if (e.message.includes('429')) throw new SessionError('commands.chatgpt.messages.too-many-requests')
        if (e.message.includes('500')) throw new SessionError('commands.chatgpt.messages.service-unavailable', [500])
        if (e.message.includes('503')) throw new SessionError('commands.chatgpt.messages.service-unavailable', [503])
        throw e
      })
    return {
      conversationId: res?.conversation_id,
      message: res?.message?.content?.parts?.[0],
      messageId: res?.message?.id,
    }
  }

  async refreshAccessToken(): Promise<string> {
    await this.ready
    let accessToken = await this.ctx.cache.get('chatgpt/cookies', KEY_ACCESS_TOKEN)
    if (!accessToken) {
      accessToken = await this.page.evaluate(() => {
        return fetch('https://chat.openai.com/api/auth/session')
          .then(r => r.json())
          .then(r => r.accessToken)
      })
      await this.ctx.cache.set('chatgpt/cookies', KEY_ACCESS_TOKEN, accessToken, Time.hour)
    }

    return accessToken
  }
}

namespace ChatGPT {
  
}

export default ChatGPT
