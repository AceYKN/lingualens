import { PUBLIC_DAILY_LIMIT, PUBLIC_INPUT_LIMIT, PUBLIC_MINUTE_LIMIT } from '../../src/public-service/types'
import { json, publicOutputCeiling, serviceAvailability, type PagesContextLike } from '../_lib/runtime'

export async function onRequestGet({ env }: PagesContextLike) {
  const availability = serviceAvailability(env)
  return json({
    available: availability.ready,
    model: env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
    turnstileSiteKey: availability.ready ? env.TURNSTILE_SITE_KEY : '',
    inputLimit: PUBLIC_INPUT_LIMIT,
    maxOutputTokens: publicOutputCeiling(env),
    minuteLimit: PUBLIC_MINUTE_LIMIT,
    dailyLimit: PUBLIC_DAILY_LIMIT,
    message: availability.message,
  })
}
