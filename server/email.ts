const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@tmginstall.com";

interface EmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailParams): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured. Email not sent to", to);
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      console.error("Failed to send email:", await response.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Error sending email:", err);
    return false;
  }
}

export function depositRequestEmail(customerName: string, referenceNo: string, depositAmount: string, paymentLink: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; margin: 20px 0; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Deposit Payment Required</h1>
          </div>
          <div class="content">
            <p>Hello ${customerName},</p>
            <p>Thank you for requesting a quote with TMG Install. Your quote has been approved!</p>
            <p><strong>Reference Number:</strong> ${referenceNo}</p>
            <p><strong>Deposit Amount:</strong> $${depositAmount}</p>
            <p>To proceed with your booking, please pay the deposit using the link below:</p>
            <a href="${paymentLink}" class="button">Pay Deposit Now</a>
            <p>Once we receive your payment, we'll send you available booking dates and times.</p>
            <p>Questions? Contact us at <strong>sales@tmginstall.com</strong> or call <strong>+65 8088 0757</strong></p>
            <div class="footer">
              <p>© 2026 TMG Install / The Moving Guy. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function bookingConfirmationEmail(customerName: string, referenceNo: string, serviceAddress: string, scheduledAt: string, timeWindow: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .details { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Booking Confirmed!</h1>
          </div>
          <div class="content">
            <p>Hello ${customerName},</p>
            <p>Your booking has been confirmed. Here are your job details:</p>
            <div class="details">
              <p><strong>Reference Number:</strong> ${referenceNo}</p>
              <p><strong>Service Address:</strong> ${serviceAddress}</p>
              <p><strong>Scheduled Date:</strong> ${scheduledAt}</p>
              <p><strong>Time Window:</strong> ${timeWindow}</p>
            </div>
            <p>Our team will arrive within the scheduled time window. Please ensure someone is present at the address.</p>
            <p>If you need to reschedule, you can do so up to 24 hours before your appointment.</p>
            <p>Questions? Contact us at <strong>sales@tmginstall.com</strong> or WhatsApp <strong>+65 8088 0757</strong></p>
            <div class="footer">
              <p>© 2026 TMG Install / The Moving Guy. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function finalPaymentEmail(customerName: string, referenceNo: string, finalAmount: string, paymentLink: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; margin: 20px 0; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Final Payment Due</h1>
          </div>
          <div class="content">
            <p>Hello ${customerName},</p>
            <p>Your service has been completed! Please complete the final payment to close your job.</p>
            <p><strong>Reference Number:</strong> ${referenceNo}</p>
            <p><strong>Final Amount:</strong> $${finalAmount}</p>
            <p>Click below to complete payment:</p>
            <a href="${paymentLink}" class="button">Pay Final Amount</a>
            <p>Thank you for choosing TMG Install! We appreciate your business.</p>
            <p>Questions? Contact us at <strong>sales@tmginstall.com</strong> or call <strong>+65 8088 0757</strong></p>
            <div class="footer">
              <p>© 2026 TMG Install / The Moving Guy. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}
