import { Router, type Response } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import * as schema from '../../db/schema.ts';
import { requireAdmin, type AuthRequest } from '../middleware/auth.ts';
import { sendEmail } from '../services/emailService.ts';

const router = Router();

// GET /api/settings/public - Public settings accessible by any user / frontend
router.get('/public', async (req, res: Response) => {
  try {
    let [settings] = await db.select().from(schema.appSettings).limit(1);

    if (!settings) {
      // Create default if missing
      [settings] = await db
        .insert(schema.appSettings)
        .values({
          pixKey: 'kolvox.pagamentos@gmail.com',
          pixKeyType: 'E-mail',
          pixReceiverName: 'KOLVOX TECNOLOGIA LTDA',
          pixCity: 'SAO PAULO',
          supportEmail: 'kolvox.pagamentos@gmail.com',
          monthlyPrice: '9.99',
          trialDays: 7,
          pixEnabled: true,
          manualPaymentEnabled: true,
        })
        .returning();
    }

    // Check Gmail integration status to notify public support availability
    const [gmail] = await db.select().from(schema.gmailIntegrations).limit(1);

    const effectiveMonthly =
      settings.monthlyPrice && settings.monthlyPrice !== '10.00' && settings.monthlyPrice !== '10'
        ? settings.monthlyPrice
        : '9.99';

    return res.json({
      pixKey: settings.pixKey,
      pixKeyType: settings.pixKeyType,
      pixReceiverName: settings.pixReceiverName,
      pixCity: settings.pixCity,
      supportEmail: settings.supportEmail,
      monthlyPrice: effectiveMonthly,
      trialDays: settings.trialDays,
      pixEnabled: settings.pixEnabled,
      manualPaymentEnabled: settings.manualPaymentEnabled,
      gmailSupportOnline: gmail?.status === 'connected',
    });
  } catch (error) {
    console.error('Error fetching public settings:', error);
    // Safe fallback to prevent breaking UI
    return res.json({
      pixKey: 'kolvox.pagamentos@gmail.com',
      pixKeyType: 'E-mail',
      pixReceiverName: 'KOLVOX TECNOLOGIA LTDA',
      pixCity: 'SAO PAULO',
      supportEmail: 'kolvox.pagamentos@gmail.com',
      monthlyPrice: '9.99',
      trialDays: 7,
      pixEnabled: true,
      manualPaymentEnabled: true,
      gmailSupportOnline: false,
    });
  }
});

// GET /api/settings/admin - Admin view of all application settings
router.get('/admin', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    let [settings] = await db.select().from(schema.appSettings).limit(1);

    if (!settings) {
      [settings] = await db
        .insert(schema.appSettings)
        .values({
          pixKey: 'kolvox.pagamentos@gmail.com',
          pixKeyType: 'E-mail',
          pixReceiverName: 'KOLVOX TECNOLOGIA LTDA',
          pixCity: 'SAO PAULO',
          supportEmail: 'kolvox.pagamentos@gmail.com',
          monthlyPrice: '9.99',
          trialDays: 7,
          pixEnabled: true,
          manualPaymentEnabled: true,
          updatedBy: req.user!.id,
        })
        .returning();
    } else if (settings.monthlyPrice === '10.00' || settings.monthlyPrice === '10') {
      settings.monthlyPrice = '9.99';
    }

    const [gmail] = await db.select().from(schema.gmailIntegrations).limit(1);

    return res.json({
      settings,
      gmail: {
        status: gmail?.status || 'disconnected',
        googleAccountEmail: gmail?.googleAccountEmail || null,
        lastSyncAt: gmail?.lastSyncAt || null,
        hasCredentials: !!(
          gmail?.refreshTokenEncrypted ||
          process.env.GMAIL_APP_PASSWORD ||
          process.env.GMAIL_REFRESH_TOKEN
        ),
      },
    });
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    return res.status(500).json({ error: 'Erro ao obter configurações do sistema.' });
  }
});

// PUT /api/settings/admin - Update system settings (Pix, Support Email, Subscription Pricing)
router.put('/admin', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user!.id;
    const {
      pixKey,
      pixKeyType,
      pixReceiverName,
      pixCity,
      supportEmail,
      monthlyPrice,
      trialDays,
      pixEnabled,
      manualPaymentEnabled,
    } = req.body;

    // Validate Pix key type
    const validTypes = ['E-mail', 'CPF', 'CNPJ', 'Telefone', 'Chave aleatória'];
    if (pixKeyType && !validTypes.includes(pixKeyType)) {
      return res.status(400).json({ error: 'Tipo de chave Pix inválido.' });
    }

    if (supportEmail && !supportEmail.includes('@')) {
      return res.status(400).json({ error: 'E-mail de suporte inválido.' });
    }

    let [existing] = await db.select().from(schema.appSettings).limit(1);

    let updated;
    if (existing) {
      [updated] = await db
        .update(schema.appSettings)
        .set({
          pixKey: pixKey !== undefined ? pixKey.trim() : existing.pixKey,
          pixKeyType: pixKeyType !== undefined ? pixKeyType : existing.pixKeyType,
          pixReceiverName: pixReceiverName !== undefined ? pixReceiverName.trim() : existing.pixReceiverName,
          pixCity: pixCity !== undefined ? pixCity.trim().toUpperCase() : existing.pixCity,
          supportEmail: supportEmail !== undefined ? supportEmail.trim() : existing.supportEmail,
          monthlyPrice: monthlyPrice !== undefined ? String(monthlyPrice) : existing.monthlyPrice,
          trialDays: trialDays !== undefined ? Number(trialDays) : existing.trialDays,
          pixEnabled: pixEnabled !== undefined ? Boolean(pixEnabled) : existing.pixEnabled,
          manualPaymentEnabled: manualPaymentEnabled !== undefined ? Boolean(manualPaymentEnabled) : existing.manualPaymentEnabled,
          updatedAt: new Date(),
          updatedBy: adminId,
        })
        .where(eq(schema.appSettings.id, existing.id))
        .returning();
    } else {
      [updated] = await db
        .insert(schema.appSettings)
        .values({
          pixKey: pixKey?.trim() || 'kolvox.pagamentos@gmail.com',
          pixKeyType: pixKeyType || 'E-mail',
          pixReceiverName: pixReceiverName?.trim() || 'KOLVOX TECNOLOGIA LTDA',
          pixCity: pixCity?.trim().toUpperCase() || 'SAO PAULO',
          supportEmail: supportEmail?.trim() || 'kolvox.pagamentos@gmail.com',
          monthlyPrice: monthlyPrice ? String(monthlyPrice) : '9.99',
          trialDays: trialDays ? Number(trialDays) : 7,
          pixEnabled: pixEnabled !== undefined ? Boolean(pixEnabled) : true,
          manualPaymentEnabled: manualPaymentEnabled !== undefined ? Boolean(manualPaymentEnabled) : true,
          updatedBy: adminId,
        })
        .returning();
    }

    // Log admin action
    await db.insert(schema.activityLogs).values({
      userId: adminId,
      action: 'ADMIN_ATUALIZOU_CONFIGURACOES',
      ip: req.ip || '127.0.0.1',
      metadata: JSON.stringify({
        pixKey: updated.pixKey,
        pixKeyType: updated.pixKeyType,
        supportEmail: updated.supportEmail,
        monthlyPrice: updated.monthlyPrice,
      }),
    });

    return res.json({
      message: 'Configurações do aplicativo salvas com sucesso no banco de dados!',
      settings: updated,
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return res.status(500).json({ error: 'Erro ao salvar configurações do aplicativo.' });
  }
});

// POST /api/settings/admin/gmail/connect - Connect or configure Gmail OAuth / App Password
router.post('/admin/gmail/connect', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user!.id;
    const { email, appPassword, clientId, clientSecret, refreshToken } = req.body;
    const targetEmail = email?.trim() || 'kolvox.pagamentos@gmail.com';
    const secretToSave = (appPassword || refreshToken || '').trim();

    let [existing] = await db.select().from(schema.gmailIntegrations).limit(1);

    if (existing) {
      await db
        .update(schema.gmailIntegrations)
        .set({
          adminUserId: adminId,
          googleAccountEmail: targetEmail,
          googleUserId: clientId ? clientId.trim() : existing.googleUserId,
          refreshTokenEncrypted: secretToSave || existing.refreshTokenEncrypted,
          status: 'connected',
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.gmailIntegrations.id, existing.id));
    } else {
      await db.insert(schema.gmailIntegrations).values({
        adminUserId: adminId,
        googleAccountEmail: targetEmail,
        googleUserId: clientId ? clientId.trim() : null,
        refreshTokenEncrypted: secretToSave || null,
        status: 'connected',
        lastSyncAt: new Date(),
      });
    }

    await db.insert(schema.activityLogs).values({
      userId: adminId,
      action: 'ADMIN_CONECTOU_GMAIL',
      ip: req.ip || '127.0.0.1',
      metadata: JSON.stringify({ email: targetEmail, hasAppPassword: !!secretToSave }),
    });

    return res.json({
      message: 'Gmail conectado e salvo com sucesso! O suporte agora sincroniza mensagens em tempo real.',
      email: targetEmail,
      status: 'connected',
      hasCredentials: !!(secretToSave || process.env.GMAIL_APP_PASSWORD),
    });
  } catch (error) {
    console.error('Error connecting Gmail:', error);
    return res.status(500).json({ error: 'Erro ao conectar conta Gmail.' });
  }
});

// POST /api/settings/admin/gmail/disconnect - Disconnect Gmail
router.post('/admin/gmail/disconnect', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user!.id;
    let [existing] = await db.select().from(schema.gmailIntegrations).limit(1);

    if (existing) {
      await db
        .update(schema.gmailIntegrations)
        .set({
          status: 'disconnected',
          updatedAt: new Date(),
        })
        .where(eq(schema.gmailIntegrations.id, existing.id));
    }

    await db.insert(schema.activityLogs).values({
      userId: adminId,
      action: 'ADMIN_DESCONECTOU_GMAIL',
      ip: req.ip || '127.0.0.1',
    });

    return res.json({
      message: 'Conta Gmail desconectada com sucesso.',
      status: 'disconnected',
    });
  } catch (error) {
    console.error('Error disconnecting Gmail:', error);
    return res.status(500).json({ error: 'Erro ao desconectar Gmail.' });
  }
});

// POST /api/settings/admin/gmail/test - Test Gmail connection & email dispatch
router.post('/admin/gmail/test', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    let [gmail] = await db.select().from(schema.gmailIntegrations).limit(1);

    if (!gmail || gmail.status !== 'connected') {
      return res.status(400).json({
        success: false,
        message: '🔴 Falha na conexão com Gmail: a conta não está conectada no momento. Clique em Conectar Gmail.',
      });
    }

    const targetEmail = (req.body?.targetEmail || gmail.googleAccountEmail || 'kolvox.pagamentos@gmail.com').trim();

    // Perform actual email dispatch
    const testResult = await sendEmail({
      to: targetEmail,
      subject: `[KOLVOX STAGE] Teste de Conexão Gmail - ${new Date().toLocaleTimeString('pt-BR')}`,
      text: `Olá!\n\nEste é um teste de envio de e-mail disparado pelo Painel Administrativo KOLVOX STAGE.\n\nData e Hora: ${new Date().toLocaleString('pt-BR')}\nConta de envio: ${gmail.googleAccountEmail}\nDestinatário: ${targetEmail}\n\nSe você recebeu esta mensagem, sua integração com o Gmail está 100% funcional!`,
    });

    // Update last sync
    await db
      .update(schema.gmailIntegrations)
      .set({ lastSyncAt: new Date() })
      .where(eq(schema.gmailIntegrations.id, gmail.id));

    await db.insert(schema.activityLogs).values({
      userId: req.user!.id,
      action: testResult.success ? 'TESTE_CONEXAO_GMAIL_SUCESSO' : 'TESTE_CONEXAO_GMAIL_AVISO',
      ip: req.ip || '127.0.0.1',
      metadata: JSON.stringify({ email: targetEmail, result: testResult }),
    });

    return res.json({
      success: testResult.success,
      message: testResult.success
        ? `🟢 Conexão com Gmail ativa! ${testResult.message}`
        : `⚠️ ${testResult.message}`,
      account: gmail.googleAccountEmail,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error during Gmail test:', error);
    return res.status(500).json({
      success: false,
      message: `🔴 Erro ao testar Gmail: ${error?.message || 'Falha de conexão.'}`,
    });
  }
});

export default router;
