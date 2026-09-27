import nodemailer from 'nodemailer';
import { db } from '../../db/index.ts';
import * as schema from '../../db/schema.ts';

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Creates nodemailer transporter based on environment variables or stored settings.
 */
async function getTransporter() {
  // 1. Check environment variables for OAuth2
  const envUser = process.env.GMAIL_USER || process.env.SMTP_USER || process.env.EMAIL_USER;
  const envPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const envClientId = process.env.GMAIL_CLIENT_ID;
  const envClientSecret = process.env.GMAIL_CLIENT_SECRET;
  const envRefreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (envClientId && envClientSecret && envRefreshToken) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: envUser || 'kolvox.pagamentos@gmail.com',
        clientId: envClientId,
        clientSecret: envClientSecret,
        refreshToken: envRefreshToken,
      },
    });
  }

  // 2. Check environment variables for App Password / SMTP
  if (envUser && envPass) {
    if (envUser.includes('@gmail.com') || !process.env.SMTP_HOST) {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: { user: envUser, pass: envPass.replace(/\s+/g, '') },
      });
    }

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: envUser, pass: envPass },
    });
  }

  // 3. Check Database gmailIntegrations table
  try {
    const [gmail] = await db.select().from(schema.gmailIntegrations).limit(1);
    if (gmail && gmail.status === 'connected') {
      const gUser = gmail.googleAccountEmail || 'kolvox.pagamentos@gmail.com';
      if (gmail.refreshTokenEncrypted) {
        if (gmail.accessTokenEncrypted) {
          // OAuth2 configuration
          return nodemailer.createTransport({
            service: 'gmail',
            auth: {
              type: 'OAuth2',
              user: gUser,
              clientId: gmail.googleUserId || process.env.GMAIL_CLIENT_ID,
              clientSecret: process.env.GMAIL_CLIENT_SECRET,
              refreshToken: gmail.refreshTokenEncrypted,
              accessToken: gmail.accessTokenEncrypted,
            },
          });
        } else {
          // App password stored
          return nodemailer.createTransport({
            service: 'gmail',
            auth: { user: gUser, pass: gmail.refreshTokenEncrypted.replace(/\s+/g, '') },
          });
        }
      }
    }
  } catch (err) {
    console.error('Error loading Gmail transporter from DB:', err);
  }

  return null;
}

/**
 * Sends an email to the recipient.
 */
export async function sendEmail({ to, subject, text, html }: EmailOptions): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = await getTransporter();
    const fromAddress = process.env.GMAIL_USER || process.env.SMTP_USER || 'kolvox.pagamentos@gmail.com';

    if (!transporter) {
      console.log(`[EMAIL DISPATCH - MODO SIMULADO / SEM CREDENCIAIS SMTP/GMAIL]`);
      console.log(`Para: ${to} | Assunto: ${subject}`);
      console.log(`Mensagem: ${text}`);
      return {
        success: true,
        message: 'Mensagem registrada e pronta. Para envio ativo via Gmail, insira a Senha de App do Gmail no Painel Admin ou configure GMAIL_APP_PASSWORD.',
      };
    }

    const info = await transporter.sendMail({
      from: `"KOLVOX STAGE" <${fromAddress}>`,
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, '<br/>'),
    });

    console.log(`[EMAIL DISPATCH - SUCESSO] ID: ${info.messageId} para ${to}`);
    return {
      success: true,
      message: `E-mail enviado com sucesso para ${to}.`,
    };
  } catch (error: any) {
    console.error(`[EMAIL DISPATCH - ERRO] Falha ao enviar para ${to}:`, error);
    return {
      success: false,
      message: `Erro ao despachar e-mail: ${error.message || 'Falha de conexão'}`,
    };
  }
}

/**
 * Notifies client that support has answered their ticket.
 */
export async function notifyClientSupportReply(ticket: {
  id: number;
  customerName: string;
  customerEmail: string;
  subject: string;
  replyMessage: string;
}) {
  const subject = `[KOLVOX STAGE] Resposta ao seu chamado #${ticket.id}: ${ticket.subject}`;
  const text = `Olá, ${ticket.customerName}!\n\nNossa equipe de suporte respondeu ao seu chamado #${ticket.id} (${ticket.subject}):\n\n"${ticket.replyMessage}"\n\nVocê também pode acompanhar e responder este chamado diretamente na plataforma KOLVOX STAGE na aba "Suporte".\n\nAtenciosamente,\nEquipe KOLVOX STAGE`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #18181b; color: #f4f4f5; border: 1px solid #27272a; border-radius: 16px; padding: 24px;">
      <h2 style="color: #60a5fa; margin-top: 0;">KOLVOX STAGE - Atendimento ao Artista</h2>
      <p>Olá, <strong>${ticket.customerName}</strong>!</p>
      <p>Nossa equipe de suporte respondeu ao seu chamado <strong>#${ticket.id} (${ticket.subject})</strong>:</p>
      <div style="background-color: #27272a; border-left: 4px solid #10b981; border-radius: 8px; padding: 16px; margin: 16px 0; color: #ecfdf5; font-size: 14px; line-height: 1.6;">
        ${ticket.replyMessage.replace(/\n/g, '<br/>')}
      </div>
      <p style="font-size: 13px; color: #a1a1aa;">
        Esta resposta também já está disponível no seu painel em <strong>Suporte &gt; Histórico de Atendimento</strong>.
      </p>
      <hr style="border: 0; border-top: 1px solid #3f3f46; margin: 24px 0;" />
      <p style="font-size: 11px; color: #71717a; text-align: center;">
        KOLVOX STAGE &copy; ${new Date().getFullYear()} - Plataforma de Palco e Cifras para Músicos
      </p>
    </div>
  `;

  return sendEmail({
    to: ticket.customerEmail,
    subject,
    text,
    html,
  });
}

/**
 * Notifies support and customer when a new ticket is opened.
 */
export async function notifyNewTicketCreated(ticket: {
  id: number;
  customerName: string;
  customerEmail: string;
  subject: string;
  message: string;
}, supportEmail: string) {
  // 1. Email to Support team
  const adminSubject = `[NOVO CHAMADO #${ticket.id}] ${ticket.subject} - ${ticket.customerName}`;
  const adminText = `Novo chamado recebido na plataforma:\n\nCliente: ${ticket.customerName} (${ticket.customerEmail})\nAssunto: ${ticket.subject}\n\nMensagem:\n${ticket.message}\n\nAcesse o Painel Administrativo para responder.`;

  await sendEmail({
    to: supportEmail,
    subject: adminSubject,
    text: adminText,
  });

  // 2. Confirmation to Customer
  const customerSubject = `[KOLVOX STAGE] Recebemos seu chamado #${ticket.id}: ${ticket.subject}`;
  const customerText = `Olá, ${ticket.customerName}!\n\nRecebemos seu chamado de suporte:\n"${ticket.message}"\n\nNossa equipe já está analisando e responderá em breve por aqui e no seu e-mail.\n\nAtenciosamente,\nEquipe KOLVOX STAGE`;

  await sendEmail({
    to: ticket.customerEmail,
    subject: customerSubject,
    text: customerText,
  });
}

/**
 * Notifies client via email as soon as the bank recognizes the Pix payment and activates their PRO plan.
 */
export async function notifyPaymentApprovedAndProActivated(params: {
  userEmail: string;
  userName?: string;
  planName: string;
  amount: string;
  referenceCode?: string;
}) {
  const isYearly = params.planName.includes('yearly');
  const formattedPlan = isYearly ? 'Plano Anual PRO (R$ 99,99/ano)' : 'Plano Mensal PRO (R$ 9,99/mês)';
  const subject = `[KOLVOX STAGE] Pagamento Reconhecido! Seu Plano PRO foi Ativado com Sucesso`;

  const appBaseUrl = process.env.APP_URL || 'https://ais-dev-s7p42qu2vbby4emgjfhtig-855002600123.us-east1.run.app';
  const loginActionUrl = `${appBaseUrl}/?action=login&openAuth=true#login`;

  const text = `Olá, ${params.userName || 'Artista'}!\n\nSeu pagamento Pix no valor de R$ ${params.amount} foi reconhecido com sucesso pelo banco e confirmado no sistema.\n\nSua conta vinculada (${params.userEmail}) agora possui acesso ilimitado ao KOLVOX PRO!\n\nDetalhes da Ativação:\n- Plano: ${formattedPlan}\n- E-mail da Conta: ${params.userEmail}\n- Código/Ref: ${params.referenceCode || 'PIX-CONFIRMADO'}\n- Status: Liberado e Ativo\n\nClique no link abaixo para criar sua conta ou fazer login direto no aplicativo:\n${loginActionUrl}\n\nTodos os recursos de palco, setlists, letras e modo show estão 100% liberados.\n\nBom show!\nEquipe KOLVOX STAGE\nkolvox.pagamentos@gmail.com`;

  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #09090b; color: #f4f4f5; border: 1px solid rgba(0, 229, 255, 0.3); border-radius: 20px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #00e5ff; font-size: 28px; margin: 0; font-weight: 800; letter-spacing: -0.04em;">KOLVOX</h1>
        <p style="color: #a1a1aa; font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em; margin-top: 4px;">Plataforma Profissional para Músicos</p>
      </div>

      <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: center;">
        <span style="font-size: 24px;">🎉</span>
        <h2 style="color: #34d399; margin: 8px 0 4px 0; font-size: 18px;">Pagamento Pix Reconhecido pelo Banco!</h2>
        <p style="color: #d1fae5; font-size: 13px; margin: 0;">Sua conta foi liberada e o Plano PRO já está ativo.</p>
      </div>

      <p style="font-size: 15px; line-height: 1.6; color: #e4e4e7;">
        Olá, <strong>${params.userName || 'Artista'}</strong>!
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa;">
        O sistema bancário confirmou o recebimento da sua transferência Pix para a chave <strong>kolvox.pagamentos@gmail.com</strong>.
      </p>

      <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 18px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="color: #71717a; padding: 6px 0;">Conta Vinculada:</td>
            <td style="color: #00e5ff; font-weight: 600; text-align: right; padding: 6px 0;">${params.userEmail}</td>
          </tr>
          <tr>
            <td style="color: #71717a; padding: 6px 0;">Plano Ativado:</td>
            <td style="color: #ffffff; font-weight: 600; text-align: right; padding: 6px 0;">${formattedPlan}</td>
          </tr>
          <tr>
            <td style="color: #71717a; padding: 6px 0;">Valor Pago:</td>
            <td style="color: #34d399; font-weight: bold; text-align: right; padding: 6px 0;">R$ ${params.amount}</td>
          </tr>
          <tr>
            <td style="color: #71717a; padding: 6px 0;">Identificador da Transação:</td>
            <td style="color: #a1a1aa; font-family: monospace; font-size: 11px; text-align: right; padding: 6px 0;">${params.referenceCode || 'PIX-CONFIRMADO'}</td>
          </tr>
          <tr>
            <td style="color: #71717a; padding: 6px 0;">Status:</td>
            <td style="color: #34d399; font-weight: bold; text-align: right; padding: 6px 0;">● ATIVO / LIBERADO</td>
          </tr>
        </table>
      </div>

      <p style="font-size: 13px; line-height: 1.6; color: #a1a1aa;">
        Você já pode usufruir de todas as músicas sem limites, setlists ilimitados, rolagem automática e modo palco com cifras sincronizadas.
      </p>

      <div style="text-align: center; margin: 28px 0 16px 0;">
        <a href="${loginActionUrl}" style="background: #00e5ff; color: #09090b; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block;">
          Fazer Login / Criar Conta no KOLVOX STAGE
        </a>
      </div>

      <hr style="border: 0; border-top: 1px solid #27272a; margin: 24px 0;" />
      <p style="font-size: 11px; color: #71717a; text-align: center; margin: 0;">
        KOLVOX STAGE &copy; ${new Date().getFullYear()} &bull; Suporte: kolvox.pagamentos@gmail.com
      </p>
    </div>
  `;

  return sendEmail({
    to: params.userEmail,
    subject,
    text,
    html,
  });
}

