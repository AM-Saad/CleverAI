// server/utils/sendGrid.ts
import sgMail from "@sendgrid/mail"

sgMail.setApiKey(process.env.SENDGRID_API_KEY!) // Set your SendGrid API key
console.log("SendGrid API key set" + process.env.SENDGRID_API_KEY)
export const sendEmail = async (
  recipientEmail: string,
  verificationCode: string,
): Promise<void> => {
  const msg = {
    to: recipientEmail,
    from: "abdelrhmanm525@gmail.com", // Use your verified domain email
    subject: "Email Verification",
    text: `Your verification code is: ${verificationCode}`,
    html: `<p>Your verification code is: <strong>${verificationCode}</strong></p>`,
  }

  try {
    const data = await sgMail.send(msg)
    console.log("Email sent" + data)
  } catch (error) {
    throw new Error(`Failed to send email: ${error}`)
  }
}
