// Legacy Twilio implementation - kept for reference but not used
// System now uses ClickSend via Zapier webhooks

import twilio from 'twilio'

export async function sendEstimateLinkSMS(phone: string, estimateUrl: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('[SMS] Twilio credentials not configured - using ClickSend webhook instead')
    return { 
      success: false, 
      error: 'SMS service not configured. Please add Twilio credentials.' 
    }
  }

  try {
    const client = twilio(accountSid, authToken)

    const message = await client.messages.create({
      body: `Blue Pacific Window Cleaning - Get your estimate:\n\n${estimateUrl}\n\nJust snap a few photos of your home and we'll send you pricing within 24 hours. Mahalo! 🌺`,
      from: fromNumber,
      to: phone.startsWith('+') ? phone : `+1${phone}`
    })

    console.log('[SMS] Message sent:', message.sid)
    return { success: true, messageSid: message.sid }
  } catch (err) {
    console.error('[SMS] Failed to send:', err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : String(err) 
    }
  }
}
