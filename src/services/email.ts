// services/emailService.ts
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { env } from "../config/env.js";

const ses = new SESClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

type SendEmailParams = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
};

type SendEmailResult =
  | {
      success: true;
      messageId?: string;
    }
  | {
      success: false;
      error: string;
    };

export type ContactSubmissionParams = {
  name: string;
  email: string;
  mobile: string;
  description: string;
};

export const sendEmail = async ({
  to,
  subject,
  text = "",
  html = "",
}: SendEmailParams): Promise<SendEmailResult> => {
  try {
    const command = new SendEmailCommand({
      Source: env.AWS_SES_FROM_EMAIL,
      Destination: {
        ToAddresses: Array.isArray(to) ? to : [to],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: "UTF-8",
        },
        Body: {
          Text: {
            Data: text,
            Charset: "UTF-8",
          },
          Html: {
            Data: html,
            Charset: "UTF-8",
          },
        },
      },
      ReplyToAddresses: [],
    });

    const response = await ses.send(command);

    return {
      success: true,
      messageId: response.MessageId,
    };
  } catch (error: unknown) {
    console.error("Email send error:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown email error",
    };
  }
};


export const sendContactSubmissionEmail = async ({
  name,
  email,
  mobile,
  description,
}: ContactSubmissionParams): Promise<SendEmailResult> => {
  const subject = `New Contact Submission from ${name}`;

  const text = `
New contact form submission

Name: ${name}
Email: ${email}
Mobile: ${mobile}

Description:
${description}
  `.trim();

  const html = `
    <h2>New Contact Form Submission</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Mobile:</strong> ${escapeHtml(mobile)}</p>
    <p><strong>Description:</strong></p>
    <p>${escapeHtml(description).replace(/\n/g, "<br />")}</p>
  `;

  try {
    const command = new SendEmailCommand({
      Source: env.AWS_SES_FROM_EMAIL,
      Destination: {
        ToAddresses: [env.CONTACT_RECEIVER_EMAIL],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: "UTF-8",
        },
        Body: {
          Text: {
            Data: text,
            Charset: "UTF-8",
          },
          Html: {
            Data: html,
            Charset: "UTF-8",
          },
        },
      },
      ReplyToAddresses: [email],
    });

    const response = await ses.send(command);

    return {
      success: true,
      messageId: response.MessageId,
    };
  } catch (error: unknown) {
    console.error("Contact submission email error:", error);

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown contact submission email error",
    };
  }
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");