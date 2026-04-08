const nodemailer = require('nodemailer')

function getTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

async function sendInviteEmail(supplierEmail, supplierName, companyName, submissionLink) {
  const transporter = getTransporter()
  if (!transporter) {
    console.log('[Email] SMTP not configured — skipping invite email')
    return
  }
  try {
    await transporter.sendMail({
      from: `"${companyName} via CarbonFlow" <${process.env.SMTP_USER}>`,
      to: supplierEmail,
      subject: `${companyName} is requesting your emissions data`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
          <div style="background:#0f172a;padding:24px;border-radius:12px 12px 0 0">
            <h2 style="color:#4ade80;margin:0;font-size:22px">CarbonFlow</h2>
          </div>
          <div style="background:#f8fafc;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0">
            <h3 style="margin:0 0 16px">Hello ${supplierName},</h3>
            <p style="color:#475569;line-height:1.6">
              <strong>${companyName}</strong> is collecting Scope 3 emissions data from their supply chain
              for sustainability reporting. They have invited you to submit your data using the secure link below.
            </p>
            <p style="color:#475569;line-height:1.6">
              It takes less than 2 minutes to complete. No account or login required.
            </p>
            <div style="text-align:center;margin:32px 0">
              <a href="${submissionLink}"
                 style="background:#16a34a;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
                Submit My Emissions Data →
              </a>
            </div>
            <p style="color:#94a3b8;font-size:13px">
              Or copy this link into your browser:<br/>
              <a href="${submissionLink}" style="color:#4ade80;word-break:break-all">${submissionLink}</a>
            </p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
            <p style="color:#94a3b8;font-size:12px;margin:0">
              This request was sent on behalf of ${companyName} using CarbonFlow, a Scope 3 carbon accounting platform.
            </p>
          </div>
        </div>
      `,
    })
    console.log(`[Email] Invite sent to ${supplierEmail}`)
  } catch (err) {
    console.error(`[Email] Failed to send invite to ${supplierEmail}:`, err.message)
  }
}

async function sendReminderEmail(supplierEmail, supplierName, companyName, submissionLink, isFinal = false) {
  const transporter = getTransporter()
  if (!transporter) return
  const subject = isFinal
    ? `Final reminder: ${companyName} needs your emissions data`
    : `Reminder: ${companyName} is waiting for your emissions data`
  try {
    await transporter.sendMail({
      from: `"${companyName} via CarbonFlow" <${process.env.SMTP_USER}>`,
      to: supplierEmail,
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
          <div style="background:#0f172a;padding:24px;border-radius:12px 12px 0 0">
            <h2 style="color:#4ade80;margin:0;font-size:22px">CarbonFlow</h2>
          </div>
          <div style="background:#f8fafc;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0">
            <h3 style="margin:0 0 16px">Hello ${supplierName},</h3>
            <p style="color:#475569;line-height:1.6">
              ${isFinal ? 'This is a final reminder.' : 'Just a friendly reminder.'} <strong>${companyName}</strong> is still waiting
              for your emissions data submission. Please take a moment to complete the short form.
            </p>
            <div style="text-align:center;margin:32px 0">
              <a href="${submissionLink}"
                 style="background:#16a34a;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
                Submit My Emissions Data →
              </a>
            </div>
            <p style="color:#94a3b8;font-size:13px">
              Link: <a href="${submissionLink}" style="color:#4ade80;word-break:break-all">${submissionLink}</a>
            </p>
          </div>
        </div>
      `,
    })
    console.log(`[Email] ${isFinal ? 'Final reminder' : 'Reminder'} sent to ${supplierEmail}`)
  } catch (err) {
    console.error(`[Email] Failed to send reminder to ${supplierEmail}:`, err.message)
  }
}

async function sendAlertEmail(companyEmail, companyName, alertMessage) {
  const transporter = getTransporter()
  if (!transporter || !companyEmail) return
  try {
    await transporter.sendMail({
      from: `"CarbonFlow Alerts" <${process.env.SMTP_USER}>`,
      to: companyEmail,
      subject: `Critical alert for ${companyName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
          <div style="background:#0f172a;padding:24px;border-radius:12px 12px 0 0">
            <h2 style="color:#f43f5e;margin:0;font-size:22px">CarbonFlow Alert</h2>
          </div>
          <div style="background:#f8fafc;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0">
            <p style="margin:0 0 8px">Company: <strong>${companyName}</strong></p>
            <p style="margin:0;color:#475569;line-height:1.6">${alertMessage}</p>
          </div>
        </div>
      `,
    })
  } catch (err) {
    console.error('[Email] Failed to send alert email:', err.message)
  }
}

async function sendSupplierNetworkInviteEmail(supplierEmail, companyName, signupLink) {
  const transporter = getTransporter()
  if (!transporter) {
    console.log('[Email] SMTP not configured — skipping network invite email')
    return
  }
  try {
    await transporter.sendMail({
      from: `"${companyName} via CarbonFlow" <${process.env.SMTP_USER}>`,
      to: supplierEmail,
      subject: `${companyName} invited you to CarbonFlow Supplier Network`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
          <div style="background:#0f172a;padding:24px;border-radius:12px 12px 0 0">
            <h2 style="color:#4ade80;margin:0;font-size:22px">CarbonFlow</h2>
          </div>
          <div style="background:#f8fafc;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0">
            <h3 style="margin:0 0 16px">You are invited</h3>
            <p style="color:#475569;line-height:1.6">
              <strong>${companyName}</strong> wants to connect with you on CarbonFlow so you can submit emissions once and share data across companies.
            </p>
            <p style="color:#475569;line-height:1.6">
              Create your supplier account using the same email this invite was sent to.
            </p>
            <div style="text-align:center;margin:32px 0">
              <a href="${signupLink}"
                 style="background:#16a34a;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
                Accept invite &amp; sign up
              </a>
            </div>
            <p style="color:#94a3b8;font-size:13px">
              Or copy this link:<br/>
              <a href="${signupLink}" style="color:#4ade80;word-break:break-all">${signupLink}</a>
            </p>
          </div>
        </div>
      `,
    })
    console.log(`[Email] Network invite sent to ${supplierEmail}`)
  } catch (err) {
    console.error(`[Email] Failed to send network invite to ${supplierEmail}:`, err.message)
  }
}

module.exports = { sendInviteEmail, sendReminderEmail, sendAlertEmail, sendSupplierNetworkInviteEmail }
