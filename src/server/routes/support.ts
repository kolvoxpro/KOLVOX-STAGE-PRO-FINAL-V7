import { Router, type Response } from 'express';
import { desc, eq, or } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import * as schema from '../../db/schema.ts';
import { optionalAuth, requireAuth, requireAdmin, type AuthRequest } from '../middleware/auth.ts';
import { notifyClientSupportReply, notifyNewTicketCreated } from '../services/emailService.ts';

const router = Router();

// POST /api/support/tickets - Submit support inquiry / help request
router.post('/tickets', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { customerName, customerEmail, subject, message } = req.body;

    if (!customerName?.trim() || !customerEmail?.trim() || !subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Todos os campos (Nome, E-mail, Assunto e Mensagem) são obrigatórios.' });
    }

    if (!customerEmail.includes('@') || !customerEmail.includes('.')) {
      return res.status(400).json({ error: 'Por favor, insira um e-mail válido para receber nossa resposta.' });
    }

    // Safely check if userId exists in users table to prevent FK constraint violation
    let safeUserId: number | null = null;
    if (req.user?.id) {
      try {
        const [foundUser] = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.id, req.user.id))
          .limit(1);
        if (foundUser) {
          safeUserId = foundUser.id;
        }
      } catch {
        safeUserId = null;
      }
    }

    // Check if Gmail integration or settings are configured (resilient fallback)
    let isGmailConnected = false;
    let supportEmail = 'kolvox.pagamentos@gmail.com';
    try {
      const [gmail] = await db.select().from(schema.gmailIntegrations).limit(1);
      const [settings] = await db.select().from(schema.appSettings).limit(1);
      isGmailConnected = gmail?.status === 'connected';
      if (settings?.supportEmail) {
        supportEmail = settings.supportEmail;
      }
    } catch (e) {
      console.warn('[Support] Integrations check notice:', e);
    }

    const threadId = `th_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const [ticket] = await db
      .insert(schema.supportTickets)
      .values({
        userId: safeUserId,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim().toLowerCase(),
        subject: subject.trim(),
        message: message.trim(),
        status: isGmailConnected ? 'pending' : 'open',
        gmailThreadId: isGmailConnected ? threadId : null,
        gmailMessageId: isGmailConnected ? messageId : null,
      })
      .returning();

    // Log activity safely
    try {
      await db.insert(schema.activityLogs).values({
        userId: safeUserId,
        action: 'SUPORTE_CHAMADO_CRIADO',
        ip: req.ip || '127.0.0.1',
        metadata: JSON.stringify({
          ticketId: ticket.id,
          email: customerEmail,
          subject: subject,
          gmailSynced: isGmailConnected,
        }),
      });
    } catch (logErr) {
      console.warn('[Support] Activity log warning:', logErr);
    }

    // Notify support and customer via email
    notifyNewTicketCreated(ticket, supportEmail).catch((e) => console.warn('Email notify error:', e));

    return res.status(201).json({
      message: 'Mensagem enviada com sucesso! Nossa equipe responderá em breve no seu e-mail e no painel.',
      ticket: {
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    return res.status(500).json({ error: 'Erro ao enviar mensagem de suporte. Tente novamente em instantes.' });
  }
});

// GET /api/support/my-tickets - List tickets submitted by current logged-in user
router.get('/my-tickets', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const userEmail = req.user!.email.toLowerCase();

    const tickets = await db
      .select()
      .from(schema.supportTickets)
      .where(or(eq(schema.supportTickets.userId, userId), eq(schema.supportTickets.customerEmail, userEmail)))
      .orderBy(desc(schema.supportTickets.createdAt));

    return res.json(tickets);
  } catch (error) {
    console.error('Error fetching my tickets:', error);
    return res.status(500).json({ error: 'Erro ao listar seus chamados.' });
  }
});

// POST /api/support/my-tickets/:id/reply - Client sends follow-up reply in their ticket
router.post('/my-tickets/:id/reply', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const ticketId = Number(req.params.id);
    const userId = req.user!.id;
    const replyText = (req.body.clientReply || req.body.message || '').trim();

    if (!replyText) {
      return res.status(400).json({ error: 'A mensagem de resposta não pode estar vazia.' });
    }

    const [existing] = await db
      .select()
      .from(schema.supportTickets)
      .where(eq(schema.supportTickets.id, ticketId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Chamado não encontrado.' });
    }

    if (existing.userId !== userId && req.user!.tipoUsuario !== 'ADMIN') {
      return res.status(403).json({ error: 'Você não tem permissão para responder este chamado.' });
    }

    const updatedMessage = `${existing.message}\n\n[RESPOSTA DO CLIENTE - ${new Date().toLocaleDateString('pt-BR')}]:\n${replyText}`;

    const [updated] = await db
      .update(schema.supportTickets)
      .set({
        message: updatedMessage,
        status: 'open',
        updatedAt: new Date(),
      })
      .where(eq(schema.supportTickets.id, ticketId))
      .returning();

    return res.json({
      message: 'Sua resposta foi enviada ao suporte com sucesso!',
      ticket: updated,
    });
  } catch (error) {
    console.error('Error client reply to ticket:', error);
    return res.status(500).json({ error: 'Erro ao enviar resposta ao chamado.' });
  }
});

// GET /api/support/admin/tickets - Admin list of all tickets
router.get('/admin/tickets', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const tickets = await db
      .select()
      .from(schema.supportTickets)
      .orderBy(desc(schema.supportTickets.createdAt));

    return res.json(tickets);
  } catch (error) {
    console.error('Error fetching admin tickets:', error);
    return res.status(500).json({ error: 'Erro ao carregar chamados de suporte.' });
  }
});

// PUT /api/support/admin/tickets/:id/reply - Admin replies to a support ticket
router.put('/admin/tickets/:id/reply', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const ticketId = Number(req.params.id);
    const { replyMessage, status } = req.body;

    if (!replyMessage?.trim()) {
      return res.status(400).json({ error: 'A mensagem de resposta não pode estar vazia.' });
    }

    const [existing] = await db
      .select()
      .from(schema.supportTickets)
      .where(eq(schema.supportTickets.id, ticketId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Chamado não encontrado.' });
    }

    const [updated] = await db
      .update(schema.supportTickets)
      .set({
        replyMessage: replyMessage.trim(),
        replySentAt: new Date(),
        status: status || 'answered',
        updatedAt: new Date(),
      })
      .where(eq(schema.supportTickets.id, ticketId))
      .returning();

    await db.insert(schema.activityLogs).values({
      userId: req.user!.id,
      action: 'ADMIN_RESPONDEU_CHAMADO',
      ip: req.ip || '127.0.0.1',
      metadata: JSON.stringify({
        ticketId,
        customerEmail: existing.customerEmail,
      }),
    });

    // Notify client via email
    notifyClientSupportReply(updated).catch((e) => console.warn('Email notify reply error:', e));

    return res.json({
      message: 'Resposta registrada com sucesso e enviada ao cliente!',
      ticket: updated,
    });
  } catch (error) {
    console.error('Error replying to ticket:', error);
    return res.status(500).json({ error: 'Erro ao responder chamado.' });
  }
});

// PUT /api/support/admin/tickets/:id/status - Update ticket status
router.put('/admin/tickets/:id/status', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const ticketId = Number(req.params.id);
    const { status } = req.body;

    const validStatuses = ['open', 'pending', 'answered', 'closed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status de chamado inválido.' });
    }

    const [updated] = await db
      .update(schema.supportTickets)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.supportTickets.id, ticketId))
      .returning();

    return res.json({ message: 'Status do chamado atualizado!', ticket: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar status do chamado.' });
  }
});

// POST or DELETE /api/support/admin/tickets/batch-delete - Admin batch deletes tickets
router.post('/admin/tickets/batch-delete', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { filter } = req.body;
    if (filter === 'open') {
      await db.delete(schema.supportTickets).where(or(eq(schema.supportTickets.status, 'open'), eq(schema.supportTickets.status, 'pending')));
    } else if (filter === 'answered') {
      await db.delete(schema.supportTickets).where(eq(schema.supportTickets.status, 'answered'));
    } else {
      await db.delete(schema.supportTickets);
    }
    return res.json({ message: 'Chamados excluídos com sucesso.' });
  } catch (error) {
    console.error('Error batch deleting tickets:', error);
    return res.status(500).json({ error: 'Erro ao excluir chamados.' });
  }
});

// DELETE /api/support/admin/tickets/:id - Admin deletes a ticket
router.delete('/admin/tickets/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const rawId = req.params.id;
    const ticketId = Number(rawId);

    if (!isNaN(ticketId)) {
      await db.delete(schema.supportTickets).where(eq(schema.supportTickets.id, ticketId));
    }

    return res.json({ message: 'Chamado de suporte excluído com sucesso.' });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    return res.status(500).json({ error: 'Erro ao excluir chamado de suporte.' });
  }
});

// DELETE /api/support/my-tickets/:id - User deletes their own ticket
router.delete('/my-tickets/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const ticketId = Number(req.params.id);
    const userId = req.user!.id;

    const [existing] = await db
      .select()
      .from(schema.supportTickets)
      .where(eq(schema.supportTickets.id, ticketId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Chamado não encontrado.' });
    }

    if (existing.userId !== userId && req.user!.tipoUsuario !== 'ADMIN') {
      return res.status(403).json({ error: 'Você não tem permissão para excluir este chamado.' });
    }

    await db.delete(schema.supportTickets).where(eq(schema.supportTickets.id, ticketId));
    return res.json({ message: 'Chamado excluído com sucesso.' });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    return res.status(500).json({ error: 'Erro ao excluir chamado.' });
  }
});

export default router;
