import { sendEmail } from '../utils/sendEmail';
import { verifyAccountTemplate } from '../templates/verifyAccount';

export const sendVerificationMail = async (to: string, token: string) => {
  const subject = 'Account Verification';
  const link = `${process.env.FRONTEND_URL}/auth/verify?token=${token}`;

  const html = verifyAccountTemplate(link);

  await sendEmail(to, subject, html);
};
