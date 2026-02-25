import { webhookCallback } from 'grammy'
import { createBot } from '@/lib/telegram-bot'

/**
 * POST  /api/telegram/webhook
 *
 * Vercel calls this on every Telegram update.
 * grammY processes the update synchronously and returns 200 to Telegram.
 *
 * Set the webhook once (replace YOUR_VERCEL_URL):
 *   https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://YOUR_VERCEL_URL/api/telegram/webhook
 */

const bot = createBot()
const handler = webhookCallback(bot, 'std/http')

export async function POST(req: Request) {
  return handler(req)
}

/**
 * GET  /api/telegram/webhook
 *
 * Convenience: visit this URL in a browser (with a ?setup=1 query param) to
 * register the webhook automatically using the deployment URL from headers.
 * Requires BOT_TOKEN env var to be set.
 *
 * Example: https://your-app.vercel.app/api/telegram/webhook?setup=1
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  if (searchParams.get('setup') === '1') {
    const token = process.env.BOT_TOKEN
    if (!token) {
      return Response.json({ error: 'BOT_TOKEN is not set' }, { status: 500 })
    }

    // Derive the deployment URL from the request
    const hookUrl = `${new URL(req.url).origin}/api/telegram/webhook`

    const tgRes = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(hookUrl)}`,
    )
    const tgJson = await tgRes.json()
    return Response.json({ webhookUrl: hookUrl, telegram: tgJson })
  }

  // Default GET — show status
  return Response.json({ ok: true, info: 'Telegram bot webhook endpoint. POST only for updates.' })
}
