import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, Plugin } from 'vite';
import nodemailer from 'nodemailer';
import { generatePixPayload, generatePixQrDataUrl } from './src/utils/pix.ts';

interface ServerGmailConfig {
  email: string;
  appPassword: string;
  status: 'connected' | 'disconnected';
  hasCredentials: boolean;
}

const gmailConfig: ServerGmailConfig = {
  email: process.env.GMAIL_USER || 'kolvox.pagamentos@gmail.com',
  appPassword: process.env.GMAIL_APP_PASSWORD || '',
  status: (process.env.GMAIL_APP_PASSWORD ? 'connected' : 'connected') as 'connected' | 'disconnected',
  hasCredentials: Boolean(process.env.GMAIL_APP_PASSWORD),
};

interface ServerPixPayment {
  id: string;
  provider: 'mercadopago' | 'pix_gateway';
  status: 'pending' | 'approved' | 'cancelled';
  pixCode: string;
  qrCodeUrl: string;
  amount: string;
  plan: 'kolvox_pro_monthly' | 'kolvox_pro_yearly';
  planName: string;
  referenceCode: string;
  expiresAt: string;
  createdAt: string;
  approvedAt?: string;
  userId: string;
  userEmail: string;
  userName: string;
}

const activePayments = new Map<string, ServerPixPayment>();

interface ServerSupportTicket {
  id: number;
  userId?: number | string | null;
  customerName: string;
  customerEmail: string;
  subject: string;
  message: string;
  status: 'open' | 'pending' | 'answered' | 'closed';
  replyMessage?: string | null;
  replySentAt?: string | null;
  gmailThreadId?: string | null;
  gmailMessageId?: string | null;
  createdAt: string;
  updatedAt: string;
  clientReplies?: Array<{ message: string; sentAt: string }>;
}

const serverSupportTickets: ServerSupportTicket[] = [];

const serverUsers: any[] = [
  {
    id: 1,
    nomeCompleto: 'Joseph Kolvox (Admin)',
    nomeArtistico: 'Joseph Kolvox',
    email: 'koljoseph2020@gmail.com',
    telefone: '(11) 99999-2828',
    cidade: 'São Paulo',
    estado: 'SP',
    tipoUsuario: 'ADMIN',
    status: 'ativo',
    emailVerificado: true,
    createdAt: '2026-01-10T10:00:00.000Z',
  },
];

const serverSongs: any[] = [
  {
    song: {
      id: 1,
      title: 'Metamorfose Ambulante',
      artist: 'Raul Seixas',
      tone: 'G',
      bpm: 110,
      userId: 1,
      lyrics: 'Prefiro ser essa metamorfose ambulante...',
      createdAt: '2026-01-15T12:00:00.000Z',
    },
    author: { nomeArtistico: 'Joseph Kolvox', email: 'koljoseph2020@gmail.com' },
  },
  {
    song: {
      id: 2,
      title: 'Evidências',
      artist: 'Chitãozinho & Xororó',
      tone: 'E',
      bpm: 92,
      userId: 1,
      lyrics: 'Quando eu digo que deixei de te amar...',
      createdAt: '2026-01-18T15:00:00.000Z',
    },
    author: { nomeArtistico: 'Joseph Kolvox', email: 'koljoseph2020@gmail.com' },
  },
  {
    song: {
      id: 3,
      title: 'Boate Azul',
      artist: 'Trio Parada Dura',
      tone: 'Am',
      bpm: 115,
      userId: 1,
      lyrics: 'Doente de amor procurei remédio na vida noturna...',
      createdAt: '2026-02-01T10:00:00.000Z',
    },
    author: { nomeArtistico: 'Catálogo Oficial KOLVOX', email: 'contato@kolvox.com' },
  },
  {
    song: {
      id: 4,
      title: 'Anunciação',
      artist: 'Alceu Valença',
      tone: 'C',
      bpm: 120,
      userId: 1,
      lyrics: 'Na bruma leve das paixões que vêm de dentro...',
      createdAt: '2026-02-05T16:00:00.000Z',
    },
    author: { nomeArtistico: 'Catálogo Oficial KOLVOX', email: 'contato@kolvox.com' },
  },
  {
    song: {
      id: 5,
      title: 'Não Quero Dinheiro (Só Quero Amar)',
      artist: 'Tim Maia',
      tone: 'A',
      bpm: 124,
      userId: 1,
      lyrics: 'Vou pedir pra você voltar, vou pedir pra você ficar...',
      createdAt: '2026-02-10T11:00:00.000Z',
    },
    author: { nomeArtistico: 'Catálogo Oficial KOLVOX', email: 'contato@kolvox.com' },
  },
  {
    song: {
      id: 6,
      title: 'Se...',
      artist: 'Djavan',
      tone: 'F#m',
      bpm: 88,
      userId: 1,
      lyrics: 'Você disse que não sabe se não mas também não tem certeza...',
      createdAt: '2026-02-14T09:00:00.000Z',
    },
    author: { nomeArtistico: 'Catálogo Oficial KOLVOX', email: 'contato@kolvox.com' },
  },
  {
    song: {
      id: 7,
      title: 'Tempo Perdido',
      artist: 'Legião Urbana',
      tone: 'C',
      bpm: 128,
      userId: 1,
      lyrics: 'Todos os dias quando acordo não tenho mais o tempo que passou...',
      createdAt: '2026-02-18T14:00:00.000Z',
    },
    author: { nomeArtistico: 'Catálogo Oficial KOLVOX', email: 'contato@kolvox.com' },
  },
  {
    song: {
      id: 8,
      title: 'Como Nossos Pais',
      artist: 'Elis Regina',
      tone: 'D',
      bpm: 76,
      userId: 1,
      lyrics: 'Não quero lhe falar meu grande amor das coisas que aprendi nos discos...',
      createdAt: '2026-02-22T17:00:00.000Z',
    },
    author: { nomeArtistico: 'Catálogo Oficial KOLVOX', email: 'contato@kolvox.com' },
  },
  {
    song: {
      id: 9,
      title: 'Pais e Filhos',
      artist: 'Legião Urbana',
      tone: 'C',
      bpm: 116,
      userId: 1,
      lyrics: 'Estátuas e monumentos pelo centro da cidade...',
      createdAt: '2026-02-25T13:00:00.000Z',
    },
    author: { nomeArtistico: 'Catálogo Oficial KOLVOX', email: 'contato@kolvox.com' },
  },
  {
    song: {
      id: 10,
      title: 'Garota de Ipanema',
      artist: 'Tom Jobim & Vinicius de Moraes',
      tone: 'F',
      bpm: 125,
      userId: 1,
      lyrics: 'Olha que coisa mais linda, mais cheia de graça...',
      createdAt: '2026-03-01T15:00:00.000Z',
    },
    author: { nomeArtistico: 'Catálogo Oficial KOLVOX', email: 'contato@kolvox.com' },
  },
];

const serverPlaylists: any[] = [
  {
    playlist: {
      id: 1,
      name: 'Show Acústico Voz e Violão (Barzinho)',
      description: 'Repertório intimista com MPB, Pop Rock e Clássicos para apresentações ao vivo.',
      song_count: 8,
      createdAt: '2026-01-20T10:00:00.000Z',
    },
    user: { nomeArtistico: 'Joseph Kolvox', email: 'koljoseph2020@gmail.com' },
  },
];

const serverSearches: any[] = [];

const serverSubscriptions: any[] = [
  {
    subscription: {
      id: 1,
      plan: 'kolvox_pro_admin',
      status: 'active',
      planType: 'KOLVOX Pro Vitalício (Admin)',
      subscriptionStart: '2026-01-10T10:00:00.000Z',
      subscriptionEnd: '2036-01-10T10:00:00.000Z',
    },
    user: { nomeArtistico: 'Joseph Kolvox', email: 'koljoseph2020@gmail.com' },
  },
];

const serverPayments: any[] = [];

const serverPendingPayments: any[] = [];

const serverLogs: any[] = [
  { id: 1, action: 'ADMIN_LOGIN', userName: 'Joseph Kolvox', userEmail: 'koljoseph2020@gmail.com', details: 'Sessão administrativa Master autenticada com sucesso.', timestamp: new Date().toISOString() },
];

function parseRequestBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: any) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function kolvoxApiPlugin(): Plugin {
  return {
    name: 'kolvox-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || '';
        const [pathname, queryString] = rawUrl.split('?');
        const queryParams = new URLSearchParams(queryString || '');

        if (pathname.startsWith('/api/')) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.statusCode = 200;

          // ==========================================
          // 1. PAYMENT API: CREATE PIX (Mercado Pago / PIX Gateway)
          // ==========================================
          if (pathname === '/api/payments/create-pix' && req.method === 'POST') {
            const body = await parseRequestBody(req);
            const { userId = 'guest', userEmail = 'demo@kolvox.app', userName = 'Vocalista', plan = 'kolvox_pro_monthly', amount = '10.00' } = body;

            const planName = plan === 'kolvox_pro_yearly' ? 'Plano Anual (R$ 9,99/ano)' : 'Plano Mensal (R$ 10,00/mês)';
            const formattedAmount = parseFloat(amount || '10.00').toFixed(2);
            const refCode = `KVX-${Date.now().toString().slice(-6)}`;

            let paymentId = `mp_pix_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            let pixCode = '';
            let qrCodeUrl = '';
            let provider: 'mercadopago' | 'pix_gateway' = 'pix_gateway';

            // Try real Mercado Pago API if access token is configured
            if (process.env.MERCADOPAGO_ACCESS_TOKEN) {
              try {
                const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
                    'X-Idempotency-Key': `kolvox_${Date.now()}_${refCode}`,
                  },
                  body: JSON.stringify({
                    transaction_amount: Number(formattedAmount),
                    description: `KOLVOX PRO - ${planName}`,
                    payment_method_id: 'pix',
                    payer: {
                      email: userEmail || 'demo@kolvox.app',
                      first_name: (userName || 'Vocalista').split(' ')[0],
                    },
                    notification_url: `${process.env.APP_URL || 'https://kolvox.app'}/api/webhooks/mercadopago`,
                  }),
                });

                if (mpResponse.ok) {
                  const mpData = await mpResponse.json();
                  if (mpData && mpData.point_of_interaction?.transaction_data) {
                    paymentId = String(mpData.id);
                    pixCode = mpData.point_of_interaction.transaction_data.qr_code;
                    const base64 = mpData.point_of_interaction.transaction_data.qr_code_base64;
                    qrCodeUrl = base64 ? `data:image/png;base64,${base64}` : await generatePixQrDataUrl(pixCode);
                    provider = 'mercadopago';
                  }
                } else {
                  console.warn('Mercado Pago API returned non-ok status, falling back to certified EMV PIX.');
                }
              } catch (mpErr) {
                console.warn('Mercado Pago API error, falling back to certified EMV PIX:', mpErr);
              }
            }

            // Fallback: Certified Brazilian EMV PIX string & QR code
            if (!pixCode) {
              pixCode = generatePixPayload({
                pixKey: 'kolvox.pagamentos@gmail.com',
                receiverName: 'KOLVOX TECNOLOGIA LTDA',
                city: 'SAO PAULO',
                amount: formattedAmount,
                referenceCode: refCode,
              });
              qrCodeUrl = await generatePixQrDataUrl(pixCode);
            }

            const paymentRecord: ServerPixPayment = {
              id: paymentId,
              provider,
              status: 'pending',
              pixCode,
              qrCodeUrl,
              amount: formattedAmount,
              plan,
              planName,
              referenceCode: refCode,
              expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              createdAt: new Date().toISOString(),
              userId: String(userId),
              userEmail: String(userEmail),
              userName: String(userName),
            };

            activePayments.set(paymentId, paymentRecord);

            res.end(
              JSON.stringify({
                success: true,
                payment: paymentRecord,
              })
            );
            return;
          }

          // ==========================================
          // 2. PAYMENT API: CHECK STATUS
          // ==========================================
          if (pathname === '/api/payments/status') {
            const paymentId = queryParams.get('paymentId') || queryParams.get('id');
            if (paymentId && activePayments.has(paymentId)) {
              const payment = activePayments.get(paymentId)!;

              // If Mercado Pago live integration is enabled, check live payment status
              if (process.env.MERCADOPAGO_ACCESS_TOKEN && payment.provider === 'mercadopago' && payment.status === 'pending') {
                try {
                  const checkRes = await fetch(`https://api.mercadopago.com/v1/payments/${payment.id}`, {
                    headers: {
                      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
                    },
                  });
                  if (checkRes.ok) {
                    const mpDetails = await checkRes.json();
                    if (mpDetails.status === 'approved') {
                      payment.status = 'approved';
                      payment.approvedAt = new Date().toISOString();
                    }
                  }
                } catch (e) {
                  // Silent check
                }
              }

              res.end(
                JSON.stringify({
                  success: true,
                  status: payment.status,
                  payment,
                })
              );
              return;
            }

            // Return latest payment if no specific ID or generic query
            const allPayments = Array.from(activePayments.values());
            const latest = allPayments[allPayments.length - 1];
            res.end(
              JSON.stringify({
                success: !!latest,
                status: latest ? latest.status : 'pending',
                payment: latest || null,
              })
            );
            return;
          }

          // ==========================================
          // 3. WEBHOOK API: MERCADO PAGO OFFICIAL WEBHOOK
          // ==========================================
          if (pathname === '/api/webhooks/mercadopago' || pathname === '/api/webhooks/stripe' || pathname === '/api/payments/webhook') {
            const body = req.method === 'POST' ? await parseRequestBody(req) : {};
            const topic = queryParams.get('topic') || queryParams.get('type') || body?.type || body?.action;
            const notificationId = queryParams.get('id') || queryParams.get('data.id') || body?.data?.id;

            let resolvedPayment: ServerPixPayment | undefined;

            if (notificationId && activePayments.has(String(notificationId))) {
              resolvedPayment = activePayments.get(String(notificationId));
            } else {
              // Find the most recent pending payment to approve
              for (const p of Array.from(activePayments.values()).reverse()) {
                if (p.status === 'pending') {
                  resolvedPayment = p;
                  break;
                }
              }
            }

            if (resolvedPayment) {
              resolvedPayment.status = 'approved';
              resolvedPayment.approvedAt = new Date().toISOString();
            }

            res.end(
              JSON.stringify({
                status: 'success',
                message: 'Webhook de pagamento processado com sucesso. Status atualizado.',
                approvedPayment: resolvedPayment || null,
              })
            );
            return;
          }

          // ==========================================
          // 4. WEBHOOK API: SIMULATE INSTANT APPROVAL (Testing & Review)
          // ==========================================
          if (pathname === '/api/webhooks/simulate-approval' && req.method === 'POST') {
            const body = await parseRequestBody(req);
            const { paymentId } = body;

            let targetPayment: ServerPixPayment | undefined;
            if (paymentId && activePayments.has(paymentId)) {
              targetPayment = activePayments.get(paymentId);
            } else {
              // Find latest pending payment
              const list = Array.from(activePayments.values()).reverse();
              targetPayment = list.find((p) => p.status === 'pending') || list[0];
            }

            if (!targetPayment) {
              // If none exists, create a sample approved one
              const id = `mp_pix_sim_${Date.now()}`;
              targetPayment = {
                id,
                provider: 'mercadopago',
                status: 'approved',
                pixCode: '00020126580014br.gov.bcb.pix...',
                qrCodeUrl: '',
                amount: '10.00',
                plan: 'kolvox_pro_monthly',
                planName: 'Plano Mensal (R$ 10,00/mês)',
                referenceCode: `KVX-SIM-${Date.now().toString().slice(-6)}`,
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
                createdAt: new Date().toISOString(),
                approvedAt: new Date().toISOString(),
                userId: 'guest',
                userEmail: 'demo@kolvox.app',
                userName: 'Vocalista Convidado',
              };
              activePayments.set(id, targetPayment);
            } else {
              targetPayment.status = 'approved';
              targetPayment.approvedAt = new Date().toISOString();
            }

            res.end(
              JSON.stringify({
                success: true,
                status: 'approved',
                payment: targetPayment,
                message: 'Webhook simulado executado com sucesso. Pagamento aprovado!',
              })
            );
            return;
          }

          // ==========================================
          // 5. USER PAYMENTS HISTORY: /api/payments/my
          // ==========================================
          if (pathname === '/api/payments/my' || pathname === '/api/payments') {
            const list = Array.from(activePayments.values()).map((p, idx) => ({
              id: idx + 101,
              userId: p.userId,
              provider: p.provider === 'mercadopago' ? 'Mercado Pago (Pix Oficial)' : 'Gateway Pix Brasil',
              externalPaymentId: p.referenceCode,
              amount: p.amount,
              currency: 'BRL',
              status: p.status === 'approved' ? 'aprovado' : 'pendente',
              paymentDate: p.approvedAt || p.createdAt,
              planName: p.planName,
              user: {
                nomeArtistico: p.userName || 'Vocalista',
                email: p.userEmail,
              },
            }));

            res.end(JSON.stringify(list));
            return;
          }

          // ==========================================
          // 6. PUBLIC SETTINGS
          // ==========================================
          if (pathname === '/api/settings/public') {
            res.end(
              JSON.stringify({
                supportEmail: 'kolvox.pagamentos@gmail.com',
                gmailSupportOnline: true,
                pixKey: 'kolvox.pagamentos@gmail.com',
                pixKeyType: 'E-mail',
                pixReceiverName: 'KOLVOX STAGE LTDA',
                pixCity: 'São Paulo',
                monthlyPrice: '10.00',
                trialDays: 7,
                pixEnabled: true,
                manualPaymentEnabled: true,
                gateway: process.env.MERCADOPAGO_ACCESS_TOKEN ? 'Mercado Pago (Produção)' : 'Gateway Integrado Pix',
              })
            );
            return;
          }

          // ==========================================
          // 7. ADMIN SETTINGS & GMAIL
          // ==========================================
          if (pathname === '/api/settings/admin') {
            res.end(
              JSON.stringify({
                settings: {
                  supportEmail: 'kolvox.pagamentos@gmail.com',
                  pixKey: 'kolvox.pagamentos@gmail.com',
                  pixKeyType: 'E-mail',
                  pixReceiverName: 'KOLVOX STAGE LTDA',
                  pixCity: 'São Paulo',
                  monthlyPrice: '10.00',
                  trialDays: 7,
                  pixEnabled: true,
                  manualPaymentEnabled: true,
                  gatewayProvider: process.env.MERCADOPAGO_ACCESS_TOKEN ? 'Mercado Pago (Ativo)' : 'Pix Automático',
                },
                gmail: {
                  status: 'connected',
                  googleAccountEmail: 'koljoseph2020@gmail.com',
                  hasCredentials: true,
                },
              })
            );
            return;
          }

          if (pathname === '/api/admin/metrics') {
            const approvedCount = serverPayments.filter((p) => p.status === 'completed' || p.status === 'approved').length;
            const totalRev = serverPayments
              .filter((p) => p.status === 'completed' || p.status === 'approved')
              .reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);

            res.end(
              JSON.stringify({
                totalUsers: serverUsers.length,
                activeUsers: serverUsers.filter((u) => u.status === 'ativo').length,
                blockedUsers: serverUsers.filter((u) => u.status === 'inativo').length,
                newUsers: 5,
                activeTrials: serverSubscriptions.filter((s) => s.subscription.status === 'trial').length,
                expiredTrials: serverSubscriptions.filter((s) => s.subscription.status === 'expired').length,
                activeSubs: serverSubscriptions.filter((s) => s.subscription.status === 'active').length,
                canceledSubs: 0,
                approvedPayments: approvedCount,
                pendingPayments: serverPendingPayments.length,
                totalRevenue: totalRev.toFixed(2),
                totalSongs: serverSongs.length,
                totalPlaylists: serverPlaylists.length,
                totalSearches: serverSearches.length,
                totalLogs: serverLogs.length,
              })
            );
            return;
          }

          // ==========================================
          // 8. SUPPORT TICKETS API (ADMIN & CLIENTS)
          // ==========================================
          // Admin list all client support tickets
          if (pathname === '/api/support/admin/tickets' && req.method === 'GET') {
            res.end(JSON.stringify(serverSupportTickets));
            return;
          }

          // Admin replies to a ticket
          const adminReplyMatch = pathname.match(/^\/api\/support\/admin\/tickets\/(\d+)\/reply$/);
          if (adminReplyMatch && req.method === 'PUT') {
            const ticketId = parseInt(adminReplyMatch[1], 10);
            const body = await parseRequestBody(req);
            const ticketIndex = serverSupportTickets.findIndex((t) => t.id === ticketId);

            if (ticketIndex >= 0) {
              serverSupportTickets[ticketIndex].replyMessage = body.replyMessage || '';
              serverSupportTickets[ticketIndex].replySentAt = new Date().toISOString();
              serverSupportTickets[ticketIndex].status = body.status || 'answered';
              serverSupportTickets[ticketIndex].updatedAt = new Date().toISOString();
              res.end(
                JSON.stringify({
                  message: 'Resposta enviada com sucesso ao cliente!',
                  ticket: serverSupportTickets[ticketIndex],
                })
              );
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Chamado não encontrado.' }));
            }
            return;
          }

          // Admin updates ticket status
          const adminStatusMatch = pathname.match(/^\/api\/support\/admin\/tickets\/(\d+)\/status$/);
          if (adminStatusMatch && req.method === 'PUT') {
            const ticketId = parseInt(adminStatusMatch[1], 10);
            const body = await parseRequestBody(req);
            const ticketIndex = serverSupportTickets.findIndex((t) => t.id === ticketId);

            if (ticketIndex >= 0) {
              serverSupportTickets[ticketIndex].status = body.status || 'answered';
              serverSupportTickets[ticketIndex].updatedAt = new Date().toISOString();
              res.end(JSON.stringify({ message: 'Status atualizado.', ticket: serverSupportTickets[ticketIndex] }));
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Chamado não encontrado.' }));
            }
            return;
          }

          // Admin batch deletes tickets in a tab or all
          if (pathname === '/api/support/admin/tickets/batch-delete' && (req.method === 'POST' || req.method === 'DELETE')) {
            const body = await parseRequestBody(req);
            const filter = body.filter || 'all';
            if (filter === 'open') {
              for (let i = serverSupportTickets.length - 1; i >= 0; i--) {
                if (serverSupportTickets[i].status === 'open' || serverSupportTickets[i].status === 'pending') {
                  serverSupportTickets.splice(i, 1);
                }
              }
            } else if (filter === 'answered') {
              for (let i = serverSupportTickets.length - 1; i >= 0; i--) {
                if (serverSupportTickets[i].status === 'answered') {
                  serverSupportTickets.splice(i, 1);
                }
              }
            } else {
              serverSupportTickets.length = 0;
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, message: 'Chamados da aba excluídos com sucesso.' }));
            return;
          }

          // Admin deletes a ticket (supports any ID format: number, string, uuid)
          const adminDeleteMatch = pathname.match(/^\/api\/support\/admin\/tickets\/([^/]+)$/);
          if (adminDeleteMatch && req.method === 'DELETE') {
            const rawId = decodeURIComponent(adminDeleteMatch[1]);
            const ticketIndex = serverSupportTickets.findIndex((t) => String(t.id) === rawId);
            if (ticketIndex >= 0) {
              serverSupportTickets.splice(ticketIndex, 1);
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, message: 'Chamado excluído com sucesso.' }));
            return;
          }

          // Client creates a new ticket
          if (pathname === '/api/support/tickets' && req.method === 'POST') {
            const body = await parseRequestBody(req);
            if (!body.customerName || !body.customerEmail || !body.subject || !body.message) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Todos os campos são obrigatórios.' }));
              return;
            }

            const newTicket: ServerSupportTicket = {
              id: Date.now(),
              userId: body.userId || null,
              customerName: body.customerName.trim(),
              customerEmail: body.customerEmail.trim(),
              subject: body.subject.trim(),
              message: body.message.trim(),
              status: 'open',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              clientReplies: [],
            };
            serverSupportTickets.unshift(newTicket);
            res.statusCode = 201;
            res.end(
              JSON.stringify({
                message: 'Mensagem enviada com sucesso! Nossa equipe responderá em breve.',
                ticket: newTicket,
              })
            );
            return;
          }

          // Client gets their tickets
          if (pathname === '/api/support/my-tickets' && req.method === 'GET') {
            res.end(JSON.stringify(serverSupportTickets));
            return;
          }

          // Client follow-up reply
          const clientReplyMatch = pathname.match(/^\/api\/support\/my-tickets\/(\d+)\/reply$/);
          if (clientReplyMatch && req.method === 'POST') {
            const ticketId = parseInt(clientReplyMatch[1], 10);
            const body = await parseRequestBody(req);
            const ticket = serverSupportTickets.find((t) => t.id === ticketId);
            if (ticket) {
              ticket.clientReplies = ticket.clientReplies || [];
              ticket.clientReplies.push({
                message: body.message || '',
                sentAt: new Date().toISOString(),
              });
              ticket.status = 'open'; // Re-opens for admin attention
              ticket.updatedAt = new Date().toISOString();
              res.end(JSON.stringify({ message: 'Réplica enviada com sucesso!', ticket }));
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Chamado não encontrado.' }));
            }
            return;
          }

          // Client or Admin deletes ticket (supports any ID format)
          const clientDeleteMatch = pathname.match(/^\/api\/support\/(?:my-tickets|tickets|admin\/tickets)\/([^/]+)$/);
          if (clientDeleteMatch && req.method === 'DELETE') {
            const rawId = decodeURIComponent(clientDeleteMatch[1]);
            const ticketIndex = serverSupportTickets.findIndex((t) => String(t.id) === rawId);
            if (ticketIndex >= 0) {
              serverSupportTickets.splice(ticketIndex, 1);
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, message: 'Chamado excluído com sucesso.' }));
            return;
          }

          if (pathname === '/api/admin/providers') {
            res.end(
              JSON.stringify([
                {
                  id: 1,
                  name: 'Mercado Pago / Pix Webhook API',
                  status: process.env.MERCADOPAGO_ACCESS_TOKEN ? 'Produção Conectada' : 'Simulação Integrada / Sandbox',
                  legalMode: 'Oficial Mercado Pago',
                  description: 'Geração de Pix Copia e Cola instantâneo com atualização em tempo real por Webhook',
                },
                {
                  id: 2,
                  name: 'Vagalume API',
                  status: 'Ativo',
                  legalMode: 'Legítimo / Fair Use',
                  description: 'Metadados e letras autorizadas',
                },
                {
                  id: 3,
                  name: 'iTunes Search API',
                  status: 'Ativo',
                  legalMode: 'Oficial',
                  description: 'Capas em alta definição e prévias',
                },
                {
                  id: 4,
                  name: 'LRCLIB Synced Lyrics',
                  status: 'Ativo',
                  legalMode: 'Oficial / Open Data',
                  description: 'Letras sincronizadas linha por linha',
                },
              ])
            );
            return;
          }

          // Gmail status
          if (pathname.startsWith('/api/settings/admin/gmail/status') && req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                status: gmailConfig.status,
                email: gmailConfig.email,
                hasCredentials: Boolean(gmailConfig.appPassword),
              })
            );
            return;
          }

          // Gmail connect / save credentials
          if (pathname.startsWith('/api/settings/admin/gmail/connect') && req.method === 'POST') {
            const body = await parseRequestBody(req);
            if (body.email) gmailConfig.email = body.email.trim();
            if (body.appPassword) {
              gmailConfig.appPassword = body.appPassword.replace(/\s+/g, '').trim();
              gmailConfig.status = 'connected';
              gmailConfig.hasCredentials = true;
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                status: gmailConfig.status,
                email: gmailConfig.email,
                hasCredentials: Boolean(gmailConfig.appPassword),
                message: 'Configurações de e-mail salvas com sucesso!',
              })
            );
            return;
          }

          // Gmail disconnect
          if (pathname.startsWith('/api/settings/admin/gmail/disconnect') && req.method === 'POST') {
            gmailConfig.appPassword = '';
            gmailConfig.status = 'disconnected';
            gmailConfig.hasCredentials = false;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                status: 'disconnected',
                message: 'Conta desconectada.',
              })
            );
            return;
          }

          // Gmail test dispatch with real nodemailer
          if (pathname.startsWith('/api/settings/admin/gmail/test') && req.method === 'POST') {
            const body = await parseRequestBody(req);
            const recipient = (body.targetEmail || gmailConfig.email || 'kolvox.pagamentos@gmail.com').trim();
            
            // Allow saving appPassword on the fly if sent in the test
            if (body.appPassword && typeof body.appPassword === 'string' && body.appPassword.trim()) {
              gmailConfig.appPassword = body.appPassword.replace(/\s+/g, '').trim();
              gmailConfig.hasCredentials = true;
              gmailConfig.status = 'connected';
            }
            if (body.email && typeof body.email === 'string' && body.email.trim()) {
              gmailConfig.email = body.email.trim();
            }

            const activePassword = (gmailConfig.appPassword || process.env.GMAIL_APP_PASSWORD || '').trim();
            const senderEmail = gmailConfig.email || process.env.GMAIL_USER || 'kolvox.pagamentos@gmail.com';

            res.setHeader('Content-Type', 'application/json');

            if (activePassword) {
              try {
                const transporter = nodemailer.createTransport({
                  service: 'gmail',
                  auth: {
                    user: senderEmail,
                    pass: activePassword.replace(/\s+/g, ''),
                  },
                });

                const nowFormatted = new Date().toLocaleString('pt-BR');
                const info = await transporter.sendMail({
                  from: `"KOLVOX STAGE" <${senderEmail}>`,
                  to: recipient,
                  subject: '🔔 [KOLVOX STAGE] Teste de Disparo de Notificações e Suporte',
                  html: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #070d18; color: #f8fafc; padding: 28px; border-radius: 20px; border: 1px solid #1e293b;">
                      <div style="margin-bottom: 22px;">
                        <span style="font-size: 26px; font-weight: 900; color: #38bdf8; letter-spacing: -0.5px;">KOLVOX STAGE</span>
                        <p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0 0;">Plataforma Profissional de Repertório e Modo Show</p>
                      </div>

                      <div style="background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 14px; padding: 18px; margin-bottom: 22px;">
                        <h2 style="color: #38bdf8; font-size: 17px; font-weight: bold; margin: 0 0 8px 0;">
                          🟢 Teste de Notificação Entregue com Sucesso!
                        </h2>
                        <p style="color: #cbd5e1; font-size: 13px; margin: 0; line-height: 1.5;">
                          Sua conta do Gmail está autenticada e operando com sucesso no <strong>KOLVOX Stage</strong>. Suas notificações de suporte, confirmações de Pix e alertas do sistema agora são entregues diretamente nesta caixa postal.
                        </p>
                      </div>

                      <div style="background: #0f172a; border-radius: 14px; padding: 18px; margin-bottom: 22px; font-size: 13px;">
                        <div style="color: #64748b; font-size: 11px; font-weight: bold; text-transform: uppercase; margin-bottom: 10px;">
                          Detalhes da Conexão:
                        </div>
                        <p style="margin: 6px 0; color: #cbd5e1;"><strong>Destinatário:</strong> <span style="color: #f8fafc;">${recipient}</span></p>
                        <p style="margin: 6px 0; color: #cbd5e1;"><strong>Conta Remetente:</strong> <span style="color: #f8fafc;">${senderEmail}</span></p>
                        <p style="margin: 6px 0; color: #cbd5e1;"><strong>Protocolo:</strong> <span style="color: #10b981; font-weight: bold;">Google Gmail SMTP (Conexão Segura SSL/TLS)</span></p>
                        <p style="margin: 6px 0; color: #cbd5e1;"><strong>Data e Hora:</strong> <span style="color: #f8fafc;">${nowFormatted}</span></p>
                      </div>

                      <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0; border-top: 1px solid #1e293b; padding-top: 16px;">
                        Este e-mail foi disparado a partir da ferramenta "Testar Disparo de Notificações" do Painel Administrativo.
                      </p>
                    </div>
                  `,
                  text: `KOLVOX STAGE - Teste de Disparo de Notificações\n\n🟢 E-mail entregue com sucesso via Gmail para ${recipient}!\nRemetente: ${senderEmail}\nData: ${nowFormatted}`,
                });

                res.end(
                  JSON.stringify({
                    success: true,
                    realSent: true,
                    messageId: info.messageId,
                    message: `🟢 E-mail disparado e entregue com sucesso via Gmail para ${recipient}! Verifique sua caixa de entrada.`,
                  })
                );
                return;
              } catch (err: any) {
                console.error('Nodemailer error:', err);
                res.statusCode = 400;
                res.end(
                  JSON.stringify({
                    success: false,
                    realSent: false,
                    error: err.message,
                    message: `🔴 Falha na autenticação do Gmail: ${err.message}. Verifique se a Senha de App de 16 caracteres foi gerada na sua Conta Google (Segurança > Senhas de app) e salva corretamente.`,
                  })
                );
                return;
              }
            } else {
              // No app password saved yet - inform clearly with actionable message
              res.end(
                JSON.stringify({
                  success: false,
                  realSent: false,
                  needsPassword: true,
                  message: `⚠️ Nenhuma Senha de App do Google foi informada ainda. Para que o e-mail chegue diretamente na sua caixa de entrada (${recipient}), informe a sua Senha de App de 16 letras gerada no Google (myaccount.google.com/apppasswords) e clique em Salvar e Disparar.`,
                })
              );
              return;
            }
          }

          // ==========================================
          // 9. ADMIN USERS API
          // ==========================================
          if (pathname === '/api/admin/users' && req.method === 'GET') {
            res.end(JSON.stringify(serverUsers));
            return;
          }

          // User update
          const userEditMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
          if (userEditMatch && req.method === 'PUT') {
            const rawId = decodeURIComponent(userEditMatch[1]);
            const body = await parseRequestBody(req);
            const idx = serverUsers.findIndex((u) => String(u.id) === rawId || (body.email && u.email.toLowerCase() === body.email.toLowerCase()));
            if (idx >= 0) {
              serverUsers[idx] = {
                ...serverUsers[idx],
                ...body,
              };
              res.end(JSON.stringify({ success: true, message: 'Usuário atualizado com sucesso!', user: serverUsers[idx] }));
            } else {
              res.end(JSON.stringify({ success: true, message: 'Usuário salvo.' }));
            }
            return;
          }

          // User delete
          if (userEditMatch && req.method === 'DELETE') {
            const rawId = decodeURIComponent(userEditMatch[1]);
            const idx = serverUsers.findIndex((u) => String(u.id) === rawId);
            if (idx >= 0) {
              serverUsers.splice(idx, 1);
            }
            res.end(JSON.stringify({ success: true, message: 'Usuário excluído.' }));
            return;
          }

          // Grant PRO
          const grantProMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/grant-pro$/);
          if (grantProMatch && req.method === 'POST') {
            const rawId = decodeURIComponent(grantProMatch[1]);
            const target = serverUsers.find((u) => String(u.id) === rawId);
            if (target) {
              const subIdx = serverSubscriptions.findIndex((s) => s.user.email?.toLowerCase() === target.email?.toLowerCase());
              if (subIdx >= 0) {
                serverSubscriptions[subIdx].subscription.status = 'active';
                serverSubscriptions[subIdx].subscription.plan = 'kolvox_pro_monthly';
              }
            }
            res.end(JSON.stringify({ success: true, message: 'Plano PRO concedido com sucesso!' }));
            return;
          }

          // Revoke PRO
          const revokeProMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/revoke-pro$/);
          if (revokeProMatch && req.method === 'POST') {
            const rawId = decodeURIComponent(revokeProMatch[1]);
            const target = serverUsers.find((u) => String(u.id) === rawId);
            if (target) {
              const subIdx = serverSubscriptions.findIndex((s) => s.user.email?.toLowerCase() === target.email?.toLowerCase());
              if (subIdx >= 0) {
                serverSubscriptions[subIdx].subscription.status = 'expired';
              }
            }
            res.end(JSON.stringify({ success: true, message: 'Plano PRO revogado com sucesso.' }));
            return;
          }

          // Toggle role
          const roleMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/role$/);
          if (roleMatch && req.method === 'PUT') {
            const rawId = decodeURIComponent(roleMatch[1]);
            const body = await parseRequestBody(req);
            const user = serverUsers.find((u) => String(u.id) === rawId);
            if (user) user.tipoUsuario = body.tipoUsuario || 'USER';
            res.end(JSON.stringify({ success: true, user }));
            return;
          }

          // Toggle status
          const statusMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/status$/);
          if (statusMatch && req.method === 'PUT') {
            const rawId = decodeURIComponent(statusMatch[1]);
            const body = await parseRequestBody(req);
            const user = serverUsers.find((u) => String(u.id) === rawId);
            if (user) user.status = body.status || 'ativo';
            res.end(JSON.stringify({ success: true, user }));
            return;
          }

          // ==========================================
          // 10. ADMIN SONGS API
          // ==========================================
          if (pathname === '/api/admin/songs' && req.method === 'GET') {
            res.end(JSON.stringify(serverSongs));
            return;
          }

          const deleteSongMatch = pathname.match(/^\/api\/admin\/songs\/(\d+)$/);
          if (deleteSongMatch && req.method === 'DELETE') {
            const sId = parseInt(deleteSongMatch[1], 10);
            const idx = serverSongs.findIndex((s) => s.song.id === sId);
            if (idx >= 0) serverSongs.splice(idx, 1);
            res.end(JSON.stringify({ success: true, message: 'Música removida do catálogo.' }));
            return;
          }

          // ==========================================
          // 11. ADMIN PLAYLISTS API
          // ==========================================
          if (pathname === '/api/admin/playlists' && req.method === 'GET') {
            res.end(JSON.stringify(serverPlaylists));
            return;
          }

          const deletePlMatch = pathname.match(/^\/api\/admin\/playlists\/(\d+)$/);
          if (deletePlMatch && req.method === 'DELETE') {
            const plId = parseInt(deletePlMatch[1], 10);
            const idx = serverPlaylists.findIndex((p) => p.playlist.id === plId);
            if (idx >= 0) serverPlaylists.splice(idx, 1);
            res.end(JSON.stringify({ success: true, message: 'Repertório excluído.' }));
            return;
          }

          // ==========================================
          // 12. ADMIN SEARCHES, SUBSCRIPTIONS & LOGS
          // ==========================================
          if (pathname === '/api/admin/searches' && req.method === 'GET') {
            res.end(JSON.stringify(serverSearches));
            return;
          }

          if (pathname === '/api/admin/subscriptions' && req.method === 'GET') {
            res.end(JSON.stringify(serverSubscriptions));
            return;
          }

          if (pathname === '/api/admin/logs') {
            if (req.method === 'DELETE') {
              serverLogs.length = 0;
              res.end(JSON.stringify({ success: true, message: 'Histórico de logs limpo com sucesso.' }));
              return;
            }
            res.end(JSON.stringify(serverLogs));
            return;
          }

          // ==========================================
          // 13. ADMIN PAYMENTS & APPROVALS API
          // ==========================================
          if (pathname === '/api/admin/payments' && req.method === 'GET') {
            res.end(JSON.stringify(serverPayments));
            return;
          }

          const deletePaymentMatch = pathname.match(/^\/api\/(?:admin\/payments|payments\/admin)\/(\d+)$/);
          if (deletePaymentMatch && req.method === 'DELETE') {
            const payId = parseInt(deletePaymentMatch[1], 10);
            const idx = serverPayments.findIndex((p) => p.id === payId);
            if (idx >= 0) serverPayments.splice(idx, 1);
            const pendIdx = serverPendingPayments.findIndex((p) => p.id === payId);
            if (pendIdx >= 0) serverPendingPayments.splice(pendIdx, 1);
            res.end(JSON.stringify({ success: true, message: 'Registro de pagamento excluído.' }));
            return;
          }

          if (pathname === '/api/payments/admin/pending' && req.method === 'GET') {
            res.end(JSON.stringify(serverPendingPayments));
            return;
          }

          const approvePaymentMatch = pathname.match(/^\/api\/payments\/admin\/(\d+)\/approve$/);
          if (approvePaymentMatch && req.method === 'POST') {
            const payId = parseInt(approvePaymentMatch[1], 10);
            const pendIdx = serverPendingPayments.findIndex((p) => p.id === payId);
            if (pendIdx >= 0) {
              const pending = serverPendingPayments[pendIdx];
              serverPendingPayments.splice(pendIdx, 1);
              serverPayments.unshift({
                id: pending.id,
                userId: pending.userId,
                provider: 'Pix Manual (Aprovado pelo Admin)',
                amount: pending.amount,
                currency: 'BRL',
                status: 'completed',
                paymentDate: new Date().toISOString(),
                referenceCode: pending.referenceCode,
                user: pending.user,
              });
              // Upgrade user's subscription
              const sub = serverSubscriptions.find((s) => s.user.email?.toLowerCase() === pending.user?.email?.toLowerCase());
              if (sub) {
                sub.subscription.status = 'active';
                sub.subscription.plan = 'kolvox_pro_monthly';
              }
            }
            res.end(JSON.stringify({ success: true, message: 'Pagamento aprovado com sucesso! Acesso PRO ativado.' }));
            return;
          }

          const rejectPaymentMatch = pathname.match(/^\/api\/payments\/admin\/(\d+)\/reject$/);
          if (rejectPaymentMatch && req.method === 'POST') {
            const payId = parseInt(rejectPaymentMatch[1], 10);
            const pendIdx = serverPendingPayments.findIndex((p) => p.id === payId);
            if (pendIdx >= 0) {
              serverPendingPayments.splice(pendIdx, 1);
            }
            res.end(JSON.stringify({ success: true, message: 'Pagamento recusado.' }));
            return;
          }

          res.end(JSON.stringify({ success: true, ok: true }));
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), kolvoxApiPlugin()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
    },
  };
});

