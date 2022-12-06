export type ContentType = 'text'

export type Role = 'user' | 'assistant'

/**
 * https://chat.openapi.com/api/auth/session
 */
export interface SessionResult {
  /** Object of the current user */
  user: User
  /** ISO date of the expiration date of the access token */
  expires: string
  /** The access token */
  accessToken: string
}

export interface User {
  /** ID of the user */
  id: string
  /** Name of the user */
  name: string
  /** Email of the user */
  email: string
  /** Image of the user */
  image: string
  /** Picture of the user */
  picture: string
  /** Groups the user is in */
  groups: string[] | []
  /** Features the user is in */
  features: string[] | []
}

/**
 * https://chat.openapi.com/backend-api/models
 */
export interface ModelsResult {
  /** Array of models */
  models: Model[]
}

export interface Model {
  /** Name of the model */
  slug: string
  /** Max tokens of the model */
  max_tokens: number
  /** Whether or not the model is special */
  is_special: boolean
}

/**
 * https://chat.openapi.com/backend-api/moderations
 */
export interface ModerationsJSONBody {
  /** Input for the moderation decision */
  input: string
  /** The model to use in the decision */
  model: AvailableModerationModels
}

export type AvailableModerationModels = 'text-moderation-playground'

/**
 * https://chat.openapi.com/backend-api/moderations
 */
export interface ModerationsJSONResult {
  /** Whether or not the input is flagged */
  flagged: boolean
  /** Whether or not the input is blocked */
  blocked: boolean
  /** The ID of the decision */
  moderation_id: string
}

/**
 * https://chat.openapi.com/backend-api/conversation
 */
export interface ConversationJSONBody {
  /** The action to take */
  action: string
  /** The ID of the conversation */
  conversation_id?: string
  /** Prompts to provide */
  messages: Prompt[]
  /** The model to use */
  model: string
  /** The parent message ID */
  parent_message_id: string
}

export interface Prompt {
  /** The content of the prompt */
  content: PromptContent
  /** The ID of the prompt */
  id: string
  /** The role played in the prompt */
  role: Role
}

export interface PromptContent {
  /** The content type of the prompt */
  content_type: ContentType
  /** The parts to the prompt */
  parts: string[]
}

/**
 * https://chat.openapi.com/backend-api/conversation/message_feedback
 */
export interface MessageFeedbackJSONBody {
  /** The ID of the conversation */
  conversation_id: string
  /** The message ID */
  message_id: string
  /** The rating */
  rating: MessageFeedbackRating
  /** Tags to give the rating */
  tags?: MessageFeedbackTags[]
  /** The text to include */
  text?: string
}

export type MessageFeedbackTags = 'harmful' | 'false' | 'not-helpful'

export interface MessageFeedbackResult {
  /** The message ID */
  message_id: string
  /** The ID of the conversation */
  conversation_id: string
  /** The ID of the user */
  user_id: string
  /** The rating */
  rating: MessageFeedbackRating
  /** The text the server received, including tags */
  text?: string
}

export type MessageFeedbackRating = 'thumbsUp' | 'thumbsDown'

export interface ConversationResponseEvent {
  message?: Message
  conversation_id?: string
  error?: string | null
}

export interface Message {
  id: string
  content: MessageContent
  role: string
  user: string | null
  create_time: string | null
  update_time: string | null
  end_turn: null
  weight: number
  recipient: string
  metadata: MessageMetadata
}

export interface MessageContent {
  content_type: string
  parts: string[]
}

export type MessageMetadata = any
