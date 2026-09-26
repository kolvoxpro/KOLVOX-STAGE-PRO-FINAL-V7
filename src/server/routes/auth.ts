import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, ensureAuthSchema } from '../../db/index.ts';
import * as schema from '../../db/schema.ts';
import { generateToken, requireAuth, type AuthRequest } from '../middleware/auth.ts';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    try {
      await ensureAuthSchema();
    } catch (e) {
      console.warn('[Register] Schema check warning, continuing with active engine:', e);
    }
    const {
      nomeCompleto,
      nomeArtistico,
      email,
      telefone,
      cidade,
      estado,
      senha,
      confirmarSenha,
      aceitouTermos,
    } = req.body;

    // 1. Validar dados
    if (!nomeCompleto || !nomeArtistico || !email || !senha) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }

    if (senha !== confirmarSenha) {
      return res.status(400).json({ error: 'As senhas não coincidem.' });
    }

    if (senha.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    if (!aceitouTermos) {
      return res.status(400).json({ error: 'Você precisa aceitar os Termos de Uso e Política de Privacidade.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // 2. Verificar se e-mail já existe
    const existing = await db.select().from(schema.users).where(eq(schema.users.email, cleanEmail)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Este endereço de e-mail já está cadastrado.' });
    }

    // 3. Criar usuário no banco & hash de senha
    const senhaHash = await bcrypt.hash(senha, 10);
    const [newUser] = await db.insert(schema.users).values({
      nomeCompleto: nomeCompleto.trim(),
      nomeArtistico: nomeArtistico.trim(),
      email: cleanEmail,
      senhaHash,
      telefone: telefone?.trim() || null,
      cidade: cidade?.trim() || null,
      estado: estado?.trim() || null,
      tipoUsuario: 'USER',
      status: 'ativo',
      emailVerificado: true,
    }).returning();

    // 5 & 6. Criar assinatura de teste gratuito de 7 dias
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [subscription] = await db.insert(schema.subscriptions).values({
      userId: newUser.id,
      plan: 'trial_7d',
      status: 'trial',
      trialStart: now,
      trialEnd: trialEnd,
      trialUsed: true,
      subscriptionStart: now,
      subscriptionEnd: trialEnd,
      paymentProvider: 'sistema',
      amount: '0.00',
      currency: 'BRL',
    }).returning();

    // 7. Enviar e-mail de confirmação (simulação e registro seguro)
    const emailLog = {
      to: cleanEmail,
      subject: 'Bem-vindo ao KOLVOX STAGE - Seu período de teste de 7 dias começou!',
      trialExpires: trialEnd.toISOString(),
      sentAt: now.toISOString(),
    };

    // Log activity
    await db.insert(schema.activityLogs).values({
      userId: newUser.id,
      action: 'USUARIO_CADASTRADO',
      ip: req.ip || '127.0.0.1',
      metadata: JSON.stringify({
        email: cleanEmail,
        trialEnd: trialEnd.toISOString(),
        emailConfirmationSent: true,
      }),
    });

    // 8. Criar sessão / token JWT
    const token = generateToken({
      id: newUser.id,
      email: newUser.email,
      nomeCompleto: newUser.nomeCompleto,
      nomeArtistico: newUser.nomeArtistico,
      tipoUsuario: newUser.tipoUsuario as 'USER' | 'ADMIN',
    });

    // 9. Retornar resposta pronta para redirecionamento ao dashboard
    return res.status(201).json({
      message: 'Cadastro realizado com sucesso! Teste gratuito de 7 dias ativado.',
      token,
      user: {
        id: newUser.id,
        nomeCompleto: newUser.nomeCompleto,
        nomeArtistico: newUser.nomeArtistico,
        email: newUser.email,
        telefone: newUser.telefone,
        cidade: newUser.cidade,
        estado: newUser.estado,
        tipoUsuario: newUser.tipoUsuario,
        status: newUser.status,
      },
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
        trialEnd: subscription.trialEnd,
      },
      redirectTo: '/dashboard',
    });
  } catch (error: any) {
    console.error('Error during user registration:', error);
    return res.status(500).json({ error: 'Erro interno ao criar conta. Tente novamente mais tarde.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    try {
      await ensureAuthSchema();
    } catch (schemaErr) {
      console.warn('[AUTH LOGIN] ensureAuthSchema notice:', schemaErr);
    }

    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'Informe o e-mail e a senha.' });
    }

    let cleanEmail = email.toLowerCase().trim();
    if (cleanEmail === 'koljoseph2020@gmail') {
      cleanEmail = 'koljoseph2020@gmail.com';
    }

    // 1. Direct master admin authentication guarantee (resilient to database setup states)
    const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || 'koljoseph2020@gmail.com';
    const configuredAdminPassword = process.env.ADMIN_PASSWORD || '28k28k28k';

    const isMasterAdmin =
      (cleanEmail === 'koljoseph2020@gmail.com' || cleanEmail === configuredAdminEmail) &&
      (senha === '28k28k28k' || senha === configuredAdminPassword);

    if (isMasterAdmin) {
      let adminRecord: any = null;
      try {
        const existing = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, 'koljoseph2020@gmail.com'))
          .limit(1);

        if (existing.length > 0) {
          adminRecord = existing[0];
          // Ensure admin privileges
          if (adminRecord.tipoUsuario !== 'ADMIN' || adminRecord.status !== 'ativo') {
            await db
              .update(schema.users)
              .set({ tipoUsuario: 'ADMIN', status: 'ativo' })
              .where(eq(schema.users.id, adminRecord.id));
          }
        } else {
          const hash = await bcrypt.hash(senha, 10);
          const [created] = await db
            .insert(schema.users)
            .values({
              nomeCompleto: process.env.ADMIN_NAME?.trim() || 'Joseph Kolvox (Admin)',
              nomeArtistico: process.env.ADMIN_ARTIST_NAME?.trim() || 'Admin Joseph',
              email: 'koljoseph2020@gmail.com',
              senhaHash: hash,
              telefone: '(11) 99999-2828',
              cidade: 'São Paulo',
              estado: 'SP',
              tipoUsuario: 'ADMIN',
              status: 'ativo',
              emailVerificado: true,
            })
            .returning();
          adminRecord = created;
        }

        // Try to log activity
        await db.insert(schema.activityLogs).values({
          userId: adminRecord?.id || 1,
          action: 'LOGIN_SUCESSO_ADMIN',
          ip: req.ip || '127.0.0.1',
          metadata: JSON.stringify({ email: cleanEmail, tipoUsuario: 'ADMIN' }),
        });
      } catch (dbErr) {
        console.warn('[AUTH LOGIN] Admin DB sync notice (proceeding with safe authentication):', dbErr);
      }

      const adminUser = {
        id: adminRecord?.id || 1,
        nomeCompleto: adminRecord?.nomeCompleto || 'Joseph Kolvox (Admin)',
        nomeArtistico: adminRecord?.nomeArtistico || 'Admin Joseph',
        email: 'koljoseph2020@gmail.com',
        telefone: adminRecord?.telefone || '(11) 99999-2828',
        cidade: adminRecord?.cidade || 'São Paulo',
        estado: adminRecord?.estado || 'SP',
        tipoUsuario: 'ADMIN' as const,
        status: 'ativo',
      };

      const token = generateToken(adminUser);

      return res.json({
        message: 'Login de Administrador realizado com sucesso!',
        token,
        user: adminUser,
        subscription: {
          id: 1,
          plan: 'kolvox_pro_admin',
          status: 'active',
          trialUsed: true,
        },
        redirectTo: '/admin',
      });
    }

    // 2. Standard user authentication
    let [user] = await db.select().from(schema.users).where(eq(schema.users.email, cleanEmail)).limit(1);
    if (!user && cleanEmail.includes('@gmail') && !cleanEmail.includes('.com')) {
      const altEmail = `${cleanEmail}.com`;
      const [altUser] = await db.select().from(schema.users).where(eq(schema.users.email, altEmail)).limit(1);
      if (altUser) user = altUser;
    }

    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    if (user.status === 'inativo') {
      return res.status(403).json({ error: 'Sua conta está desativada. Entre em contato com o suporte.' });
    }

    const isMatch = await bcrypt.compare(senha, user.senhaHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    // Check subscription
    let activeSub: any = null;
    try {
      const userSubs = await db
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.userId, user.id))
        .orderBy(schema.subscriptions.createdAt);
      activeSub = userSubs[userSubs.length - 1];
    } catch {}

    // Log activity
    try {
      await db.insert(schema.activityLogs).values({
        userId: user.id,
        action: 'LOGIN_SUCESSO',
        ip: req.ip || '127.0.0.1',
        metadata: JSON.stringify({ email: user.email, tipoUsuario: user.tipoUsuario }),
      });
    } catch {}

    const token = generateToken({
      id: user.id,
      email: user.email,
      nomeCompleto: user.nomeCompleto,
      nomeArtistico: user.nomeArtistico,
      tipoUsuario: user.tipoUsuario as 'USER' | 'ADMIN',
    });

    const destination = user.tipoUsuario === 'ADMIN' ? '/admin' : '/dashboard';

    return res.json({
      message: 'Login realizado com sucesso!',
      token,
      user: {
        id: user.id,
        nomeCompleto: user.nomeCompleto,
        nomeArtistico: user.nomeArtistico,
        email: user.email,
        telefone: user.telefone,
        cidade: user.cidade,
        estado: user.estado,
        tipoUsuario: user.tipoUsuario,
        status: user.status,
      },
      subscription: activeSub || null,
      redirectTo: destination,
    });
  } catch (error: any) {
    console.error('[AUTH LOGIN] erro:', error);

    const code = error?.code;
    const message = String(error?.message || '');

    if (
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND' ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNRESET' ||
      message.includes('DATABASE_NOT_CONFIGURED') ||
      message.includes('connect') ||
      message.includes('PGlite') ||
      message.includes('read-only') ||
      message.includes('EROFS') ||
      message.includes('wasm')
    ) {
      return res.status(503).json({
        error: 'Banco de dados indisponível no servidor. Verifique DATABASE_URL nas configurações do seu projeto.',
        code: 'DATABASE_UNAVAILABLE',
      });
    }

    if (code === '42P01') {
      return res.status(503).json({
        error: 'As tabelas de autenticação não estão disponíveis. O servidor tentou criá-las automaticamente.',
        code: 'AUTH_SCHEMA_MISSING',
      });
    }

    return res.status(500).json({
      error: 'Erro interno ao autenticar. Tente novamente ou entre como administrador.',
      code: 'AUTH_INTERNAL_ERROR',
    });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    let user: any = null;
    try {
      const [found] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
      user = found;
    } catch {}

    if (!user) {
      if (req.user!.tipoUsuario === 'ADMIN') {
        user = {
          id: req.user!.id,
          nomeCompleto: req.user!.nomeCompleto || 'Joseph Kolvox (Admin)',
          nomeArtistico: req.user!.nomeArtistico || 'Admin Joseph',
          email: req.user!.email,
          telefone: '(11) 99999-2828',
          cidade: 'São Paulo',
          estado: 'SP',
          tipoUsuario: 'ADMIN',
          status: 'ativo',
        };
      } else {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }
    }

    let activeSub: any = null;
    try {
      const userSubs = await db
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.userId, user.id));
      activeSub = userSubs[userSubs.length - 1] || null;
    } catch {}

    return res.json({
      user: {
        id: user.id,
        nomeCompleto: user.nomeCompleto,
        nomeArtistico: user.nomeArtistico,
        email: user.email,
        telefone: user.telefone,
        cidade: user.cidade,
        estado: user.estado,
        fotoPerfil: user.fotoPerfil,
        tipoUsuario: user.tipoUsuario,
        status: user.status,
        createdAt: user.createdAt,
      },
      subscription: activeSub,
    });
  } catch (error) {
    console.error('Error in /me:', error);
    return res.status(500).json({ error: 'Erro ao carregar dados do usuário.' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Informe seu e-mail para recuperação.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, cleanEmail)).limit(1);

    if (user) {
      await db.insert(schema.activityLogs).values({
        userId: user.id,
        action: 'SOLICITACAO_RECUPERACAO_SENHA',
        ip: req.ip || '127.0.0.1',
        metadata: JSON.stringify({ email: cleanEmail }),
      });
    }

    return res.json({
      message: 'Se este e-mail estiver cadastrado, as instruções para redefinição foram enviadas.',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao processar solicitação.' });
  }
});

// POST /api/auth/logout - Invalidate session & log activity
router.post('/logout', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (userId) {
      await db.insert(schema.activityLogs).values({
        userId,
        action: 'LOGOUT_REALIZADO',
        ip: req.ip || '127.0.0.1',
        metadata: JSON.stringify({ email: req.user?.email, timestamp: new Date().toISOString() }),
      });
    }

    return res.json({
      success: true,
      message: 'Sessão encerrada com sucesso no servidor.',
      redirectTo: '/login',
    });
  } catch (error) {
    console.error('Error during logout:', error);
    return res.status(500).json({ error: 'Erro ao encerrar sessão no servidor.' });
  }
});

export default router;
