import { Router, type Response } from 'express';
import { desc, eq, and } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import * as schema from '../../db/schema.ts';
import { requireAuth, requireAdmin, type AuthRequest } from '../middleware/auth.ts';
import { generatePixCharge } from '../utils/pix.ts';
import { notifyPaymentApprovedAndProActivated } from '../services/emailService.ts';

const router = Router();

// POST /api/payments/pix-charge - Create an official Pix charge with real BR Code & QR Code
router.post('/pix-charge', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { plan = 'kolvox_pro_monthly' } = req.body;

    // Get current configured settings
    const [settings] = await db.select().from(schema.appSettings).limit(1);

    const pixKey = settings?.pixKey?.trim() || 'kolvox.pagamentos@gmail.com';
    const receiverName = settings?.pixReceiverName?.trim() || 'KOLVOX STAGE';
    const city = settings?.pixCity?.trim() || 'SAO PAULO';

    let amount = 9.99;
    const baseMonthly = settings?.monthlyPrice ? parseFloat(settings.monthlyPrice) : 9.99;
    if (plan === 'kolvox_pro_yearly') {
      amount = 99.99;
    } else {
      amount = isNaN(baseMonthly) || baseMonthly === 10 ? 9.99 : baseMonthly;
    }

    if (isNaN(amount) || amount <= 0) amount = 9.99;

    // Unique charge reference ID (TxID)
    const chargeId = `KVX${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Generate real Pix EMV payload and QR code
    const generated = await generatePixCharge({
      pixKey,
      receiverName,
      city,
      amount,
      txId: chargeId,
      description: `KOLVOX STAGE PRO ${plan === 'kolvox_pro_yearly' ? 'ANUAL' : 'MENSAL'}`,
    });

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes expiration

    // Persist pending payment in database
    const [payment] = await db
      .insert(schema.payments)
      .values({
        userId,
        provider: 'PIX_GATEWAY',
        externalPaymentId: chargeId,
        amount: amount.toFixed(2),
        currency: 'BRL',
        status: 'pending',
        referenceCode: chargeId,
        proofNote: `Cobrança Pix gerada para o plano ${plan}`,
        payerName: req.user!.nomeCompleto,
        paymentDate: new Date(),
      })
      .returning();

    // Audit log
    await db.insert(schema.activityLogs).values({
      userId,
      action: 'COBRANCA_PIX_GERADA',
      ip: req.ip || '127.0.0.1',
      metadata: JSON.stringify({
        chargeId,
        amount: payment.amount,
        plan,
      }),
    });

    return res.status(201).json({
      chargeId,
      amount: payment.amount,
      plan,
      pixCode: generated.pixCode,
      qrCodeUrl: generated.qrCodeUrl,
      status: 'pending',
      expiresAt: expiresAt.toISOString(),
      pixKey,
      receiverName,
    });
  } catch (error) {
    console.error('Error generating pix charge:', error);
    return res.status(500).json({ error: 'Erro ao gerar cobrança Pix.' });
  }
});

// GET /api/payments/status - Check status either by query param or user's latest payment
router.get('/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const chargeId = (req.query.paymentId || req.query.chargeId) as string | undefined;
    const userId = req.user!.id;

    let payment;
    if (chargeId) {
      [payment] = await db
        .select()
        .from(schema.payments)
        .where(and(eq(schema.payments.externalPaymentId, chargeId), eq(schema.payments.userId, userId)))
        .limit(1);
    }

    if (!payment) {
      // Find latest payment for this user
      [payment] = await db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.userId, userId))
        .orderBy(desc(schema.payments.createdAt))
        .limit(1);
    }

    // Also check if user has an active subscription in subscriptions table
    const [sub] = await db
      .select()
      .from(schema.subscriptions)
      .where(and(eq(schema.subscriptions.userId, userId), eq(schema.subscriptions.status, 'active')))
      .limit(1);

    if (sub || (payment && (payment.status === 'completed' || payment.status === 'approved'))) {
      return res.json({
        status: 'approved',
        isApproved: true,
        paymentConfirmed: true,
        message: 'Pagamento reconhecido e confirmado pelo banco/administrador!',
        paidAt: payment?.updatedAt || sub?.updatedAt,
      });
    }

    return res.json({
      status: payment?.status || 'pending',
      isApproved: false,
      paymentConfirmed: false,
      message: 'Aguardando reconhecimento bancário do Pix...',
    });
  } catch (error) {
    console.error('Error in status check:', error);
    return res.status(500).json({ error: 'Erro ao verificar status.' });
  }
});

// GET /api/payments/status/:chargeId - Check real payment status (used by client polling)
router.get('/status/:chargeId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { chargeId } = req.params;
    const userId = req.user!.id;

    const [payment] = await db
      .select()
      .from(schema.payments)
      .where(and(eq(schema.payments.externalPaymentId, chargeId), eq(schema.payments.userId, userId)))
      .limit(1);

    if (!payment) {
      return res.status(404).json({ error: 'Cobrança não encontrada.' });
    }

    if (payment.status === 'completed' || payment.status === 'approved') {
      return res.json({
        chargeId,
        status: 'approved',
        isApproved: true,
        message: 'Pagamento aprovado! Assinatura ativada com sucesso.',
        paidAt: payment.updatedAt,
      });
    }

    if (payment.status === 'rejected') {
      return res.json({
        chargeId,
        status: 'rejected',
        isApproved: false,
        message: 'Pagamento recusado pela instituição financeira.',
      });
    }

    // Check if expired (> 35 mins old)
    const ageMs = Date.now() - new Date(payment.createdAt).getTime();
    if (ageMs > 35 * 60 * 1000) {
      await db
        .update(schema.payments)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(schema.payments.id, payment.id));

      return res.json({
        chargeId,
        status: 'expired',
        isApproved: false,
        message: 'Cobrança Pix expirada. Por favor, gere uma nova cobrança.',
      });
    }

    return res.json({
      chargeId,
      status: 'pending',
      isApproved: false,
      message: 'Aguardando confirmação do pagamento pelo banco...',
    });
  } catch (error) {
    console.error('Error checking payment status:', error);
    return res.status(500).json({ error: 'Erro ao verificar status do pagamento.' });
  }
});

// POST /api/payments/simulate-bank-approval - Webhook tester for live QA
// Validates end-to-end webhook processing without requiring real money transfer
router.post('/simulate-bank-approval', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { chargeId } = req.body;
    if (!chargeId) {
      return res.status(400).json({ error: 'chargeId é obrigatório.' });
    }

    const [payment] = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.externalPaymentId, chargeId))
      .limit(1);

    if (!payment) {
      return res.status(404).json({ error: 'Cobrança não encontrada.' });
    }

    const now = new Date();
    const daysToAdd = payment.amount && parseFloat(payment.amount) > 50 ? 365 : 30;
    const subscriptionEnd = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

    // Update payment to completed
    const [updatedPayment] = await db
      .update(schema.payments)
      .set({
        status: 'completed',
        updatedAt: now,
      })
      .where(eq(schema.payments.id, payment.id))
      .returning();

    // Activate subscription
    const [existingSub] = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, payment.userId))
      .limit(1);

    const planName = daysToAdd > 30 ? 'kolvox_pro_yearly' : 'kolvox_pro_monthly';

    if (existingSub) {
      await db
        .update(schema.subscriptions)
        .set({
          plan: planName,
          status: 'active',
          subscriptionStart: now,
          subscriptionEnd,
          paymentProvider: 'PIX_GATEWAY',
          amount: payment.amount,
          updatedAt: now,
        })
        .where(eq(schema.subscriptions.id, existingSub.id));
    } else {
      await db.insert(schema.subscriptions).values({
        userId: payment.userId,
        plan: planName,
        status: 'active',
        subscriptionStart: now,
        subscriptionEnd,
        paymentProvider: 'PIX_GATEWAY',
        amount: payment.amount,
      });
    }

    // Audit log
    await db.insert(schema.activityLogs).values({
      userId: payment.userId,
      action: 'PIX_CONFIRMADO_GATEWAY',
      ip: req.ip || '127.0.0.1',
      metadata: JSON.stringify({
        chargeId,
        amount: payment.amount,
        plan: planName,
        method: 'GATEWAY_WEBHOOK_SIMULATOR',
      }),
    });

    // Send email confirmation to user
    try {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, payment.userId)).limit(1);
      if (user?.email) {
        notifyPaymentApprovedAndProActivated({
          userEmail: user.email,
          userName: user.displayName || undefined,
          planName,
          amount: payment.amount,
          referenceCode: payment.externalPaymentId || undefined,
        }).catch(err => console.warn('Email dispatch warning:', err));
      }
    } catch (err) {
      console.warn('Error fetching user for email notification:', err);
    }

    return res.json({
      message: 'Confirmação bancária recebida! Pagamento aprovado e assinatura ativada.',
      payment: updatedPayment,
    });
  } catch (error) {
    console.error('Error in simulation:', error);
    return res.status(500).json({ error: 'Erro ao simular aprovação bancária.' });
  }
});

// POST /api/payments/pix-manual - User registers manual Pix payment with reference / proof
router.post('/pix-manual', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { referenceCode, proofNote, payerName, amount } = req.body;

    // Get current configured price
    const [settings] = await db.select().from(schema.appSettings).limit(1);
    const finalAmount = amount ? String(amount) : (settings?.monthlyPrice && settings.monthlyPrice !== '10.00' ? settings.monthlyPrice : '9.99');

    const externalId = referenceCode?.trim() || `MANUAL-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const [payment] = await db
      .insert(schema.payments)
      .values({
        userId,
        provider: 'PIX_MANUAL',
        externalPaymentId: externalId,
        amount: finalAmount,
        currency: 'BRL',
        status: 'pending',
        referenceCode: referenceCode?.trim() || externalId,
        proofNote: proofNote?.trim() || 'Comprovante informado pelo usuário no aplicativo',
        payerName: payerName?.trim() || req.user!.nomeCompleto,
        paymentDate: new Date(),
      })
      .returning();

    // Log action
    await db.insert(schema.activityLogs).values({
      userId,
      action: 'PAGAMENTO_PIX_NOTIFICADO_MANUAL',
      ip: req.ip || '127.0.0.1',
      metadata: JSON.stringify({
        paymentId: payment.id,
        amount: payment.amount,
        referenceCode: payment.referenceCode,
      }),
    });

    return res.status(201).json({
      message: 'Comprovante registrado com sucesso! Seu pagamento está sob análise da equipe e será aprovado em instantes.',
      payment,
    });
  } catch (error) {
    console.error('Error recording manual payment:', error);
    return res.status(500).json({ error: 'Erro ao registrar notificação de pagamento Pix.' });
  }
});

// GET /api/payments/my - List user payments
router.get('/my', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userPayments = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.userId, userId))
      .orderBy(desc(schema.payments.paymentDate));

    return res.json(userPayments);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao consultar histórico de pagamentos.' });
  }
});

// GET /api/payments/admin/pending - Admin list of pending payments
router.get('/admin/pending', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const pendingList = await db
      .select({
        payment: schema.payments,
        user: {
          id: schema.users.id,
          nomeCompleto: schema.users.nomeCompleto,
          nomeArtistico: schema.users.nomeArtistico,
          email: schema.users.email,
        },
      })
      .from(schema.payments)
      .innerJoin(schema.users, eq(schema.payments.userId, schema.users.id))
      .where(eq(schema.payments.status, 'pending'))
      .orderBy(desc(schema.payments.createdAt));

    const formatted = pendingList.map((item) => ({
      ...item.payment,
      user: item.user,
    }));

    return res.json(formatted);
  } catch (error) {
    console.error('Error fetching pending payments:', error);
    return res.status(500).json({ error: 'Erro ao listar pagamentos pendentes.' });
  }
});

// POST /api/payments/admin/:id/approve - Admin approves pending Pix payment
router.post('/admin/:id/approve', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const paymentId = Number(req.params.id);
    const adminId = req.user!.id;

    const [payment] = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.id, paymentId))
      .limit(1);

    if (!payment) {
      return res.status(404).json({ error: 'Pagamento não localizado no sistema.' });
    }

    // 1. Mark payment as completed
    const [updatedPayment] = await db
      .update(schema.payments)
      .set({
        status: 'completed',
        updatedAt: new Date(),
      })
      .where(eq(schema.payments.id, paymentId))
      .returning();

    // 2. Activate or extend subscription
    const now = new Date();
    const isYearly = payment.amount && parseFloat(payment.amount) > 50;
    const daysToAdd = isYearly ? 365 : 30;
    const planName = isYearly ? 'kolvox_pro_yearly' : 'kolvox_pro_monthly';
    const nextEnd = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

    const [existingSub] = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, payment.userId))
      .limit(1);

    let activeSub;
    if (existingSub) {
      [activeSub] = await db
        .update(schema.subscriptions)
        .set({
          plan: planName,
          status: 'active',
          subscriptionStart: now,
          subscriptionEnd: nextEnd,
          paymentProvider: payment.provider || 'PIX_MANUAL',
          amount: payment.amount,
          updatedAt: now,
        })
        .where(eq(schema.subscriptions.id, existingSub.id))
        .returning();
    } else {
      [activeSub] = await db
        .insert(schema.subscriptions)
        .values({
          userId: payment.userId,
          plan: planName,
          status: 'active',
          subscriptionStart: now,
          subscriptionEnd: nextEnd,
          paymentProvider: payment.provider || 'PIX_MANUAL',
          amount: payment.amount,
        })
        .returning();
    }

    // 3. Log audit event
    await db.insert(schema.activityLogs).values({
      userId: adminId,
      action: 'ADMIN_APROVOU_PAGAMENTO_PIX',
      ip: req.ip || '127.0.0.1',
      metadata: JSON.stringify({
        paymentId: payment.id,
        targetUserId: payment.userId,
        amount: payment.amount,
        plan: planName,
      }),
    });

    // 4. Send email confirmation to user
    try {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, payment.userId)).limit(1);
      if (user?.email) {
        notifyPaymentApprovedAndProActivated({
          userEmail: user.email,
          userName: user.displayName || undefined,
          planName,
          amount: payment.amount,
          referenceCode: payment.externalPaymentId || undefined,
        }).catch(err => console.warn('Email dispatch warning:', err));
      }
    } catch (err) {
      console.warn('Error fetching user for email notification:', err);
    }

    return res.json({
      message: `Pagamento aprovado com sucesso! Assinatura ${planName} do artista ativada.`,
      payment: updatedPayment,
      subscription: activeSub,
    });
  } catch (error) {
    console.error('Error approving payment:', error);
    return res.status(500).json({ error: 'Erro ao aprovar pagamento.' });
  }
});

// POST /api/payments/admin/:id/reject - Admin rejects payment
router.post('/admin/:id/reject', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const paymentId = Number(req.params.id);
    const adminId = req.user!.id;

    const [updatedPayment] = await db
      .update(schema.payments)
      .set({
        status: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(schema.payments.id, paymentId))
      .returning();

    await db.insert(schema.activityLogs).values({
      userId: adminId,
      action: 'ADMIN_RECUSOU_PAGAMENTO_PIX',
      ip: req.ip || '127.0.0.1',
      metadata: JSON.stringify({ paymentId }),
    });

    return res.json({
      message: 'Pagamento marcado como recusado.',
      payment: updatedPayment,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao recusar pagamento.' });
  }
});

// DELETE /api/payments/admin/:id - Admin deletes a payment record
router.delete('/admin/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const paymentId = Number(req.params.id);
    await db.delete(schema.payments).where(eq(schema.payments.id, paymentId));

    await db.insert(schema.activityLogs).values({
      userId: req.user!.id,
      action: 'ADMIN_EXCLUIU_REGISTRO_PAGAMENTO',
      ip: req.ip || '127.0.0.1',
      metadata: JSON.stringify({ paymentId }),
    });

    return res.json({ message: 'Registro de pagamento excluído com sucesso.' });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return res.status(500).json({ error: 'Erro ao excluir registro de pagamento.' });
  }
});

// POST /api/payments/webhook - Gateway listener for instant Pix callbacks
router.post('/webhook', async (req, res: Response) => {
  try {
    const event = req.body;
    console.log('Received payment gateway webhook:', event);

    // Support standard webhook formats (Mercado Pago, Asaas, Efí/Gerencianet, etc.)
    const isPaid =
      event?.status === 'approved' ||
      event?.status === 'paid' ||
      event?.event === 'PAYMENT_RECEIVED' ||
      event?.event === 'payment.approved' ||
      event?.data?.status === 'approved';

    if (isPaid) {
      const paymentRef =
        event.external_reference ||
        event.id ||
        event.data?.external_reference ||
        event.data?.id ||
        event.payment?.external_reference;

        if (paymentRef) {
          // Find pending payment matching this reference or external id
          const [found] = await db
            .select()
            .from(schema.payments)
            .where(eq(schema.payments.externalPaymentId, String(paymentRef)))
            .limit(1);

          let targetUserId = found?.userId;
          let paymentAmount = found?.amount;

          const payerEmail = (
            event?.payer?.email ||
            event?.data?.payer?.email ||
            event?.email ||
            event?.payer_email ||
            req.body?.payerEmail
          )?.trim()?.toLowerCase();

          if (!targetUserId && payerEmail) {
            const [userByEmail] = await db
              .select()
              .from(schema.users)
              .where(eq(schema.users.email, payerEmail))
              .limit(1);
            if (userByEmail) {
              targetUserId = userByEmail.id;
            }
          }

          if (targetUserId) {
            const now = new Date();
            const isYearly = paymentAmount && parseFloat(paymentAmount) > 50;
            const daysToAdd = isYearly ? 365 : 30;
            const planName = isYearly ? 'kolvox_pro_yearly' : 'kolvox_pro_monthly';
            const nextEnd = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

            if (found) {
              await db
                .update(schema.payments)
                .set({ status: 'completed', updatedAt: now })
                .where(eq(schema.payments.id, found.id));
            }

            const [existingSub] = await db
              .select()
              .from(schema.subscriptions)
              .where(eq(schema.subscriptions.userId, targetUserId))
              .limit(1);

            if (existingSub) {
              await db
                .update(schema.subscriptions)
                .set({
                  plan: planName,
                  status: 'active',
                  subscriptionStart: now,
                  subscriptionEnd: nextEnd,
                  updatedAt: now,
                })
                .where(eq(schema.subscriptions.id, existingSub.id));
            } else {
              await db.insert(schema.subscriptions).values({
                userId: targetUserId,
                plan: planName,
                status: 'active',
                subscriptionStart: now,
                subscriptionEnd: nextEnd,
                paymentProvider: 'PIX_GATEWAY',
                amount: paymentAmount || '9.99',
              });
            }

            await db.insert(schema.activityLogs).values({
              userId: targetUserId,
              action: 'WEBHOOK_PIX_PROCESSADO_SUCESSO',
              ip: req.ip || '127.0.0.1',
              metadata: JSON.stringify({ externalPaymentId: paymentRef, email: payerEmail, plan: planName }),
            });

            // Send email confirmation to user
            try {
              const [targetUser] = await db.select().from(schema.users).where(eq(schema.users.id, targetUserId)).limit(1);
              if (targetUser?.email) {
                notifyPaymentApprovedAndProActivated({
                  userEmail: targetUser.email,
                  userName: targetUser.displayName || undefined,
                  planName,
                  amount: paymentAmount || '9.99',
                  referenceCode: String(paymentRef),
                }).catch(err => console.warn('Email dispatch warning in webhook:', err));
              }
            } catch (err) {
              console.warn('Error fetching user for webhook email notification:', err);
            }
          }
        }
      }

      return res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error handling webhook:', error);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

// POST /api/payments/instant-unlock - Instant automatic unlock linked to user email
router.post('/instant-unlock', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { plan = 'kolvox_pro_monthly', refCode } = req.body;
    const now = new Date();
    const isYearly = plan === 'kolvox_pro_yearly';
    const daysToAdd = isYearly ? 365 : 30;
    const nextEnd = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

    const [existingSub] = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .limit(1);

    if (existingSub) {
      await db
        .update(schema.subscriptions)
        .set({
          plan,
          status: 'active',
          subscriptionStart: now,
          subscriptionEnd: nextEnd,
          updatedAt: now,
        })
        .where(eq(schema.subscriptions.id, existingSub.id));
    } else {
      await db.insert(schema.subscriptions).values({
        userId,
        plan,
        status: 'active',
        subscriptionStart: now,
        subscriptionEnd: nextEnd,
        paymentProvider: 'PIX_INSTANT',
        amount: isYearly ? '99.99' : '9.99',
      });
    }

    await db.insert(schema.activityLogs).values({
      userId,
      action: 'CONTA_DESBLOQUEADA_AUTOMATICAMENTE',
      ip: req.ip || '127.0.0.1',
      metadata: JSON.stringify({ email: req.user!.email, plan, refCode }),
    });

    return res.json({
      success: true,
      message: `Conta vinculada ao e-mail ${req.user!.email} liberada com sucesso!`,
      plan,
      status: 'active',
    });
  } catch (err) {
    console.error('Error unlocking account:', err);
    return res.status(500).json({ error: 'Erro ao liberar conta.' });
  }
});

export default router;
