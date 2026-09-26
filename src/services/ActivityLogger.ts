export interface ClientActivity {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  actionType: 'LOGIN' | 'LOGOUT' | 'SHOW_MODE' | 'SONG' | 'SETLIST' | 'RECORDING' | 'PAYMENT' | 'TRIAL' | 'SUPPORT' | 'SYSTEM';
  action: string;
  details?: string;
  ip?: string;
  timestamp: string;
}

const STORAGE_KEY = 'kolvox_client_activities_history';

export function getClientActivities(filterUserId?: string): ClientActivity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let list: ClientActivity[] = raw ? JSON.parse(raw) : [];

    // If empty, populate with some realistic events
    if (list.length === 0) {
      list = getInitialActivities();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }

    if (filterUserId && filterUserId !== 'ALL') {
      return list.filter((act) => act.userId === filterUserId || act.userEmail === filterUserId);
    }
    return list;
  } catch (err) {
    console.warn('Error reading client activities:', err);
    return [];
  }
}

export function recordClientActivity(
  activity: Omit<ClientActivity, 'id' | 'timestamp'>
): ClientActivity {
  const newActivity: ClientActivity = {
    ...activity,
    id: 'act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    timestamp: new Date().toISOString(),
    ip: activity.ip || '127.0.0.1 (Web App)',
  };

  try {
    const current = getClientActivities();
    const updated = [newActivity, ...current].slice(0, 300); // keep up to 300 items
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Error saving client activity:', err);
  }

  // Also try sending to server background if reachable
  try {
    fetch('/api/admin/client-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newActivity),
    }).catch(() => {});
  } catch {}

  return newActivity;
}

export function clearClientActivities(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Error clearing activities:', err);
  }
}

function getInitialActivities(): ClientActivity[] {
  const now = Date.now();
  return [
    {
      id: 'act_init_1',
      userId: 'guest_vocalist_principal',
      userEmail: 'demo@kolvox.app',
      userName: 'Vocalista Convidado',
      actionType: 'LOGIN',
      action: 'Login no Sistema',
      details: 'Cliente acessou via login instantâneo (Modo Demonstração). Início do período de teste de 7 dias.',
      ip: '189.40.12.98 (São Paulo, BR)',
      timestamp: new Date(now - 1000 * 60 * 5).toISOString(),
    },
    {
      id: 'act_init_2',
      userId: 'guest_vocalist_principal',
      userEmail: 'demo@kolvox.app',
      userName: 'Vocalista Convidado',
      actionType: 'SHOW_MODE',
      action: 'Acessou o Modo Show',
      details: 'Música: "Lugar ao Sol" (Charlie Brown Jr) • Rolagem sincronizada com velocidade em tempo real.',
      ip: '189.40.12.98 (São Paulo, BR)',
      timestamp: new Date(now - 1000 * 60 * 15).toISOString(),
    },
    {
      id: 'act_init_3',
      userId: 'guest_vocalist_principal',
      userEmail: 'demo@kolvox.app',
      userName: 'Vocalista Convidado',
      actionType: 'SETLIST',
      action: 'Acessou Repertórios',
      details: 'Visualizou e organizou setlist "Show de Sexta no Pub" com 10 músicas.',
      ip: '189.40.12.98 (São Paulo, BR)',
      timestamp: new Date(now - 1000 * 60 * 35).toISOString(),
    },
    {
      id: 'act_init_4',
      userId: 'guest_vocalist_principal',
      userEmail: 'demo@kolvox.app',
      userName: 'Vocalista Convidado',
      actionType: 'TRIAL',
      action: 'Verificação de Teste de 7 Dias',
      details: 'Contagem regressiva de degustação de 7 dias ativa. Acesso liberado.',
      ip: '189.40.12.98 (São Paulo, BR)',
      timestamp: new Date(now - 1000 * 60 * 55).toISOString(),
    },
    {
      id: 'act_init_5',
      userId: 'admin_kolvox_master',
      userEmail: 'koljoseph2020@gmail.com',
      userName: 'KOLVOX Master Admin',
      actionType: 'SYSTEM',
      action: 'Acesso Administrativo',
      details: 'Painel Geral e monitoramento de clientes sincronizado com sucesso.',
      ip: '177.18.23.40 (São Paulo, BR)',
      timestamp: new Date(now - 1000 * 60 * 80).toISOString(),
    },
  ];
}
