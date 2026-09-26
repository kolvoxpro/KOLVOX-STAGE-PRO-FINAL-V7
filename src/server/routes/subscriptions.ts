import { Router, type Response } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import * as schema from '../../db/schema.ts';
import { requireAuth, type AuthRequest } from '../middleware/auth.ts';

const router = Router();

// GET /api/subscriptions/current
router.get('/current', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const subs = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .orderBy(desc(schema.subscriptions.createdAt));

    const current = subs[0] || null;

    // Calculate trial days remaining
    let trialDaysLeft = 0;
    if (current && current.status === 'trial' && current.trialEnd) {
      const diffMs = new Date(current.trialEnd).getTime() - new Date().getTime();
      trialDaysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    return res.json({
      subscription: current,
      trialDaysLeft,
      isPremiumActive: current ? (current.status === 'active' || (current.status === 'trial' && trialDaysLeft > 0)) : false,
    });
  } catch (error) {
    console.error('Error in subscription status:', error);
    return res.status(500).json({ error: 'Erro ao verificar assinatura.' });
  }
});

// GET /api/subscriptions/payments
router.get('/payments', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const paymentList = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.userId, userId))
      .orderBy(desc(schema.payments.createdAt));

    return res.json(paymentList);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao carregar histórico financeiro.' });
  }
});

// POST /api/subscriptions/checkout
router.post('/checkout', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { plan, paymentMethod, cardDetails } = req.body;

    const amountMap: Record<string, string> = {
      kolvox_pro_monthly: '19.90',
      kolvox_pro_yearly: '179.90',
    };

    const durationDaysMap: Record<string, number> = {
      kolvox_pro_monthly: 30,
      kolvox_pro_yearly: 365,
    };

    const amount = amountMap[plan] || '19.90';
    const durationDays = durationDaysMap[plan] || 30;

    const now = new Date();
    const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const externalId = `KVX-PAY-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // Create active subscription
    const [newSub] = await db
      .insert(schema.subscriptions)
      .values({
        userId,
        plan,
        status: 'active',
        subscriptionStart: now,
        subscriptionEnd: periodEnd,
        paymentProvider: paymentMethod || 'PIX',
        customerId: `CUST-${userId}`,
        subscriptionId: `SUB-${Date.now()}`,
        paymentId: externalId,
        amount,
        currency: 'BRL',
      })
      .returning();

    // Create payment record
    const [newPayment] = await db
      .insert(schema.payments)
      .values({
        userId,
        subscriptionId: newSub.id,
        provider: paymentMethod || 'PIX',
        externalPaymentId: externalId,
        amount,
        currency: 'BRL',
        status: 'completed',
        paymentDate: now,
      })
      .returning();

    // Log activity
    await db.insert(schema.activityLogs).values({
      userId,
      action: 'ASSINATURA_UPGRADE_PRO',
      ip: req.ip || '127.0.0.1',
      metadata: JSON.stringify({ plan, amount, paymentId: externalId }),
    });

    return res.json({
      message: 'Pagamento aprovado! Sua assinatura KOLVOX STAGE PRO está ativa.',
      subscription: newSub,
      payment: newPayment,
      pixCode: paymentMethod === 'PIX' ? `00020126580014BR.GOV.BCB.PIX0136kolvox-stage-pagamentos@kolvox.com5204000053039865405${amount}5802BR5916KOLVOX STAGE BR6009SAO PAULO62070503***6304${externalId.slice(-4)}` : null,
    });
  } catch (error) {
    console.error('Error during checkout:', error);
    return res.status(500).json({ error: 'Falha ao processar pagamento.' });
  }
});

export default router;
