import { recordClientActivity } from '../services/ActivityLogger';

export interface CustomerPlanInfo {
  userId: string;
  planType: 'ADMIN' | 'PRO' | 'TRIAL' | 'EXPIRED';
  planName: string;
  statusLabel: string;
  badgeClass: string;
  daysRemaining: number;
  hoursRemaining: number;
  isBlocked: boolean;
  expiresAtFormatted: string;
  expiryDateFormatted: string;
  needsRenewal: boolean;
  renewalUrgency: 'urgent' | 'warning' | 'normal' | 'none';
}

export function getCustomerPlanInfo(
  userId: string | number,
  userEmail?: string,
  userRole?: string,
  userCreatedAt?: string
): CustomerPlanInfo {
  const uid = String(userId);
  const email = (userEmail || '').toLowerCase();
  const isAdmin = userRole === 'admin' || userRole === 'ADMIN' || email === 'koljoseph2020@gmail.com';

  if (isAdmin) {
    return {
      userId: uid,
      planType: 'ADMIN',
      planName: 'KOLVOX Master Admin',
      statusLabel: 'Acesso Vitalício Admin',
      badgeClass: 'bg-purple-500/20 text-purple-300 border border-purple-500/40',
      daysRemaining: 9999,
      hoursRemaining: 24,
      isBlocked: false,
      expiresAtFormatted: 'Acesso Vitalício',
      expiryDateFormatted: 'Vitalício (Nunca expira)',
      needsRenewal: false,
      renewalUrgency: 'none',
    };
  }

  // Check stored active subscription
  try {
    const rawSub =
      localStorage.getItem('kolvox_sub_' + uid) ||
      (email ? localStorage.getItem('kolvox_sub_' + email) : null);
    if (rawSub) {
      const sub = JSON.parse(rawSub);
      if (sub && sub.isPremium) {
        return {
          userId: uid,
          planType: 'PRO',
          planName: sub.planType || 'Plano KOLVOX PRO',
          statusLabel: 'Plano PRO Ativo • Liberado',
          badgeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
          daysRemaining: 365,
          hoursRemaining: 24,
          isBlocked: false,
          expiresAtFormatted: 'Assinatura Ativa (365 dias)',
          expiryDateFormatted: 'Ativo (Renovação Automática)',
          needsRenewal: false,
          renewalUrgency: 'none',
        };
      }
    }
  } catch {}

  // Check forced expiration
  const forcedExpired =
    localStorage.getItem('kolvox_trial_override_' + uid) === 'expired' ||
    (email ? localStorage.getItem('kolvox_trial_override_' + email) === 'expired' : false);

  // Base creation time
  let regTimeStr = userCreatedAt;
  if (uid.startsWith('guest')) {
    const guestStart = localStorage.getItem('kolvox_guest_trial_start');
    if (guestStart) {
      regTimeStr = guestStart;
    } else {
      regTimeStr = new Date().toISOString();
      localStorage.setItem('kolvox_guest_trial_start', regTimeStr);
    }
  }

  const extendedDays = Number(
    localStorage.getItem('kolvox_trial_extended_' + uid) ||
      (email ? localStorage.getItem('kolvox_trial_extended_' + email) : null) ||
      '0'
  );
  const totalDays = 7 + extendedDays;

  const regTimestamp = new Date(regTimeStr || Date.now()).getTime();
  const nowTimestamp = Date.now();
  const totalDurationMs = totalDays * 24 * 60 * 60 * 1000;
  const elapsedMs = nowTimestamp - regTimestamp;
  const remainingMs = totalDurationMs - elapsedMs;

  const expiryDate = new Date(regTimestamp + totalDurationMs);
  const formattedExpiry = expiryDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  if (forcedExpired || remainingMs <= 0) {
    return {
      userId: uid,
      planType: 'EXPIRED',
      planName: 'Teste de 7 Dias',
      statusLabel: 'Bloqueado • Teste de 7 Dias Expirado',
      badgeClass: 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse',
      daysRemaining: 0,
      hoursRemaining: 0,
      isBlocked: true,
      expiresAtFormatted: `Expirou em ${formattedExpiry}`,
      expiryDateFormatted: formattedExpiry,
      needsRenewal: true,
      renewalUrgency: 'urgent',
    };
  }

  const daysLeft = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  const isWarning = daysLeft <= 2;

  return {
    userId: uid,
    planType: 'TRIAL',
    planName: 'Degustação Gratuita (7 Dias)',
    statusLabel: `${daysLeft}d ${hoursLeft}h restantes`,
    badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    daysRemaining: daysLeft,
    hoursRemaining: hoursLeft,
    isBlocked: false,
    expiresAtFormatted: `Vence em ${formattedExpiry}`,
    expiryDateFormatted: formattedExpiry,
    needsRenewal: isWarning,
    renewalUrgency: isWarning ? 'warning' : 'normal',
  };
}

export function adminGrantCustomerPlan(
  targetUserId: string | number,
  clientName: string,
  clientEmail: string,
  planType: 'kolvox_pro_monthly' | 'kolvox_pro_yearly' = 'kolvox_pro_yearly'
): void {
  const uid = String(targetUserId);
  const planLabel = planType === 'kolvox_pro_yearly' ? 'Plano Anual (R$ 99,99/ano)' : 'Plano Mensal (R$ 9,99/mês)';

  const sub = {
    id: Date.now(),
    isPremium: true,
    plan: planType,
    planType: planLabel,
    status: 'active',
    referenceCode: `ADM-PIX-${Date.now().toString().slice(-6)}`,
    activatedAt: new Date().toISOString(),
    grantedByAdmin: true,
  };

  localStorage.setItem('kolvox_sub_' + uid, JSON.stringify(sub));
  localStorage.removeItem('kolvox_trial_override_' + uid);
  if (clientEmail) {
    const normEmail = clientEmail.toLowerCase().trim();
    localStorage.setItem('kolvox_sub_' + normEmail, JSON.stringify(sub));
    localStorage.removeItem('kolvox_trial_override_' + normEmail);
  }

  recordClientActivity({
    userId: uid,
    userEmail: clientEmail || 'cliente@kolvox.app',
    userName: clientName || 'Cliente KOLVOX',
    actionType: 'PAYMENT',
    action: 'Pagamento Pix Reconhecido pelo Administrador',
    details: `O administrador confirmou o recebimento do pagamento Pix e liberou o acesso imediatamente (${planLabel}).`,
  });
}

export function adminExtendTrialDays(
  targetUserId: string | number,
  clientName: string,
  clientEmail: string,
  daysToAdd: number = 7
): void {
  const uid = String(targetUserId);
  const currentExt = Number(localStorage.getItem('kolvox_trial_extended_' + uid) || '0');
  localStorage.setItem('kolvox_trial_extended_' + uid, String(currentExt + daysToAdd));
  localStorage.removeItem('kolvox_trial_override_' + uid);
  if (clientEmail) {
    const normEmail = clientEmail.toLowerCase().trim();
    localStorage.setItem('kolvox_trial_extended_' + normEmail, String(currentExt + daysToAdd));
    localStorage.removeItem('kolvox_trial_override_' + normEmail);
  }

  recordClientActivity({
    userId: uid,
    userEmail: clientEmail || 'cliente@kolvox.app',
    userName: clientName || 'Cliente KOLVOX',
    actionType: 'TRIAL',
    action: `Extensão do Teste (+${daysToAdd} Dias)`,
    details: `Administrador concedeu mais ${daysToAdd} dias de teste gratuito para o cliente.`,
  });
}

export function adminExpireCustomerTrial(
  targetUserId: string | number,
  clientName: string,
  clientEmail: string
): void {
  const uid = String(targetUserId);
  localStorage.setItem('kolvox_trial_override_' + uid, 'expired');
  localStorage.removeItem('kolvox_sub_' + uid);
  if (clientEmail) {
    const normEmail = clientEmail.toLowerCase().trim();
    localStorage.setItem('kolvox_trial_override_' + normEmail, 'expired');
    localStorage.removeItem('kolvox_sub_' + normEmail);
  }

  if (uid.startsWith('guest')) {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem('kolvox_guest_trial_start', eightDaysAgo);
  }

  recordClientActivity({
    userId: uid,
    userEmail: clientEmail || 'cliente@kolvox.app',
    userName: clientName || 'Cliente KOLVOX',
    actionType: 'TRIAL',
    action: 'Bloqueio do Teste pelo Administrador',
    details: 'Administrador encerrou o período de teste. O acesso do cliente foi bloqueado até o pagamento.',
  });
}

export function adminRevokeCustomerPlan(
  targetUserId: string | number,
  clientName: string,
  clientEmail: string
): void {
  const uid = String(targetUserId);
  localStorage.removeItem('kolvox_sub_' + uid);
  localStorage.setItem('kolvox_trial_override_' + uid, 'expired');
  if (clientEmail) {
    const normEmail = clientEmail.toLowerCase().trim();
    localStorage.removeItem('kolvox_sub_' + normEmail);
    localStorage.setItem('kolvox_trial_override_' + normEmail, 'expired');
  }

  recordClientActivity({
    userId: uid,
    userEmail: clientEmail || 'cliente@kolvox.app',
    userName: clientName || 'Cliente KOLVOX',
    actionType: 'PAYMENT',
    action: 'Plano PRO Removido Manualmente pelo Administrador',
    details: 'O administrador removeu o plano PRO do cliente manualmente. O acesso ilimitado foi revogado.',
  });
}

export function deleteCustomerPlanData(
  targetUserId: string | number,
  clientEmail?: string
): void {
  const uid = String(targetUserId);
  localStorage.removeItem('kolvox_sub_' + uid);
  localStorage.removeItem('kolvox_trial_override_' + uid);
  localStorage.removeItem('kolvox_trial_extended_' + uid);
  if (clientEmail) {
    localStorage.removeItem('kolvox_sub_' + clientEmail.toLowerCase());
  }
}

