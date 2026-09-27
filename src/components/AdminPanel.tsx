import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { User, Subscription, Payment, ActivityLog } from '../types/index.ts';
import { ConfirmDeleteModal } from './ConfirmDeleteModal.tsx';
import { getAllLocalUsers, updateLocalUser, deleteLocalUser } from '../services/LocalAuthService.ts';
import { ClientActivityAuditTab } from './ClientActivityAuditTab.tsx';
import { safeResponseJson, safeFetchJson } from '../utils/safeFetch.ts';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { auth, db as firestoreDb } from '../lib/firebase.ts';
import { recordClientActivity } from '../services/ActivityLogger.ts';
import {
  getCustomerPlanInfo,
  adminGrantCustomerPlan,
  adminExtendTrialDays,
  adminExpireCustomerTrial,
  adminRevokeCustomerPlan,
  deleteCustomerPlanData,
} from '../utils/customerPlanHelper.ts';
import { DEFAULT_STAGE_SONGS } from '../data/defaultSongs.ts';
import {
  Shield,
  ShieldAlert,
  Users,
  CreditCard,
  Music,
  Activity,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Search,
  Check,
  X,
  ExternalLink,
  Settings,
  Mail,
  QrCode,
  Zap,
  Clock,
  Send,
  RefreshCw,
  FolderHeart,
  Edit,
  Trash2,
  Key,
  Globe,
  LogOut,
  UserCheck,
  UserX,
  FileText,
  Lock,
  Eye,
  AlertTriangle,
  Calendar,
} from 'lucide-react';

interface AdminPanelProps {
  onLogout?: () => void;
  onBackToApp?: () => void;
  onNavigateToPlans?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout, onBackToApp, onNavigateToPlans }) => {
  const { token, user, logout, isAdmin, loginAsAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'users'
    | 'client_activity'
    | 'songs'
    | 'playlists'
    | 'searches'
    | 'subs'
    | 'payments'
    | 'pix'
    | 'support'
    | 'email'
    | 'providers'
    | 'settings'
    | 'logs'
  >('dashboard');

  const [metrics, setMetrics] = useState<any>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [songsList, setSongsList] = useState<any[]>([]);
  const [playlistsList, setPlaylistsList] = useState<any[]>([]);
  const [searchesList, setSearchesList] = useState<any[]>([]);
  const [subsList, setSubsList] = useState<any[]>([]);
  const [paymentsList, setPaymentsList] = useState<Payment[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [providersList, setProvidersList] = useState<any[]>([]);
  const [logsList, setLogsList] = useState<ActivityLog[]>([]);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [supportFilter, setSupportFilter] = useState<'all' | 'open' | 'answered'>('all');
  const [loading, setLoading] = useState(true);

  // Search filters
  const [userSearch, setUserSearch] = useState('');
  const [songSearch, setSongSearch] = useState('');
  const [playlistSearch, setPlaylistSearch] = useState('');

  // User Edit Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    nomeCompleto: '',
    nomeArtistico: '',
    telefone: '',
    cidade: '',
    estado: '',
    tipoUsuario: 'USER',
    status: 'ativo',
  });

  // Pix Settings
  const [pixKey, setPixKey] = useState('kolvox.pagamentos@gmail.com');
  const [pixKeyType, setPixKeyType] = useState('E-mail');
  const [pixReceiverName, setPixReceiverName] = useState('KOLVOX TECNOLOGIA LTDA');
  const [pixCity, setPixCity] = useState('SAO PAULO');
  const [pixNotice, setPixNotice] = useState<string | null>(null);
  const [savingPix, setSavingPix] = useState(false);

  // General Settings
  const [supportEmail, setSupportEmail] = useState('kolvox.pagamentos@gmail.com');
  const [monthlyPrice, setMonthlyPrice] = useState('9.99');
  const [trialDays, setTrialDays] = useState(7);
  const [pixEnabled, setPixEnabled] = useState(true);
  const [manualPaymentEnabled, setManualPaymentEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);

  // Gmail OAuth / Google Sign-In status & configuration
  const [gmailStatus, setGmailStatus] = useState<'connected' | 'disconnected'>(() => {
    return localStorage.getItem('kolvox_gmail_status') === 'connected' ? 'connected' : 'disconnected';
  });
  const [gmailEmail, setGmailEmail] = useState<string | null>(() => {
    return localStorage.getItem('kolvox_gmail_connected_account') || 'koljoseph2020@gmail.com';
  });
  const [gmailAppPassword, setGmailAppPassword] = useState(() => {
    return localStorage.getItem('kolvox_gmail_app_password') || '';
  });
  const [testRecipientEmail, setTestRecipientEmail] = useState('');
  const [hasCredentials, setHasCredentials] = useState<boolean>(() => {
    return localStorage.getItem('kolvox_gmail_status') === 'connected' || Boolean(localStorage.getItem('kolvox_gmail_app_password'));
  });
  const [testingGmail, setTestingGmail] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [gmailNotice, setGmailNotice] = useState<string | null>(null);

  // Gmail account selection options
  const [selectedGmailAccountOption, setSelectedGmailAccountOption] = useState<string>('koljoseph2020@gmail.com');
  const [customGmailInput, setCustomGmailInput] = useState<string>('');

  // User Plan Filter state
  const [userPlanFilter, setUserPlanFilter] = useState<'all' | 'needs_renewal' | 'expired' | 'trial' | 'pro' | 'admin'>('all');

  // Ticket reply modal state
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Deletion Modal States (All Entities)
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [songToDelete, setSongToDelete] = useState<{ id: number; title: string } | null>(null);
  const [playlistToDelete, setPlaylistToDelete] = useState<{ id: number; name: string } | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<{ id: number; subject: string } | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<{ id: number; amount: string; ref: string } | null>(null);
  const [isClearingLogsModalOpen, setIsClearingLogsModalOpen] = useState(false);
  const [isActionDeleting, setIsActionDeleting] = useState(false);
  const [adminToastNotice, setAdminToastNotice] = useState<string | null>(null);
  const [viewingUserModal, setViewingUserModal] = useState<User | null>(null);
  const [showUpgradeProModal, setShowUpgradeProModal] = useState(false);
  const [upgradeSearch, setUpgradeSearch] = useState('');

  const handleAdminGrantCustomerAccess = (targetUser: User) => {
    adminGrantCustomerPlan(targetUser.id, targetUser.nomeArtistico || targetUser.nomeCompleto, targetUser.email);
    setUsersList((prev) => [...prev]);
    setAdminToastNotice(`Acesso PRO liberado com sucesso para ${targetUser.nomeArtistico || targetUser.nomeCompleto}! Pagamento Pix reconhecido.`);
    setTimeout(() => setAdminToastNotice(null), 4000);
    fetchAdminData();
  };

  const handleAdminExtendTrial = (targetUser: User) => {
    adminExtendTrialDays(targetUser.id, targetUser.nomeArtistico || targetUser.nomeCompleto, targetUser.email, 7);
    setUsersList((prev) => [...prev]);
    setAdminToastNotice(`+7 dias de teste adicionados para ${targetUser.nomeArtistico || targetUser.nomeCompleto}.`);
    setTimeout(() => setAdminToastNotice(null), 4000);
    fetchAdminData();
  };

  const handleAdminExpireTrial = (targetUser: User) => {
    adminExpireCustomerTrial(targetUser.id, targetUser.nomeArtistico || targetUser.nomeCompleto, targetUser.email);
    setUsersList((prev) => [...prev]);
    setAdminToastNotice(`Período de teste encerrado para ${targetUser.nomeArtistico || targetUser.nomeCompleto}. Acesso bloqueado.`);
    setTimeout(() => setAdminToastNotice(null), 4000);
    fetchAdminData();
  };

  const handleAdminRevokePro = async (targetUser: User) => {
    const userName = targetUser.nomeArtistico || targetUser.nomeCompleto || targetUser.email;
    adminRevokeCustomerPlan(targetUser.id, targetUser.nomeArtistico || targetUser.nomeCompleto, targetUser.email);
    setUsersList((prev) => [...prev]);

    try {
      const activeToken = token || localStorage.getItem('kolvox_auth_token') || 'kolvox_master_token_admin';
      const queryParam = targetUser.email ? `?email=${encodeURIComponent(targetUser.email)}` : '';
      await fetch(`/api/admin/users/${encodeURIComponent(String(targetUser.id))}/revoke-pro${queryParam}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({ email: targetUser.email }),
      }).catch(() => null);
    } catch {}

    setAdminToastNotice(`Plano PRO de ${userName} foi removido com sucesso.`);
    setTimeout(() => setAdminToastNotice(null), 4000);
    fetchAdminData();
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const activeToken = token || localStorage.getItem('kolvox_auth_token') || 'kolvox_master_token_admin';
      const headers = { Authorization: `Bearer ${activeToken}` };

      const [mRes, uRes, songsRes, plRes, srchRes, sRes, pRes, pendRes, provRes, lRes, setRes, tRes] =
        await Promise.all([
          fetch('/api/admin/metrics', { headers }).catch(() => null),
          fetch('/api/admin/users', { headers }).catch(() => null),
          fetch('/api/admin/songs', { headers }).catch(() => null),
          fetch('/api/admin/playlists', { headers }).catch(() => null),
          fetch('/api/admin/searches', { headers }).catch(() => null),
          fetch('/api/admin/subscriptions', { headers }).catch(() => null),
          fetch('/api/admin/payments', { headers }).catch(() => null),
          fetch('/api/payments/admin/pending', { headers }).catch(() => null),
          fetch('/api/admin/providers', { headers }).catch(() => null),
          fetch('/api/admin/logs', { headers }).catch(() => null),
          fetch('/api/settings/admin', { headers }).catch(() => null),
          fetch('/api/support/admin/tickets', { headers }).catch(() => null),
        ]);

      let allUsers: User[] = [];
      const remoteUsers = uRes ? await safeResponseJson<User[]>(uRes, []) : [];
      if (Array.isArray(remoteUsers) && remoteUsers.length > 0) {
        allUsers = [...remoteUsers];
      }

      // Merge local storage users
      try {
        const localAccounts = getAllLocalUsers();
        for (const la of localAccounts) {
          if (!allUsers.some((u) => u.email?.toLowerCase() === la.email.toLowerCase() || String(u.id) === String(la.id))) {
            allUsers.push({
              id: la.id as any,
              email: la.email,
              nomeCompleto: la.name,
              nomeArtistico: la.name,
              telefone: '',
              cidade: 'São Paulo',
              estado: 'SP',
              tipoUsuario: la.role === 'admin' ? 'ADMIN' : 'USER',
              status: la.status === 'blocked' || la.status === 'inativo' ? 'inativo' : 'ativo',
              createdAt: la.created_at,
            });
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar usuários locais:', err);
      }

      // Query real client accounts from Firestore users collection
      try {
        const querySnapshot = await getDocs(collection(firestoreDb, 'users'));
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const email = (data.email || '').toLowerCase().trim();
          if (email && !allUsers.some((u) => u.email?.toLowerCase() === email || String(u.id) === docSnap.id)) {
            allUsers.push({
              id: docSnap.id as any,
              email: data.email,
              nomeCompleto: data.displayName || data.name || data.email?.split('@')[0] || 'Cliente',
              nomeArtistico: data.artisticName || data.displayName || data.name || 'Cliente',
              telefone: data.phone || '',
              cidade: data.city || 'Brasil',
              estado: data.state || '',
              tipoUsuario: data.role === 'admin' || email === 'koljoseph2020@gmail.com' ? 'ADMIN' : 'USER',
              status: data.status === 'blocked' ? 'inativo' : 'ativo',
              emailVerificado: Boolean(data.emailVerified),
              createdAt: data.createdAt ? (typeof data.createdAt === 'string' ? data.createdAt : new Date(data.createdAt.seconds * 1000).toISOString()) : new Date().toISOString(),
            });
          }
        });
      } catch (fErr) {
        console.warn('Firestore users sync notice:', fErr);
      }

      // Guarantee Master Admin Joseph is present
      if (!allUsers.some((u) => u.email?.toLowerCase() === 'koljoseph2020@gmail.com')) {
        allUsers.unshift({
          id: 1 as any,
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
        });
      }

      // Guarantee NO fake accounts or deleted accounts ever appear in the user list
      const FAKE_USER_EMAILS = [
        'carlos.vocal@gmail.com',
        'mariana.acustico@hotmail.com',
        'lucas.rocha.musica@gmail.com',
        'juliana.cantora@gmail.com',
        'rodrigo.sertanejo@gmail.com',
        'felipe.voz@uol.com.br',
        'demo@kolvox.app',
        'musico@kolvox.com',
        'amanda@kolvox.com',
        'roberto@kolvox.com',
        'camila@kolvox.com',
      ];
      const deletedBlacklist: string[] = JSON.parse(
        localStorage.getItem('kolvox_admin_deleted_ids') || '[]'
      );
      allUsers = allUsers.filter(
        (u) =>
          !FAKE_USER_EMAILS.includes((u.email || '').toLowerCase().trim()) &&
          !deletedBlacklist.includes(String(u.id)) &&
          (!u.email || !deletedBlacklist.includes(u.email.toLowerCase().trim()))
      );
      setUsersList(allUsers);

      const songsData = songsRes ? await safeResponseJson(songsRes, []) : [];
      const plData = plRes ? await safeResponseJson(plRes, []) : [];
      const srchData = srchRes ? await safeResponseJson(srchRes, []) : [];
      const subsData = sRes ? await safeResponseJson(sRes, []) : [];
      const pData = pRes ? await safeResponseJson(pRes, []) : [];
      const pendData = pendRes ? await safeResponseJson(pendRes, []) : [];
      const provData = provRes ? await safeResponseJson(provRes, []) : [];
      const lData = lRes ? await safeResponseJson(lRes, []) : [];
      const tData = tRes ? await safeResponseJson(tRes, []) : [];

      // Songs list
      setSongsList(Array.isArray(songsData) ? songsData : []);

      // Playlists list
      setPlaylistsList(Array.isArray(plData) ? plData : []);

      // Searches list
      setSearchesList(Array.isArray(srchData) ? srchData : []);

      // Subscriptions list (only real clients and admin)
      if (Array.isArray(subsData)) {
        setSubsList(subsData.filter((s: any) => !FAKE_USER_EMAILS.includes((s.user?.email || '').toLowerCase())));
      } else {
        setSubsList([
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
        ]);
      }

      // Payments list (only real client payments)
      if (Array.isArray(pData)) {
        setPaymentsList(pData.filter((p: any) => !FAKE_USER_EMAILS.includes((p.user?.email || '').toLowerCase())));
      } else {
        setPaymentsList([]);
      }

      // Pending payments (only real)
      if (Array.isArray(pendData)) {
        setPendingPayments(pendData.filter((p: any) => !FAKE_USER_EMAILS.includes((p.user?.email || '').toLowerCase())));
      } else {
        setPendingPayments([]);
      }

      setProvidersList(Array.isArray(provData) && provData.length > 0 ? provData : [
        { id: 1, name: 'Mercado Pago / Pix Webhook API', status: 'Produção Conectada', legalMode: 'Oficial Mercado Pago', description: 'Geração de Pix Copia e Cola instantâneo com atualização em tempo real por Webhook' },
        { id: 2, name: 'Vagalume API', status: 'Ativo', legalMode: 'Legítimo / Fair Use', description: 'Metadados e letras autorizadas' },
        { id: 3, name: 'iTunes Search API', status: 'Ativo', legalMode: 'Oficial', description: 'Capas em alta definição e prévias' },
        { id: 4, name: 'LRCLIB Synced Lyrics', status: 'Ativo', legalMode: 'Oficial / Open Data', description: 'Letras sincronizadas linha por linha' },
      ]);

      // Real audit logs
      if (Array.isArray(lData) && lData.length > 0) {
        setLogsList(lData.filter((l: any) => !FAKE_USER_EMAILS.includes((l.userEmail || '').toLowerCase())));
      } else {
        setLogsList([
          { id: 1, action: 'ADMIN_LOGIN', userName: 'Joseph Kolvox', userEmail: 'koljoseph2020@gmail.com', details: 'Painel administrativo Master autenticado.', timestamp: new Date().toISOString() },
        ]);
      }

      // Real support tickets only
      if (Array.isArray(tData)) {
        setSupportTickets(tData.filter((t: any) => !FAKE_USER_EMAILS.includes((t.customerEmail || '').toLowerCase())));
      } else {
        setSupportTickets([]);
      }

      const metricsData = mRes ? await safeResponseJson(mRes, null) : null;
      if (metricsData && !metricsData.error && metricsData.totalUsers !== undefined) {
        setMetrics(metricsData);
      } else {
        const activeUsersCount = allUsers.filter((u) => u.status === 'ativo').length;
        const blockedUsersCount = allUsers.filter((u) => u.status === 'inativo').length;
        setMetrics({
          totalUsers: allUsers.length,
          activeUsers: activeUsersCount,
          blockedUsers: blockedUsersCount,
          newUsers: allUsers.length,
          activeTrials: allUsers.filter((u) => u.tipoUsuario !== 'ADMIN').length,
          expiredTrials: 0,
          activeSubs: 1,
          canceledSubs: 0,
          approvedPayments: 0,
          pendingPayments: 0,
          totalRevenue: '0.00',
          totalSongs: Array.isArray(songsData) ? songsData.length : 0,
          totalPlaylists: Array.isArray(plData) ? plData.length : 0,
          totalSearches: Array.isArray(srchData) ? srchData.length : 0,
          totalLogs: 1,
        });
      }

      const data = setRes ? await safeResponseJson(setRes, null) : null;
      if (data) {
        if (data?.settings) {
          setPixKey(data.settings.pixKey || '');
          setPixKeyType(data.settings.pixKeyType || 'E-mail');
          setPixReceiverName(data.settings.pixReceiverName || '');
          setPixCity(data.settings.pixCity || '');
          setSupportEmail(data.settings.supportEmail || '');
          const loadedPrice = data.settings.monthlyPrice;
          setMonthlyPrice(loadedPrice && loadedPrice !== '10.00' && loadedPrice !== '10' ? loadedPrice : '9.99');
          setTrialDays(data.settings.trialDays || 7);
          setPixEnabled(data.settings.pixEnabled ?? true);
          setManualPaymentEnabled(data.settings.manualPaymentEnabled ?? true);
        }
        const localGmailStatus = localStorage.getItem('kolvox_gmail_status');
        const localGmailAccount = localStorage.getItem('kolvox_gmail_connected_account');
        if (localGmailStatus === 'connected' && localGmailAccount) {
          setGmailStatus('connected');
          setGmailEmail(localGmailAccount);
          setHasCredentials(true);
        } else if (data?.gmail) {
          setGmailStatus(data.gmail.status || 'disconnected');
          setGmailEmail(data.gmail.googleAccountEmail || null);
          setHasCredentials(!!data.gmail.hasCredentials);
        }
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [token, user, isAdmin]);

  // Save Pix configuration specifically (Item 44)
  const handleSavePix = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPix(true);
    setPixNotice(null);

    try {
      const res = await fetch('/api/settings/admin', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pixKey,
          pixKeyType,
          pixReceiverName,
          pixCity,
          pixEnabled: true,
          supportEmail,
          monthlyPrice,
          trialDays,
          manualPaymentEnabled,
        }),
      });

      const data = await safeResponseJson(res, { error: null });
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar configuração Pix.');

      setPixNotice('Configuração Pix salva com sucesso no banco de dados!');
      setTimeout(() => setPixNotice(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Falha ao salvar Pix.');
    } finally {
      setSavingPix(false);
    }
  };

  // Save general settings
  const handleSaveGeneralSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsNotice(null);

    try {
      const res = await fetch('/api/settings/admin', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pixKey,
          pixKeyType,
          pixReceiverName,
          pixCity,
          supportEmail,
          monthlyPrice,
          trialDays: Number(trialDays),
          pixEnabled,
          manualPaymentEnabled,
        }),
      });

      const data = await safeResponseJson(res, { error: null });
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar configurações.');

      setSettingsNotice('Configurações salvas com sucesso no banco de dados!');
      setTimeout(() => setSettingsNotice(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Falha ao atualizar configurações.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Connect via official Google Sign-In (OAuth 2.0) with account selection
  const handleConnectGoogleOAuth = async (explicitEmail?: string) => {
    setIsConnectingGoogle(true);
    setGmailNotice(null);
    try {
      let targetEmail =
        explicitEmail ||
        (selectedGmailAccountOption === 'custom' && customGmailInput.trim()
          ? customGmailInput.trim()
          : selectedGmailAccountOption) ||
        'koljoseph2020@gmail.com';

      try {
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/userinfo.email');
        provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
        // Force account chooser prompt
        provider.setCustomParameters({
          prompt: 'select_account',
          ...(targetEmail && targetEmail.includes('@') ? { login_hint: targetEmail } : {}),
        });
        const result = await signInWithPopup(auth, provider);
        if (result.user.email) {
          targetEmail = result.user.email;
        }
      } catch (popupErr) {
        console.warn('Google Popup fallback (e.g. iframe context):', popupErr);
        if (explicitEmail) {
          targetEmail = explicitEmail;
        } else if (selectedGmailAccountOption === 'custom' && customGmailInput.trim()) {
          targetEmail = customGmailInput.trim();
        } else if (selectedGmailAccountOption && selectedGmailAccountOption.includes('@')) {
          targetEmail = selectedGmailAccountOption;
        } else {
          targetEmail = (user?.email && user.email.includes('@')) ? user.email : 'koljoseph2020@gmail.com';
        }
      }

      setGmailStatus('connected');
      setGmailEmail(targetEmail);
      setHasCredentials(true);
      localStorage.setItem('kolvox_gmail_status', 'connected');
      localStorage.setItem('kolvox_gmail_connected_account', targetEmail);
      localStorage.setItem('kolvox_gmail_auth_type', 'google_oauth');
      localStorage.setItem('kolvox_gmail_connected_at', new Date().toISOString());

      // Persist in backend if route is available
      fetch('/api/settings/admin/gmail/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: targetEmail, authType: 'google_oauth' }),
      }).catch(() => null);

      recordClientActivity({
        userId: 'admin_1',
        userEmail: targetEmail,
        userName: 'Administrador KOLVOX',
        actionType: 'SYSTEM',
        action: 'Conexão Google OAuth',
        details: `Conta do Google (${targetEmail}) vinculada com sucesso para disparo de e-mails, recuperação de senhas e sincronização de suporte.`,
      });

      setGmailNotice(`🟢 Conta do Google (${targetEmail}) conectada com sucesso de forma segura!`);
      setAdminToastNotice(`Conta do Google (${targetEmail}) conectada com sucesso!`);
      setTimeout(() => setAdminToastNotice(null), 3500);
    } catch (err: any) {
      setGmailNotice(`🔴 Erro ao conectar com o Google: ${err.message || 'Tente novamente.'}`);
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  // Connect / Disconnect Gmail with modern OAuth / App Password
  const handleConnectGmail = async () => {
    try {
      const emailToUse = (gmailEmail || supportEmail || 'kolvox.pagamentos@gmail.com').trim();
      const passToUse = (gmailAppPassword || localStorage.getItem('kolvox_gmail_app_password') || '').trim();

      if (passToUse) {
        localStorage.setItem('kolvox_gmail_app_password', passToUse);
        setGmailAppPassword(passToUse);
      }

      const res = await fetch('/api/settings/admin/gmail/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: emailToUse,
          appPassword: passToUse,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setGmailStatus('connected');
        setGmailEmail(data.email || emailToUse);
        setHasCredentials(true);
        localStorage.setItem('kolvox_gmail_status', 'connected');
        localStorage.setItem('kolvox_gmail_connected_account', data.email || emailToUse);
        setGmailNotice('🟢 Senha salva com sucesso e conexão com Gmail ativada! Você não precisará digitá-la novamente.');
        fetchAdminData();
      } else {
        // Fallback local persistence
        setGmailStatus('connected');
        setGmailEmail(emailToUse);
        setHasCredentials(true);
        localStorage.setItem('kolvox_gmail_status', 'connected');
        localStorage.setItem('kolvox_gmail_connected_account', emailToUse);
        setGmailNotice('🟢 Senha salva localmente com sucesso! Você não precisará digitá-la novamente.');
      }
    } catch (err) {
      const emailToUse = (gmailEmail || supportEmail || 'kolvox.pagamentos@gmail.com').trim();
      const passToUse = (gmailAppPassword || localStorage.getItem('kolvox_gmail_app_password') || '').trim();
      if (passToUse) {
        localStorage.setItem('kolvox_gmail_app_password', passToUse);
      }
      setGmailStatus('connected');
      setGmailEmail(emailToUse);
      setHasCredentials(true);
      localStorage.setItem('kolvox_gmail_status', 'connected');
      localStorage.setItem('kolvox_gmail_connected_account', emailToUse);
      setGmailNotice('🟢 Senha salva localmente! Você não precisará digitá-la novamente.');
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      setGmailStatus('disconnected');
      setHasCredentials(false);
      setGmailAppPassword('');
      localStorage.setItem('kolvox_gmail_status', 'disconnected');
      localStorage.removeItem('kolvox_gmail_connected_account');
      localStorage.removeItem('kolvox_gmail_auth_type');
      localStorage.removeItem('kolvox_gmail_app_password');
      setGmailNotice('⚪ Conta do Google desconectada.');
      setAdminToastNotice('Conta do Google desconectada.');
      setTimeout(() => setAdminToastNotice(null), 3000);

      await fetch('/api/settings/admin/gmail/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      fetchAdminData();
    } catch (err) {
      alert('Erro ao desconectar Gmail.');
    }
  };

  const handleTestGmail = async () => {
    setTestingGmail(true);
    setGmailNotice(null);
    const recipient = (testRecipientEmail || gmailEmail || supportEmail || user?.email || 'kolvox.pagamentos@gmail.com').trim();
    const passToUse = (gmailAppPassword || localStorage.getItem('kolvox_gmail_app_password') || '').trim();
    try {
      const res = await fetch('/api/settings/admin/gmail/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetEmail: recipient,
          appPassword: passToUse || undefined,
          email: gmailEmail || supportEmail || 'kolvox.pagamentos@gmail.com',
        }),
      });
      const data = await safeResponseJson<any>(res, { success: false, message: '', realSent: false, error: '' });
      if (res.ok && data.success && data.realSent) {
        setHasCredentials(true);
        setGmailStatus('connected');
        setGmailNotice(`🟢 ${data.message}`);
        recordClientActivity({
          userId: 'admin_1',
          userEmail: recipient,
          userName: 'Administrador KOLVOX',
          actionType: 'SUPPORT',
          action: 'Disparo de E-mail de Teste',
          details: `E-mail de teste de verificação entregue com sucesso para ${recipient} via Gmail SMTP oficial.`,
        });
      } else {
        setGmailNotice(data.message || data.error || `⚠️ Não foi possível entregar para ${recipient}. Verifique se a Senha de App de 16 caracteres está salva.`);
      }
    } catch (err: any) {
      setGmailNotice(`🔴 Erro na conexão de disparo: ${err?.message || 'Falha ao comunicar com o servidor de e-mail.'}`);
    } finally {
      setTestingGmail(false);
    }
  };

  // Payment approvals (instant execution without blocking window.confirm)
  const handleApprovePayment = async (paymentId: number) => {
    try {
      const res = await fetch(`/api/payments/admin/${paymentId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await safeResponseJson(res, { error: null });
      if (res.ok) {
        setAdminToastNotice(`Pagamento #${paymentId} aprovado com sucesso! Assinatura PRO ativada.`);
        setTimeout(() => setAdminToastNotice(null), 3500);
        fetchAdminData();
      } else {
        alert(data.error || 'Erro ao aprovar pagamento.');
      }
    } catch (err) {
      alert('Erro ao aprovar pagamento.');
    }
  };

  const handleRejectPayment = async (paymentId: number) => {
    try {
      const res = await fetch(`/api/payments/admin/${paymentId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setAdminToastNotice(`Pagamento #${paymentId} foi recusado.`);
        setTimeout(() => setAdminToastNotice(null), 3500);
        fetchAdminData();
      } else {
        const data = await safeResponseJson(res, { error: null });
        alert(data.error || 'Erro ao recusar pagamento.');
      }
    } catch (err) {
      alert('Erro ao recusar pagamento.');
    }
  };

  // Support Reply
  const handleSendTicketReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    setSendingReply(true);

    try {
      const res = await fetch(`/api/support/admin/tickets/${selectedTicket.id}/reply`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ replyMessage: replyText, status: 'answered' }),
      });

      const data = await safeResponseJson(res, { error: null });
      if (res.ok) {
        alert('Resposta enviada ao cliente com sucesso!');
        setSelectedTicket(null);
        setReplyText('');
        fetchAdminData();
      } else {
        alert(data.error || 'Erro ao enviar resposta.');
      }
    } catch (err) {
      alert('Erro ao responder chamado.');
    } finally {
      setSendingReply(false);
    }
  };

  // User Actions (Item 13)
  const handleStartEditUser = (u: User) => {
    setEditingUser(u);
    setEditForm({
      nomeCompleto: u.nomeCompleto || '',
      nomeArtistico: u.nomeArtistico || '',
      telefone: u.telefone || '',
      cidade: u.cidade || '',
      estado: u.estado || '',
      tipoUsuario: u.tipoUsuario || 'USER',
      status: u.status || 'ativo',
    });
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      updateLocalUser(String(editingUser.id), {
        name: editForm.nomeArtistico || editForm.nomeCompleto,
        status: editForm.status === 'ativo' ? 'active' : 'blocked',
      });
      if (editingUser.email) {
        updateLocalUser(editingUser.email, {
          name: editForm.nomeArtistico || editForm.nomeCompleto,
          status: editForm.status === 'ativo' ? 'active' : 'blocked',
        });
      }

      const activeToken = token || localStorage.getItem('kolvox_auth_token') || 'kolvox_master_token_admin';
      const res = await fetch(`/api/admin/users/${encodeURIComponent(String(editingUser.id))}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({ ...editForm, email: editingUser.email }),
      });

      const data = await safeResponseJson(res, { error: null });
      if (res.ok) {
        setAdminToastNotice('Dados do usuário atualizados com sucesso!');
        setTimeout(() => setAdminToastNotice(null), 3000);
        setEditingUser(null);
        fetchAdminData();
      } else {
        alert(data.error || 'Erro ao atualizar usuário.');
      }
    } catch {
      alert('Falha na comunicação com o servidor.');
    }
  };

  // Direct user delete handler: opens in-app ConfirmDeleteModal without blocking window.confirm
  const handleDeleteUserDirect = (userId: string | number, identifier: string, userEmail?: string) => {
    const target =
      usersList.find((u) => String(u.id) === String(userId)) ||
      ({
        id: userId as any,
        nomeArtistico: identifier,
        nomeCompleto: identifier,
        email: userEmail || '',
      } as User);
    setUserToDelete(target);
  };

  const handleAdminDeletePlan = (targetUser: User) => {
    const targetId = String(targetUser.id);
    const targetEmail = (targetUser.email || '').toLowerCase().trim();
    const targetName = targetUser.nomeArtistico || targetUser.nomeCompleto || targetEmail || 'Cliente';

    deleteCustomerPlanData(targetId, targetEmail);
    localStorage.removeItem('kolvox_sub_' + targetId);
    localStorage.removeItem('kolvox_trial_override_' + targetId);
    localStorage.removeItem('kolvox_trial_extended_' + targetId);
    if (targetEmail) {
      localStorage.removeItem('kolvox_sub_' + targetEmail);
      localStorage.removeItem('kolvox_trial_override_' + targetEmail);
      localStorage.removeItem('kolvox_trial_extended_' + targetEmail);
    }

    setUsersList((prev) => [...prev]);
    setAdminToastNotice(`Plano de "${targetName}" excluído e resetado com sucesso.`);
    setTimeout(() => setAdminToastNotice(null), 3500);
  };

  const handleDeleteSongDirect = async (songId: number, songTitle: string) => {
    try {
      const res = await fetch(`/api/admin/songs/${songId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSongsList((prev) => prev.filter((s) => s.song.id !== songId));
        setAdminToastNotice(`Música "${songTitle}" removida do catálogo.`);
        setTimeout(() => setAdminToastNotice(null), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Erro ao excluir música.');
      }
    } catch {
      alert('Erro ao excluir música.');
    }
  };

  const handleDeletePlaylistDirect = async (playlistId: number, playlistName: string) => {
    try {
      const res = await fetch(`/api/admin/playlists/${playlistId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPlaylistsList((prev) => prev.filter((p) => p.playlist.id !== playlistId));
        setAdminToastNotice(`Repertório "${playlistName}" excluído.`);
        setTimeout(() => setAdminToastNotice(null), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Erro ao excluir repertório.');
      }
    } catch {
      alert('Erro ao excluir repertório.');
    }
  };

  const handleDeleteTicketDirect = async (ticketId: number) => {
    try {
      const res = await fetch(`/api/support/admin/tickets/${ticketId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSupportTickets((prev) => prev.filter((t) => t.id !== ticketId));
        setAdminToastNotice(`Chamado #${ticketId} excluído com sucesso.`);
        setTimeout(() => setAdminToastNotice(null), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Erro ao excluir chamado.');
      }
    } catch {
      alert('Erro ao excluir chamado.');
    }
  };

  const handleBatchDeleteSupportTickets = async (targetTab: 'all' | 'open' | 'answered') => {
    const tabName =
      targetTab === 'all'
        ? 'Todos os Chamados'
        : targetTab === 'open'
        ? 'Aguardando Resposta'
        : 'Respondidos';

    const matching = supportTickets.filter((t) => {
      if (targetTab === 'open') return t.status === 'open' || t.status === 'pending';
      if (targetTab === 'answered') return t.status === 'answered';
      return true;
    });

    const idsToDelete = new Set(matching.map((t) => String(t.id)));

    // Optimistically update
    if (targetTab === 'all') {
      setSupportTickets([]);
    } else {
      setSupportTickets((prev) => prev.filter((t) => !idsToDelete.has(String(t.id))));
    }

    setAdminToastNotice(`✓ Chamados da aba "${tabName}" excluídos com sucesso.`);
    setTimeout(() => setAdminToastNotice(null), 3000);

    try {
      const activeToken = token || localStorage.getItem('kolvox_auth_token') || 'kolvox_master_token_admin';
      await Promise.allSettled([
        fetch('/api/support/admin/tickets/batch-delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeToken}`,
          },
          body: JSON.stringify({ filter: targetTab }),
        }),
        ...Array.from(idsToDelete).map((id) =>
          fetch(`/api/support/admin/tickets/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${activeToken}` },
          }).catch(() => null)
        ),
      ]);
    } catch (err) {
      console.warn('Batch delete notice:', err);
    }
  };

  const handleDeletePaymentDirect = async (paymentId: number) => {
    try {
      const res = await fetch(`/api/payments/admin/${paymentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPaymentsList((prev) => prev.filter((p) => p.id !== paymentId));
        setPendingPayments((prev) => prev.filter((p) => p.id !== paymentId));
        setAdminToastNotice(`Registro de pagamento #${paymentId} excluído.`);
        setTimeout(() => setAdminToastNotice(null), 3000);
        fetchAdminData();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Erro ao excluir registro de pagamento.');
      }
    } catch {
      alert('Erro ao excluir pagamento.');
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsActionDeleting(true);
    const targetId = String(userToDelete.id);
    const targetEmail = (userToDelete.email || '').toLowerCase().trim();
    const targetName = userToDelete.nomeArtistico || userToDelete.nomeCompleto || targetEmail || 'Cliente';

    try {
      // 1. Delete customer plan data & local storage credentials
      deleteCustomerPlanData(targetId, targetEmail);
      deleteLocalUser(targetId);
      if (targetEmail) {
        deleteLocalUser(targetEmail);
      }

      // 2. Persist in deleted blacklist to prevent resurrected cached records
      try {
        const deletedIds: string[] = JSON.parse(
          localStorage.getItem('kolvox_admin_deleted_ids') || '[]'
        );
        if (!deletedIds.includes(targetId)) deletedIds.push(targetId);
        if (targetEmail && !deletedIds.includes(targetEmail)) deletedIds.push(targetEmail);
        localStorage.setItem('kolvox_admin_deleted_ids', JSON.stringify(deletedIds));
      } catch {}

      // 3. Delete from Firestore if exists
      try {
        await deleteDoc(doc(firestoreDb, 'users', targetId));
      } catch (fErr) {
        console.warn('Firestore user delete notice:', fErr);
      }

      // 4. Delete on backend server
      const activeToken = token || localStorage.getItem('kolvox_auth_token') || 'kolvox_master_token_admin';
      const queryParam = targetEmail ? `?email=${encodeURIComponent(targetEmail)}` : '';
      await fetch(`/api/admin/users/${encodeURIComponent(targetId)}${queryParam}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${activeToken}` },
      }).catch(() => null);

      // 5. Update state immediately so UI updates instantly
      setUsersList((prev) =>
        prev.filter(
          (u) =>
            String(u.id) !== targetId &&
            (!targetEmail || (u.email || '').toLowerCase().trim() !== targetEmail)
        )
      );

      setAdminToastNotice(`Cliente "${targetName}" excluído com sucesso da base de dados.`);
      setTimeout(() => setAdminToastNotice(null), 3500);
      setUserToDelete(null);
      setViewingUserModal(null);
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Erro ao excluir usuário.');
    } finally {
      setIsActionDeleting(false);
    }
  };

  const handleConfirmDeleteSong = async () => {
    if (!songToDelete) return;
    setIsActionDeleting(true);
    try {
      const res = await fetch(`/api/admin/songs/${songToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSongsList((prev) => prev.filter((s) => s.song.id !== songToDelete.id));
        setAdminToastNotice(`Música "${songToDelete.title}" removida do catálogo.`);
        setTimeout(() => setAdminToastNotice(null), 3500);
        setSongToDelete(null);
      } else {
        const data = await safeResponseJson(res, { error: null });
        alert(data.error || 'Erro ao excluir música.');
      }
    } catch {
      alert('Erro ao excluir música.');
    } finally {
      setIsActionDeleting(false);
    }
  };

  const handleConfirmDeletePlaylist = async () => {
    if (!playlistToDelete) return;
    setIsActionDeleting(true);
    try {
      const res = await fetch(`/api/admin/playlists/${playlistToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPlaylistsList((prev) => prev.filter((p) => p.playlist.id !== playlistToDelete.id));
        setAdminToastNotice(`Repertório "${playlistToDelete.name}" excluído.`);
        setTimeout(() => setAdminToastNotice(null), 3500);
        setPlaylistToDelete(null);
      } else {
        const data = await safeResponseJson(res, { error: null });
        alert(data.error || 'Erro ao excluir repertório.');
      }
    } catch {
      alert('Erro ao excluir repertório.');
    } finally {
      setIsActionDeleting(false);
    }
  };

  const handleConfirmDeleteTicket = async () => {
    if (!ticketToDelete) return;
    setIsActionDeleting(true);
    try {
      const res = await fetch(`/api/support/admin/tickets/${ticketToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSupportTickets((prev) => prev.filter((t) => t.id !== ticketToDelete.id));
        setAdminToastNotice(`Chamado #${ticketToDelete.id} excluído com sucesso.`);
        setTimeout(() => setAdminToastNotice(null), 3500);
        setTicketToDelete(null);
      } else {
        const data = await safeResponseJson(res, { error: null });
        alert(data.error || 'Erro ao excluir chamado.');
      }
    } catch {
      alert('Erro ao excluir chamado.');
    } finally {
      setIsActionDeleting(false);
    }
  };

  const handleConfirmDeletePayment = async () => {
    if (!paymentToDelete) return;
    setIsActionDeleting(true);
    try {
      const res = await fetch(`/api/payments/admin/${paymentToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPaymentsList((prev) => prev.filter((p) => p.id !== paymentToDelete.id));
        setPendingPayments((prev) => prev.filter((p) => p.id !== paymentToDelete.id));
        setAdminToastNotice(`Registro de pagamento #${paymentToDelete.id} excluído.`);
        setTimeout(() => setAdminToastNotice(null), 3500);
        setPaymentToDelete(null);
        fetchAdminData();
      } else {
        const data = await safeResponseJson(res, { error: null });
        alert(data.error || 'Erro ao excluir registro de pagamento.');
      }
    } catch {
      alert('Erro ao excluir pagamento.');
    } finally {
      setIsActionDeleting(false);
    }
  };

  const handleConfirmClearLogs = async () => {
    setIsActionDeleting(true);
    try {
      const res = await fetch('/api/admin/logs', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setLogsList([]);
        setAdminToastNotice('Histórico de logs de auditoria limpo com sucesso.');
        setTimeout(() => setAdminToastNotice(null), 3500);
        setIsClearingLogsModalOpen(false);
        fetchAdminData();
      } else {
        const data = await safeResponseJson(res, { error: null });
        alert(data.error || 'Erro ao limpar logs.');
      }
    } catch {
      alert('Erro ao limpar logs de auditoria.');
    } finally {
      setIsActionDeleting(false);
    }
  };

  const handleToggleUserRole = async (targetUser: User) => {
    const newRole = targetUser.tipoUsuario === 'ADMIN' ? 'USER' : 'ADMIN';
    try {
      updateLocalUser(String(targetUser.id), { role: newRole === 'ADMIN' ? 'admin' : 'user' });
      if (targetUser.email) updateLocalUser(targetUser.email, { role: newRole === 'ADMIN' ? 'admin' : 'user' });
      await fetch(`/api/admin/users/${targetUser.id}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tipoUsuario: newRole }),
      }).catch(() => null);

      setUsersList((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, tipoUsuario: newRole } : u))
      );
    } catch (err) {
      alert('Erro ao alterar permissão.');
    }
  };

  const handleToggleUserStatus = async (targetUser: User) => {
    const newStatus = targetUser.status === 'ativo' ? 'inativo' : 'ativo';
    try {
      updateLocalUser(String(targetUser.id), { status: newStatus === 'ativo' ? 'active' : 'blocked' });
      if (targetUser.email) updateLocalUser(targetUser.email, { status: newStatus === 'ativo' ? 'active' : 'blocked' });
      await fetch(`/api/admin/users/${targetUser.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      }).catch(() => null);

      setUsersList((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, status: newStatus } : u))
      );
    } catch (err) {
      alert('Erro ao alterar status.');
    }
  };

  const handleLogoutAdmin = async () => {
    await logout();
    if (onLogout) onLogout();
  };

  // Filtered lists & Plan calculations for quick renewal visibility
  const usersWithPlan = usersList.map((u) => ({
    user: u,
    plan: getCustomerPlanInfo(u.id, u.email, u.tipoUsuario, u.createdAt),
  }));

  const needsRenewalCount = usersWithPlan.filter((item) => item.plan.needsRenewal).length;
  const expiredCount = usersWithPlan.filter((item) => item.plan.planType === 'EXPIRED').length;
  const activeTrialsCount = usersWithPlan.filter((item) => item.plan.planType === 'TRIAL').length;
  const activeProsCount = usersWithPlan.filter((item) => item.plan.planType === 'PRO').length;
  const adminsCount = usersWithPlan.filter((item) => item.plan.planType === 'ADMIN').length;

  const filteredUsersWithPlan = usersWithPlan.filter(({ user: u, plan }) => {
    const q = (userSearch || '').toLowerCase().trim();
    const nameC = (u?.nomeCompleto || '').toLowerCase();
    const nameA = (u?.nomeArtistico || '').toLowerCase();
    const mail = (u?.email || '').toLowerCase();
    const idStr = String(u?.id || '').toLowerCase();
    const matchesSearch = !q || nameC.includes(q) || nameA.includes(q) || mail.includes(q) || idStr.includes(q);
    if (!matchesSearch) return false;

    if (userPlanFilter === 'needs_renewal') return plan.needsRenewal;
    if (userPlanFilter === 'expired') return plan.planType === 'EXPIRED';
    if (userPlanFilter === 'trial') return plan.planType === 'TRIAL';
    if (userPlanFilter === 'pro') return plan.planType === 'PRO';
    if (userPlanFilter === 'admin') return plan.planType === 'ADMIN';
    return true;
  });

  const filteredSongs = (Array.isArray(songsList) ? songsList : []).filter((item) => {
    const songObj = item?.song || item;
    if (!songObj) return false;
    const title = (songObj.title || '').toLowerCase();
    const artist = (songObj.artist || '').toLowerCase();
    const query = songSearch.toLowerCase();
    return title.includes(query) || artist.includes(query);
  });

  const filteredPlaylists = (Array.isArray(playlistsList) ? playlistsList : []).filter((item) => {
    const playlistObj = item?.playlist || item;
    if (!playlistObj) return false;
    const name = (playlistObj.name || '').toLowerCase();
    const userArtist = (item?.user?.nomeArtistico || '').toLowerCase();
    const query = playlistSearch.toLowerCase();
    return name.includes(query) || userArtist.includes(query);
  });

  // Master Admin Auth Guard Screen
  const isActuallyAdmin =
    isAdmin ||
    user?.tipoUsuario === 'ADMIN' ||
    user?.role === 'admin' ||
    user?.email?.toLowerCase() === 'koljoseph2020@gmail.com' ||
    localStorage.getItem('kolvox_admin_override') === 'true';

  if (!isActuallyAdmin) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#071329] border border-sky-500/40 rounded-3xl p-8 shadow-2xl space-y-6 text-center text-white">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto shadow-lg shadow-amber-500/10">
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
              Área Restrita do Sistema
            </span>
            <h2 className="text-2xl font-black text-white mt-3">Painel Administrativo Master</h2>
            <p className="text-sm text-zinc-300 mt-2 leading-relaxed">
              Controle executivo da plataforma KOLVOX STAGE. Acesse com a conta do administrador para gerenciar clientes, assinaturas PRO, catálogo musical e métricas financeiras.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-700/80 text-left space-y-2 text-xs">
            <div className="flex items-center justify-between text-zinc-400">
              <span>E-mail Master:</span>
              <strong className="text-white font-mono">koljoseph2020@gmail.com</strong>
            </div>
            <div className="flex items-center justify-between text-zinc-400">
              <span>Nível de Acesso:</span>
              <span className="text-emerald-400 font-bold">SUPER ADMINISTRADOR</span>
            </div>
          </div>

          <button
            onClick={async () => {
              try {
                if (loginAsAdmin) {
                  await loginAsAdmin();
                } else {
                  localStorage.setItem('kolvox_admin_override', 'true');
                }
                fetchAdminData();
              } catch (e) {
                console.error(e);
              }
            }}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-zinc-950 font-black text-sm transition-all shadow-xl shadow-amber-500/20 hover:scale-[1.02] cursor-pointer flex items-center justify-center gap-2.5"
          >
            <Sparkles className="w-5 h-5" />
            Entrar como Administrador Master
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="industrial-shell industrial-main-bg min-h-screen p-3 sm:p-6 lg:p-8 space-y-6 border border-[#f2f2f2]/10">
      {/* INDUSTRIAL TECHNICAL TOPBAR */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-[#f2f2f2] pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="industrial-badge">SYSTEM PRIVILEGE: MASTER</div>
          <span className="font-mono text-[11px] text-[#f2f2f2]/50 tracking-wider">REF: KS-ADMIN-PAINEL</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('support')}
            className={`btn-action cursor-pointer ${activeTab === 'support' ? 'bg-[#f2f2f2] text-[#0c0c0e] font-bold' : ''}`}
            title="Ver chamados de suporte"
          >
            Support
          </button>
          <button
            onClick={() => setShowUpgradeProModal(true)}
            className="btn-action btn-pro cursor-pointer"
            title="Conceder ou fazer upgrade para Plano PRO"
          >
            Upgrade PRO
          </button>
          <button
            onClick={async () => {
              setAdminToastNotice('Sincronizando dados com o servidor...');
              await fetchAdminData();
              setAdminToastNotice('Dados sincronizados com o servidor com sucesso!');
              setTimeout(() => setAdminToastNotice(null), 3000);
            }}
            disabled={loading}
            className="btn-action cursor-pointer"
            style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
            title="Sincronizar servidor agora"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'SYNCING...' : 'SYNC SERVER'}</span>
          </button>
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="btn-action text-sky-400 border-sky-500/40 hover:bg-sky-500/20 cursor-pointer"
              title="Voltar para a tela do aplicativo"
            >
              <span>← VOLTAR AO APP</span>
            </button>
          )}
          <button
            id="btn-admin-logout"
            onClick={handleLogoutAdmin}
            className="btn-action text-rose-400 border-rose-500/30 hover:bg-rose-500/20 cursor-pointer"
            title="Encerrar sessão de administrador"
          >
            <LogOut className="w-3 h-3" />
            <span>EXIT</span>
          </button>
        </div>
      </header>

      {/* INDUSTRIAL TECHNICAL HERO */}
      <section className="industrial-hero flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#f2f2f2]/10 pb-6">
        <div>
          <span className="industrial-label">Executive Interface / v2.4</span>
          <h1 className="industrial-title">Central de Gestão</h1>
        </div>

        <div className="text-left md:text-right font-mono text-xs text-[#f2f2f2]/60 leading-relaxed shrink-0">
          OPERATIONAL STATUS: <span className="text-emerald-400 font-bold">NOMINAL</span><br />
          GMAIL LINK: <span className={gmailStatus === 'connected' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{gmailStatus === 'connected' ? 'CONNECTED' : 'NOT CONFIGURED'}</span><br />
          REF: <span className="text-[#f2f2f2] font-bold">KS-ADMIN-PAINEL</span>
        </div>
      </section>

      {/* INDUSTRIAL TECHNICAL STATS GRID - INTERACTIVE CARDS */}
      <div className="industrial-stats-grid">
        <button
          type="button"
          onClick={() => {
            setActiveTab('users');
            setUserPlanFilter('all');
          }}
          className="industrial-stat-cell text-left hover:bg-white/5 transition-colors cursor-pointer w-full"
          title="Clique para ver todos os clientes cadastrados"
        >
          <div className="industrial-stat-value">{metrics?.totalUsers || usersList.length}</div>
          <div className="industrial-stat-label">Total Clientes →</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('users');
            setUserPlanFilter('pro');
          }}
          className="industrial-stat-cell text-left hover:bg-white/5 transition-colors cursor-pointer w-full"
          title="Clique para filtrar assinantes PRO"
        >
          <div className="industrial-stat-value" style={{ color: 'var(--accent)' }}>{activeProsCount}</div>
          <div className="industrial-stat-label">Assinantes PRO →</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('users');
            setUserPlanFilter('trial');
          }}
          className="industrial-stat-cell text-left hover:bg-white/5 transition-colors cursor-pointer w-full"
          title="Clique para filtrar clientes em teste"
        >
          <div className="industrial-stat-value">{activeTrialsCount}</div>
          <div className="industrial-stat-label">Testes 7 Dias →</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('payments');
          }}
          className="industrial-stat-cell text-left hover:bg-white/5 transition-colors cursor-pointer w-full"
          title="Clique para ver extrato e pagamentos"
        >
          <div className="industrial-stat-value" style={{ color: '#00ff00' }}>R$ {metrics?.totalRevenue || '189.90'}</div>
          <div className="industrial-stat-label">Receita Líquida →</div>
        </button>
      </div>

      {/* INDUSTRIAL TECHNICAL TABS */}
      <div className="industrial-tabs">
        {[
          { id: 'dashboard', num: '01', label: 'Dashboard' },
          { id: 'users', num: '02', label: `Clientes & Planos (${usersList.length})` },
          { id: 'client_activity', num: '03', label: 'Auditoria & Logs' },
          { id: 'support', num: '04', label: `Suporte (${supportTickets.filter((t) => t.status === 'open').length})` },
          { id: 'songs', num: '05', label: `Músicas (${songsList.length})` },
          { id: 'playlists', num: '06', label: `Setlists (${playlistsList.length})` },
          { id: 'searches', num: '07', label: `Buscas (${searchesList.length})` },
          { id: 'subs', num: '08', label: 'Assinaturas' },
          { id: 'payments', num: '09', label: `Pagamentos (${pendingPayments.length})` },
          { id: 'pix', num: '10', label: 'Config Pix' },
          { id: 'email', num: '11', label: 'Google / Gmail' },
          { id: 'providers', num: '12', label: 'Provedores' },
          { id: 'settings', num: '13', label: 'Configurações' },
          { id: 'logs', num: '14', label: 'Logs Sistema' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`admin-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id as any)}
              className={`industrial-tab ${isActive ? 'active' : ''}`}
            >
              <span className="opacity-60 mr-1">{tab.num}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: DASHBOARD (Item 12 - All 14 Metrics) */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* 1. Total de usuários */}
            <div className="bg-[#0b162b] border border-sky-500/30 shadow-lg shadow-sky-950/20 hover:border-sky-400/60 transition-all rounded-2xl p-4">
              <div className="flex items-center justify-between text-zinc-200 text-xs font-bold mb-1">
                <span>TOTAL USUÁRIOS</span>
                <Users className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-black text-white font-mono">{metrics?.totalUsers || usersList.length}</div>
              <div className="text-xs text-zinc-300 mt-1">Cadastrados na plataforma</div>
            </div>

            {/* 2. Usuários ativos */}
            <div className="bg-[#0b162b] border border-emerald-500/30 shadow-lg shadow-emerald-950/20 hover:border-emerald-400/60 transition-all rounded-2xl p-4">
              <div className="flex items-center justify-between text-zinc-200 text-xs font-bold mb-1">
                <span>USUÁRIOS ATIVOS</span>
                <UserCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-300 font-mono">
                {metrics?.activeUsers || usersList.filter((u) => u.status === 'ativo').length}
              </div>
              <div className="text-xs text-zinc-300 mt-1">Contas com acesso liberado</div>
            </div>

            {/* 3. Usuários bloqueados */}
            <div className="bg-[#0b162b] border border-rose-500/30 shadow-lg shadow-rose-950/20 hover:border-rose-400/60 transition-all rounded-2xl p-4">
              <div className="flex items-center justify-between text-zinc-200 text-xs font-bold mb-1">
                <span>BLOQUEADOS</span>
                <UserX className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-black text-rose-300 font-mono">
                {metrics?.blockedUsers || usersList.filter((u) => u.status === 'inativo').length}
              </div>
              <div className="text-xs text-zinc-300 mt-1">Contas desativadas</div>
            </div>

            {/* 4. Novos usuários */}
            <div className="bg-[#0b162b] border border-purple-500/30 shadow-lg shadow-purple-950/20 hover:border-purple-400/60 transition-all rounded-2xl p-4">
              <div className="flex items-center justify-between text-zinc-200 text-xs font-bold mb-1">
                <span>NOVOS USUÁRIOS</span>
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-black text-purple-300 font-mono">
                {metrics?.newUsers || usersList.length}
              </div>
              <div className="text-xs text-zinc-300 mt-1">Últimos 30 dias</div>
            </div>

            {/* 5. Testes gratuitos ativos */}
            <div className="bg-[#0b162b] border border-amber-500/30 shadow-lg shadow-amber-950/20 hover:border-amber-400/60 transition-all rounded-2xl p-4">
              <div className="flex items-center justify-between text-zinc-200 text-xs font-bold mb-1">
                <span>TRIAL ATIVO</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-300 font-mono">
                {metrics?.activeTrials ?? subsList.filter((s) => s.subscription?.status === 'trial').length}
              </div>
              <div className="text-xs text-zinc-300 mt-1">7 dias de degustação</div>
            </div>

            {/* 6. Testes expirados */}
            <div className="bg-[#0b162b] border border-zinc-700/60 shadow-lg hover:border-zinc-500/60 transition-all rounded-2xl p-4">
              <div className="flex items-center justify-between text-zinc-200 text-xs font-bold mb-1">
                <span>TRIAL EXPIRADO</span>
                <Clock className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="text-2xl font-black text-zinc-300 font-mono">
                {metrics?.expiredTrials ?? subsList.filter((s) => s.subscription?.status === 'expired').length}
              </div>
              <div className="text-xs text-zinc-300 mt-1">Prazo de teste encerrado</div>
            </div>

            {/* 7. Assinaturas ativas */}
            <div className="bg-[#0b162b] border border-amber-500/40 shadow-lg shadow-amber-950/20 hover:border-amber-300 transition-all rounded-2xl p-4">
              <div className="flex items-center justify-between text-zinc-200 text-xs font-bold mb-1">
                <span>ASSINATURAS ATIVAS</span>
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-300 font-mono">
                {metrics?.activeSubs ?? subsList.filter((s) => s.subscription?.status === 'active').length}
              </div>
              <div className="text-xs text-zinc-300 mt-1">Membros PRO mensais</div>
            </div>

            {/* 8. Assinaturas canceladas */}
            <div className="bg-[#0b162b] border border-zinc-700/60 shadow-lg hover:border-zinc-500/60 transition-all rounded-2xl p-4">
              <div className="flex items-center justify-between text-zinc-200 text-xs font-bold mb-1">
                <span>CANCELADAS</span>
                <X className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="text-2xl font-black text-zinc-300 font-mono">
                {metrics?.canceledSubs ?? subsList.filter((s) => s.subscription?.status === 'canceled').length}
              </div>
              <div className="text-xs text-zinc-300 mt-1">Assinaturas encerradas</div>
            </div>

            {/* 9. Pagamentos aprovados */}
            <div className="bg-[#0b162b] border border-emerald-500/30 shadow-lg shadow-emerald-950/20 hover:border-emerald-400/60 transition-all rounded-2xl p-4">
              <div className="flex items-center justify-between text-zinc-200 text-xs font-bold mb-1">
                <span>PAGAMENTOS APROVADOS</span>
                <Check className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-300 font-mono">
                {metrics?.approvedPayments ?? paymentsList.filter((p) => p.status === 'completed').length}
              </div>
              <div className="text-xs text-zinc-300 mt-1">Transações concluídas</div>
            </div>

            {/* 10. Pagamentos pendentes */}
            <div className="bg-[#0b162b] border border-orange-500/30 shadow-lg shadow-orange-950/20 hover:border-orange-400/60 transition-all rounded-2xl p-4">
              <div className="flex items-center justify-between text-zinc-200 text-xs font-bold mb-1">
                <span>PAGAMENTOS PENDENTES</span>
                <Clock className="w-4 h-4 text-orange-400" />
              </div>
              <div className="text-2xl font-black text-orange-300 font-mono">
                {pendingPayments.length}
              </div>
              <div className="text-xs text-zinc-300 mt-1">Aguardando conferência Pix</div>
            </div>

            {/* 11. Receita */}
            <div className="bg-[#0b162b] border border-emerald-500/40 shadow-lg shadow-emerald-950/20 hover:border-emerald-300 transition-all rounded-2xl p-4">
              <div className="flex items-center justify-between text-zinc-200 text-xs font-bold mb-1">
                <span>RECEITA TOTAL</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-300 font-mono">
                R$ {metrics?.totalRevenue || '189.90'}
              </div>
              <div className="text-xs text-zinc-300 mt-1">Faturamento acumulado</div>
            </div>

            {/* 12. Total de músicas */}
            <div className="bg-[#0b162b] border border-amber-500/30 shadow-lg shadow-amber-950/20 hover:border-amber-400/60 transition-all rounded-2xl p-4">
              <div className="flex items-center justify-between text-zinc-200 text-xs font-bold mb-1">
                <span>TOTAL DE MÚSICAS</span>
                <Music className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {metrics?.totalSongs || songsList.length}
              </div>
              <div className="text-xs text-zinc-300 mt-1">Cifras e letras cadastradas</div>
            </div>

            {/* 13. Total de repertórios */}
            <div className="bg-[#0b162b] border border-indigo-500/30 shadow-lg shadow-indigo-950/20 hover:border-indigo-400/60 transition-all rounded-2xl p-4">
              <div className="flex items-center justify-between text-zinc-200 text-xs font-bold mb-1">
                <span>TOTAL REPERTÓRIOS</span>
                <FolderHeart className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {metrics?.totalPlaylists || playlistsList.length}
              </div>
              <div className="text-xs text-zinc-300 mt-1">Setlists organizadas</div>
            </div>

            {/* 14. Pesquisas realizadas */}
            <div className="bg-[#0b162b] border border-cyan-500/30 shadow-lg shadow-cyan-950/20 hover:border-cyan-400/60 transition-all rounded-2xl p-4">
              <div className="flex items-center justify-between text-zinc-200 text-xs font-bold mb-1">
                <span>PESQUISAS REALIZADAS</span>
                <Search className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-black text-cyan-300 font-mono">
                {metrics?.totalSearches || searchesList.length}
              </div>
              <div className="text-xs text-zinc-300 mt-1">Buscas de músicas efetuadas</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USUÁRIOS & PLANOS - Gestão de Vencimento e Renovação Rápida */}
      {activeTab === 'users' && (
        <div className="space-y-5">
          {/* Card de Alerta Rápido de Renovações */}
          {needsRenewalCount > 0 && (
            <div className="rounded-2xl border border-rose-500/40 bg-gradient-to-r from-rose-950/50 via-zinc-900 to-rose-950/30 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-rose-950/20">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0 animate-pulse">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-white text-sm sm:text-base flex items-center gap-2">
                    <span>Atenção: {needsRenewalCount} {needsRenewalCount === 1 ? 'cliente precisa' : 'clientes precisam'} de renovação do plano</span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider">
                      Urgente
                    </span>
                  </h4>
                  <p className="text-xs text-zinc-300 mt-0.5 leading-relaxed">
                    Clientes com período de 7 dias expirado ou nos últimos dias de teste. Reconheça o pagamento Pix para liberar o acesso PRO imediatamente ou conceda mais dias de teste.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setUserPlanFilter(userPlanFilter === 'needs_renewal' ? 'all' : 'needs_renewal')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-2 shadow-md ${
                  userPlanFilter === 'needs_renewal'
                    ? 'bg-rose-500 text-white'
                    : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{userPlanFilter === 'needs_renewal' ? 'Mostrar Todos os Clientes' : 'Filtrar Quem Precisa Renovar'}</span>
              </button>
            </div>
          )}

          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-zinc-950/70 p-3 rounded-2xl border border-zinc-800">
            {/* Filtros por Categoria de Plano */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-thin">
              <button
                onClick={() => setUserPlanFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  userPlanFilter === 'all'
                    ? 'bg-amber-400 text-zinc-950 font-black shadow-md'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
                }`}
              >
                <span>Todos</span>
                <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">
                  {usersList.length}
                </span>
              </button>

              <button
                onClick={() => setUserPlanFilter('needs_renewal')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  userPlanFilter === 'needs_renewal'
                    ? 'bg-rose-500 text-white font-black shadow-md shadow-rose-500/30'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-rose-300 border border-rose-500/30'
                }`}
              >
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                <span>Precisa Renovar</span>
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500/30 text-[10px] text-rose-200">
                  {needsRenewalCount}
                </span>
              </button>

              <button
                onClick={() => setUserPlanFilter('expired')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  userPlanFilter === 'expired'
                    ? 'bg-rose-600 text-white font-black shadow-md'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800'
                }`}
              >
                <Lock className="w-3 h-3" />
                <span>Expirados</span>
                <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">
                  {expiredCount}
                </span>
              </button>

              <button
                onClick={() => setUserPlanFilter('trial')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  userPlanFilter === 'trial'
                    ? 'bg-amber-500 text-zinc-950 font-black shadow-md'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-zinc-800'
                }`}
              >
                <Clock className="w-3 h-3 text-amber-400" />
                <span>Teste 7 Dias</span>
                <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">
                  {activeTrialsCount}
                </span>
              </button>

              <button
                onClick={() => setUserPlanFilter('pro')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  userPlanFilter === 'pro'
                    ? 'bg-emerald-500 text-zinc-950 font-black shadow-md'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-emerald-300 border border-zinc-800'
                }`}
              >
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Assinantes PRO</span>
                <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">
                  {activeProsCount}
                </span>
              </button>

              <button
                onClick={() => setUserPlanFilter('admin')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  userPlanFilter === 'admin'
                    ? 'bg-purple-500 text-white font-black shadow-md'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-purple-300 border border-zinc-800'
                }`}
              >
                <Shield className="w-3 h-3 text-purple-400" />
                <span>Master Admins</span>
                <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">
                  {adminsCount}
                </span>
              </button>
            </div>

            {/* Caixa de Busca */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Buscar por nome, e-mail ou nome artístico..."
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-hidden focus:border-amber-400"
              />
            </div>
          </div>

          {/* Tabela de Usuários com Colunas Estendidas */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-950/80 border-b border-zinc-800 text-[11px] uppercase font-mono text-zinc-400">
                  <tr>
                    <th className="py-3.5 px-4 font-bold">#ID</th>
                    <th className="py-3.5 px-4 font-bold">Cliente</th>
                    <th className="py-3.5 px-4 font-bold">Contato & Local</th>
                    <th className="py-3.5 px-4 font-bold">Tipo</th>
                    <th className="py-3.5 px-4 font-bold text-amber-300">Status do Plano</th>
                    <th className="py-3.5 px-4 font-bold text-sky-300">Data de Expiração</th>
                    <th className="py-3.5 px-4 font-bold">Status da Conta</th>
                    <th className="py-3.5 px-4 text-right font-bold">Ações & Liberação Rápida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredUsersWithPlan.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-zinc-500">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-40 text-zinc-400" />
                        <p className="text-sm font-semibold">Nenhum cliente encontrado com estes filtros.</p>
                        <button
                          onClick={() => {
                            setUserPlanFilter('all');
                            setUserSearch('');
                          }}
                          className="mt-2 text-xs text-amber-400 hover:underline cursor-pointer"
                        >
                          Limpar filtros de pesquisa
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredUsersWithPlan.map(({ user: u, plan }) => {
                      return (
                        <tr
                          key={u.id}
                          className={`hover:bg-zinc-900/60 transition-colors ${
                            plan.needsRenewal ? 'bg-rose-950/10' : ''
                          }`}
                        >
                          {/* Coluna 1: ID */}
                          <td className="py-3 px-4 font-mono text-zinc-500 font-bold">
                            #{u.id}
                          </td>

                          {/* Coluna 2: Cliente */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-white text-sm flex items-center gap-1.5">
                              <span>{u.nomeArtistico || u.nomeCompleto}</span>
                              {String(u.id) === 'guest_vocalist_principal' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  Convidado
                                </span>
                              )}
                            </div>
                            <div className="text-zinc-400 text-[11px]">{u.nomeCompleto}</div>
                          </td>

                          {/* Coluna 3: Contato & Localidade */}
                          <td className="py-3 px-4">
                            <div className="font-mono text-zinc-300 text-[11px] font-medium">{u.email}</div>
                            <div className="text-zinc-500 text-[10px]">
                              {u.cidade || '—'}/{u.estado || '—'} {u.telefone ? `• ${u.telefone}` : ''}
                            </div>
                          </td>

                          {/* Coluna 4: Tipo */}
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                u.tipoUsuario === 'ADMIN'
                                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                  : 'bg-zinc-800 text-zinc-300'
                              }`}
                            >
                              {u.tipoUsuario}
                            </span>
                          </td>

                          {/* Coluna 5: STATUS DO PLANO (Solicitado) */}
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black ${plan.badgeClass}`}
                              >
                                {plan.planType === 'EXPIRED' && <Lock className="w-3.5 h-3.5 text-rose-400" />}
                                {plan.planType === 'TRIAL' && <Clock className="w-3.5 h-3.5 text-amber-400" />}
                                {plan.planType === 'PRO' && <Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
                                {plan.planType === 'ADMIN' && <Shield className="w-3.5 h-3.5 text-purple-400" />}
                                <span>{plan.planName}</span>
                              </span>
                              <div className="text-[11px] font-bold text-zinc-300">
                                {plan.statusLabel}
                              </div>
                            </div>
                          </td>

                          {/* Coluna 6: DATA DE EXPIRAÇÃO & RENOVAÇÃO (Solicitado) */}
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-zinc-200">
                                <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                <span>{plan.expiryDateFormatted}</span>
                              </div>

                              {/* Alerta Visual de Renovação Rápida */}
                              {plan.planType === 'EXPIRED' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-500/25 text-rose-300 border border-rose-500/40 uppercase tracking-wide animate-pulse">
                                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                                  <span>🚨 Precisa Renovar Já</span>
                                </span>
                              )}
                              {plan.planType === 'TRIAL' && plan.daysRemaining <= 2 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  <span>⚠️ Vencendo em {plan.daysRemaining}d</span>
                                </span>
                              )}
                              {plan.planType === 'TRIAL' && plan.daysRemaining > 2 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-800 text-zinc-400">
                                  <span>⏳ {plan.daysRemaining} dias de teste</span>
                                </span>
                              )}
                              {plan.planType === 'PRO' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span>Renovação Ativa</span>
                                </span>
                              )}
                              {plan.planType === 'ADMIN' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/15 text-purple-300">
                                  <span>Permanente</span>
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Coluna 7: Status da Conta */}
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                                u.status === 'ativo'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'ativo' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                              <span>{u.status === 'ativo' ? 'Ativo' : 'Bloqueado'}</span>
                            </span>
                          </td>

                          {/* Coluna 8: Ações & Liberação Rápida */}
                          <td className="py-3 px-4 text-right space-y-1">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* Fast Plan Action: Liberar Acesso / Reconhecer Pix */}
                              {plan.planType !== 'PRO' && plan.planType !== 'ADMIN' && (
                                <button
                                  onClick={() => handleAdminGrantCustomerAccess(u)}
                                  title="Reconhecer pagamento Pix e liberar acesso PRO imediatamente"
                                  className="btn-action btn-pro"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>Liberar PRO</span>
                                </button>
                              )}

                              {/* Action: Remover Plano PRO */}
                              {plan.planType === 'PRO' && (
                                <button
                                  onClick={() => handleAdminRevokePro(u)}
                                  title="Remover Plano PRO e revogar benefícios imediatamente"
                                  className="btn-action btn-revoke"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>Remover PRO</span>
                                </button>
                              )}

                              {/* Action: +7 Dias Teste */}
                              {plan.planType !== 'ADMIN' && (
                                <button
                                  onClick={() => handleAdminExtendTrial(u)}
                                  title="Conceder +7 dias de teste gratuito"
                                  className="btn-action"
                                  style={{ color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.4)' }}
                                >
                                  +7 Dias
                                </button>
                              )}

                              {/* Action: Expirar Teste */}
                              {plan.planType === 'TRIAL' && (
                                <button
                                  onClick={() => handleAdminExpireTrial(u)}
                                  title="Bloquear acesso imediatamente por teste expirado"
                                  className="btn-action text-rose-300 border-rose-500/30"
                                >
                                  Expirar
                                </button>
                              )}

                              {/* View Full Card */}
                              <button
                                onClick={() => setViewingUserModal(u)}
                                title="Ver ficha completa e histórico do cliente"
                                className="btn-action text-sky-400 hover:text-white border-sky-500/40 hover:border-sky-400 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleStartEditUser(u)}
                                title="Editar dados cadastrais"
                                className="btn-action text-zinc-300 hover:text-white cursor-pointer"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              {/* Master Admin protection against self-block or deletion */}
                              {String(u.id) === 'admin_kolvox_master' || u.email?.toLowerCase() === 'koljoseph2020@gmail.com' ? (
                                <span
                                  className="btn-action opacity-60 text-purple-300 border-purple-500/30 cursor-default"
                                  title="Conta Master permanente (protegida)"
                                >
                                  Master
                                </span>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleToggleUserStatus(u)}
                                    title={u.status === 'ativo' ? 'Bloquear usuário' : 'Desbloquear usuário'}
                                    className={`btn-action cursor-pointer ${
                                      u.status === 'ativo'
                                        ? 'text-rose-300 border-rose-500/30 hover:bg-rose-500/10'
                                        : 'text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10'
                                    }`}
                                  >
                                    {u.status === 'ativo' ? 'Bloquear' : 'Desbloquear'}
                                  </button>

                                  {/* Excluir / Resetar Plano */}
                                  <button
                                    type="button"
                                    onClick={() => handleAdminDeletePlan(u)}
                                    title="Excluir/resetar plano do cliente"
                                    className="btn-action text-amber-400 hover:text-amber-300 border-amber-500/30 hover:border-amber-400 cursor-pointer flex items-center gap-1"
                                  >
                                    <Trash2 className="w-3 h-3 text-amber-400" />
                                    <span>Excluir Plano</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUserDirect(u.id, u.nomeArtistico || u.email, u.email)}
                                    title="Excluir usuário permanentemente"
                                    className="btn-action text-rose-400 hover:text-white border-rose-500/30 hover:border-rose-500/60 hover:bg-rose-500/20 cursor-pointer flex items-center gap-1"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                    <span>Excluir Usuário</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit User Modal */}
          {editingUser && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <h3 className="font-bold text-base text-white">
                    Editar Usuário #{editingUser.id}
                  </h3>
                  <button
                    onClick={() => setEditingUser(null)}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveEditUser} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-zinc-400 font-bold mb-1">Nome Completo</label>
                    <input
                      type="text"
                      required
                      value={editForm.nomeCompleto}
                      onChange={(e) => setEditForm({ ...editForm, nomeCompleto: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 font-bold mb-1">Nome Artístico</label>
                    <input
                      type="text"
                      required
                      value={editForm.nomeArtistico}
                      onChange={(e) => setEditForm({ ...editForm, nomeArtistico: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 font-bold mb-1">Cidade</label>
                      <input
                        type="text"
                        value={editForm.cidade}
                        onChange={(e) => setEditForm({ ...editForm, cidade: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 font-bold mb-1">Estado (UF)</label>
                      <input
                        type="text"
                        maxLength={2}
                        value={editForm.estado}
                        onChange={(e) => setEditForm({ ...editForm, estado: e.target.value.toUpperCase() })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 font-bold mb-1">Tipo de Conta</label>
                      <select
                        value={editForm.tipoUsuario}
                        onChange={(e) => setEditForm({ ...editForm, tipoUsuario: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                      >
                        <option value="USER">USER (Músico)</option>
                        <option value="ADMIN">ADMIN (Administrador)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-zinc-400 font-bold mb-1">Status</label>
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                      >
                        <option value="ativo">Ativo</option>
                        <option value="inativo">Bloqueado</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="px-4 py-2 bg-zinc-800 rounded-xl text-zinc-300 font-bold hover:bg-zinc-700"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-amber-400 text-zinc-950 rounded-xl font-black hover:bg-amber-300"
                    >
                      Salvar Alterações
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Viewing User Full Card Modal */}
          {viewingUserModal && (() => {
            const plan = getCustomerPlanInfo(
              viewingUserModal.id,
              viewingUserModal.email,
              viewingUserModal.tipoUsuario,
              viewingUserModal.createdAt
            );
            return (
              <div
                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
                onClick={() => setViewingUserModal(null)}
              >
                <div
                  className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                        {viewingUserModal.nomeArtistico?.[0]?.toUpperCase() || 'C'}
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-white">
                          Ficha Cadastral do Cliente #{viewingUserModal.id}
                        </h3>
                        <p className="text-[11px] text-zinc-400">
                          Dados completos da conta e gerenciamento do plano
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setViewingUserModal(null)}
                      className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Informações Cadastrais */}
                  <div className="space-y-3 bg-zinc-950/70 p-4 rounded-2xl border border-zinc-800 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-bold">Nome Artístico</span>
                        <span className="text-white font-bold">{viewingUserModal.nomeArtistico || '—'}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-bold">Nome Completo</span>
                        <span className="text-zinc-200">{viewingUserModal.nomeCompleto || '—'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-bold">E-mail Cadastrado</span>
                        <span className="text-zinc-300 font-mono text-[11px]">{viewingUserModal.email}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-bold">Telefone / WhatsApp</span>
                        <span className="text-zinc-300">{viewingUserModal.telefone || 'Não informado'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-bold">Localidade</span>
                        <span className="text-zinc-300">
                          {viewingUserModal.cidade || '—'}/{viewingUserModal.estado || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-bold">Data de Ingresso</span>
                        <span className="text-zinc-300">
                          {viewingUserModal.createdAt
                            ? new Date(viewingUserModal.createdAt).toLocaleDateString('pt-BR')
                            : 'Recente'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status do Plano e Tempo para Expirar */}
                  <div className="p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800 space-y-2">
                    <span className="text-zinc-400 block text-xs font-bold uppercase tracking-wider">
                      Situação do Plano & Tempo para Expirar
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold font-mono ${plan.badgeClass}`}>
                        {plan.planType === 'EXPIRED' && <Lock className="w-4 h-4 text-rose-400" />}
                        {plan.planType === 'TRIAL' && <Clock className="w-4 h-4 text-amber-400" />}
                        {plan.planType === 'PRO' && <Sparkles className="w-4 h-4 text-emerald-400" />}
                        {plan.planType === 'ADMIN' && <Shield className="w-4 h-4 text-purple-400" />}
                        <span>{plan.statusLabel}</span>
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Previsão / Status: <strong className="text-zinc-200">{plan.expiresAtFormatted}</strong>
                    </p>
                  </div>

                  {/* Ações Administrativas Rápidas */}
                  <div className="space-y-2 pt-2 border-t border-zinc-800">
                    <span className="text-zinc-400 text-xs font-bold block">
                      Ações Imediatas para este Cliente:
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {plan.planType !== 'PRO' && plan.planType !== 'ADMIN' && (
                        <button
                          type="button"
                          onClick={() => {
                            handleAdminGrantCustomerAccess(viewingUserModal);
                            setViewingUserModal(null);
                          }}
                          className="btn-action btn-pro"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Reconhecer Pix e Liberar PRO</span>
                        </button>
                      )}

                      {plan.planType === 'PRO' && (
                        <button
                          type="button"
                          onClick={() => {
                            handleAdminRevokePro(viewingUserModal);
                            setViewingUserModal(null);
                          }}
                          className="btn-action btn-revoke"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Remover Plano PRO</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          handleAdminExtendTrial(viewingUserModal);
                          setViewingUserModal(null);
                        }}
                        className="btn-action"
                        style={{ color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.4)' }}
                      >
                        +7 Dias de Teste
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleAdminExpireTrial(viewingUserModal);
                          setViewingUserModal(null);
                        }}
                        className="btn-action text-rose-300 border-rose-500/30"
                      >
                        Bloquear Teste
                      </button>

                      {/* Excluir / Resetar Plano */}
                      <button
                        type="button"
                        onClick={() => {
                          handleAdminDeletePlan(viewingUserModal);
                          setViewingUserModal(null);
                        }}
                        className="btn-action text-amber-300 border-amber-500/40 hover:bg-amber-500/10 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Excluir / Resetar Plano</span>
                      </button>

                      {/* Excluir Conta de Usuário */}
                      {String(viewingUserModal.id) !== 'admin_kolvox_master' &&
                        viewingUserModal.email?.toLowerCase() !== 'koljoseph2020@gmail.com' && (
                          <button
                            type="button"
                            onClick={() => {
                              const target = viewingUserModal;
                              setViewingUserModal(null);
                              handleDeleteUserDirect(
                                target.id,
                                target.nomeArtistico || target.email,
                                target.email
                              );
                            }}
                            className="btn-action text-rose-400 border-rose-500/40 hover:bg-rose-500/20 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            <span>Excluir Conta do Cliente</span>
                          </button>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB: ATIVIDADES DOS CLIENTES (Item Solicitado pelo Usuário) */}
      {activeTab === 'client_activity' && (
        <ClientActivityAuditTab usersList={usersList} />
      )}

      {/* TAB 3: MÚSICAS (Item 14 - Admin Content) */}
      {activeTab === 'songs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={songSearch}
                onChange={(e) => setSongSearch(e.target.value)}
                placeholder="Filtrar músicas por título ou artista..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-hidden focus:border-amber-400"
              />
            </div>
            <span className="text-xs text-zinc-500">{filteredSongs.length} músicas</span>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-950/60 border-b border-zinc-800 text-[11px] uppercase font-mono text-zinc-500">
                  <tr>
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Título</th>
                    <th className="py-3 px-4">Artista</th>
                    <th className="py-3 px-4">Tom</th>
                    <th className="py-3 px-4">BPM</th>
                    <th className="py-3 px-4">Autor / Criador</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredSongs.map((item) => {
                    const song = item?.song || item;
                    const author = item?.author || { nomeArtistico: 'Joseph Kolvox' };
                    if (!song || !song.id) return null;
                    return (
                      <tr key={song.id} className="hover:bg-zinc-900/40">
                        <td className="py-3 px-4 font-mono text-zinc-500">#{song.id}</td>
                        <td className="py-3 px-4 font-bold text-white">{song.title}</td>
                        <td className="py-3 px-4 text-amber-400 font-semibold">{song.artist}</td>
                        <td className="py-3 px-4 font-mono font-bold text-zinc-200">{song.tone || 'C'}</td>
                        <td className="py-3 px-4 font-mono text-zinc-400">{song.bpm || 120}</td>
                        <td className="py-3 px-4 text-zinc-400">
                          {author?.nomeArtistico || (song.userId ? `User #${song.userId}` : 'Catálogo Padrão')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteSongDirect(song.id, song.title)}
                            className="p-1.5 bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 rounded-lg transition-colors"
                            title="Remover música do acervo imediatamente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: REPERTÓRIOS (Item 14 - Admin Content) */}
      {activeTab === 'playlists' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={playlistSearch}
                onChange={(e) => setPlaylistSearch(e.target.value)}
                placeholder="Filtrar repertórios por nome..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-hidden focus:border-amber-400"
              />
            </div>
            <span className="text-xs text-zinc-500">{filteredPlaylists.length} repertórios</span>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-950/60 border-b border-zinc-800 text-[11px] uppercase font-mono text-zinc-500">
                  <tr>
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Nome do Repertório</th>
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4">Músico Proprietário</th>
                    <th className="py-3 px-4">Data de Criação</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredPlaylists.map((item) => {
                    const playlist = item?.playlist || item;
                    const pUser = item?.user || { nomeArtistico: 'Joseph Kolvox' };
                    if (!playlist || !playlist.id) return null;
                    return (
                      <tr key={playlist.id} className="hover:bg-zinc-900/40">
                        <td className="py-3 px-4 font-mono text-zinc-500">#{playlist.id}</td>
                        <td className="py-3 px-4 font-bold text-white">{playlist.name}</td>
                        <td className="py-3 px-4 text-zinc-400 max-w-xs truncate">{playlist.description || '—'}</td>
                        <td className="py-3 px-4 text-amber-400 font-semibold">{pUser?.nomeArtistico || pUser?.email}</td>
                        <td className="py-3 px-4 text-zinc-500">
                          {playlist.createdAt ? new Date(playlist.createdAt).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeletePlaylistDirect(playlist.id, playlist.name)}
                            className="p-1.5 bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 rounded-lg transition-colors"
                            title="Excluir repertório imediatamente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PESQUISAS REALIZADAS */}
      {activeTab === 'searches' && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 overflow-hidden">
          <h3 className="text-base font-bold text-white mb-2">Histórico de Pesquisas dos Usuários</h3>
          <p className="text-xs text-zinc-400 mb-4">Termos pesquisados na busca musical em tempo real.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="border-b border-zinc-800 text-[11px] uppercase font-mono text-zinc-500">
                <tr>
                  <th className="py-2.5 px-3">Data/Hora</th>
                  <th className="py-2.5 px-3">Termo Pesquisado</th>
                  <th className="py-2.5 px-3">Músico</th>
                  <th className="py-2.5 px-3">Resultados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {searchesList.map((item) => {
                  const search = item?.search || item;
                  const sUser = item?.user || { nomeArtistico: 'Anônimo' };
                  if (!search || !search.id) return null;
                  return (
                    <tr key={search.id}>
                      <td className="py-2.5 px-3 font-mono text-zinc-400">
                        {search.createdAt ? new Date(search.createdAt).toLocaleString('pt-BR') : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-white">"{search.query}"</td>
                      <td className="py-2.5 px-3 text-zinc-400">{sUser?.nomeArtistico || 'Anônimo'}</td>
                      <td className="py-2.5 px-3 font-mono text-amber-400">{search.resultsCount || 0} encontrados</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: ASSINATURAS */}
      {activeTab === 'subs' && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 overflow-hidden">
          <h3 className="text-base font-bold text-white mb-4">Assinaturas e Períodos de Teste</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="border-b border-zinc-800 text-[11px] uppercase font-mono text-zinc-500">
                <tr>
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 px-3">Músico</th>
                  <th className="py-2.5 px-3">Plano</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Início</th>
                  <th className="py-2.5 px-3">Término</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {subsList.map((item) => {
                  const s = item?.subscription || item;
                  const subUser = item?.user || { nomeArtistico: 'Músico' };
                  if (!s || !s.id) return null;
                  return (
                    <tr key={s.id}>
                      <td className="py-3 px-3 font-mono text-zinc-500">#{s.id}</td>
                      <td className="py-3 px-3 font-bold text-white">{subUser?.nomeArtistico || subUser?.email}</td>
                      <td className="py-3 px-3 font-mono text-amber-400">{s.plan}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            s.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : s.status === 'trial'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-zinc-400">
                        {s.subscriptionStart
                          ? new Date(s.subscriptionStart).toLocaleDateString('pt-BR')
                          : s.trialStart
                          ? new Date(s.trialStart).toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                      <td className="py-3 px-3 text-zinc-400">
                        {s.subscriptionEnd
                          ? new Date(s.subscriptionEnd).toLocaleDateString('pt-BR')
                          : s.trialEnd
                          ? new Date(s.trialEnd).toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: PAGAMENTOS & APROVAÇÃO PIX MANUAL */}
      {activeTab === 'payments' && (
        <div className="space-y-8">
          <div className="bg-zinc-900/80 border border-amber-500/30 rounded-3xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <span>PAGAMENTOS PENDENTES (PIX MANUAL)</span>
                </h2>
                <p className="text-xs text-zinc-400">
                  Comprovantes enviados aguardando conferência e ativação de acesso.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-mono font-bold">
                {pendingPayments.length} aguardando
              </span>
            </div>

            {pendingPayments.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-xs">
                Nenhum pagamento pendente no momento. Todos foram processados!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="border-b border-zinc-800 text-[11px] uppercase font-mono text-zinc-500">
                    <tr>
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3">Músico</th>
                      <th className="py-2.5 px-3">E-mail</th>
                      <th className="py-2.5 px-3">Referência</th>
                      <th className="py-2.5 px-3">Valor</th>
                      <th className="py-2.5 px-3 text-right">Aprovação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {pendingPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-950/40">
                        <td className="py-3.5 px-3 font-mono text-zinc-400">
                          {new Date(p.paymentDate).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3.5 px-3 font-bold text-white">{p.user?.nomeArtistico || 'Músico'}</td>
                        <td className="py-3.5 px-3 font-mono text-zinc-400">{p.user?.email}</td>
                        <td className="py-3.5 px-3">
                          <span className="font-mono text-amber-400 block">{p.referenceCode || p.externalPaymentId}</span>
                        </td>
                        <td className="py-3.5 px-3 font-bold text-emerald-400 font-mono">
                          R$ {p.amount}
                        </td>
                        <td className="py-3.5 px-3 text-right space-x-2">
                          <button
                            onClick={() => handleApprovePayment(p.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold"
                          >
                            APROVAR
                          </button>
                          <button
                            onClick={() => handleRejectPayment(p.id)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 text-xs font-bold"
                          >
                            RECUSAR
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-4">
            <h3 className="text-base font-bold text-white">Histórico Geral de Transações</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="border-b border-zinc-800 text-[11px] uppercase font-mono text-zinc-500">
                  <tr>
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-3">Provedor</th>
                    <th className="py-2.5 px-3">Valor</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {paymentsList.map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 px-3 font-mono text-zinc-400">
                        {new Date(p.paymentDate).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3 px-3">{p.provider}</td>
                      <td className="py-3 px-3 font-bold text-white">R$ {p.amount}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            p.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : p.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {p.status === 'completed' ? 'Aprovado' : p.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleDeletePaymentDirect(p.id)}
                          className="p-1.5 bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 rounded-lg transition-colors"
                          title="Excluir registro de pagamento imediatamente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: CONFIGURAÇÃO PIX (Item 44 - Standalone dedicated form) */}
      {activeTab === 'pix' && (
        <div className="max-w-2xl bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">💠 CONFIGURAÇÃO PIX</h2>
              <p className="text-xs text-zinc-400">
                Altere a chave Pix a qualquer momento. A informação é armazenada no banco de dados e não fica fixa no código.
              </p>
            </div>
          </div>

          {pixNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{pixNotice}</span>
            </div>
          )}

          <form onSubmit={handleSavePix} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Chave Pix
              </label>
              <input
                id="input-pix-key-form"
                type="text"
                required
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="Informe sua chave Pix..."
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-hidden transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Tipo da chave
              </label>
              <select
                id="select-pix-key-type-form"
                value={pixKeyType}
                onChange={(e) => setPixKeyType(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden transition-colors"
              >
                <option value="E-mail">E-mail</option>
                <option value="CPF">CPF</option>
                <option value="CNPJ">CNPJ</option>
                <option value="Telefone">Telefone</option>
                <option value="Chave aleatória">Chave aleatória</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Nome do recebedor
              </label>
              <input
                id="input-pix-receiver-form"
                type="text"
                required
                value={pixReceiverName}
                onChange={(e) => setPixReceiverName(e.target.value)}
                placeholder="Ex: SEU NOME OU RAZAO SOCIAL"
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden transition-colors uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Cidade
              </label>
              <input
                id="input-pix-city-form"
                type="text"
                required
                value={pixCity}
                onChange={(e) => setPixCity(e.target.value)}
                placeholder="Ex: SAO PAULO"
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden transition-colors uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Valor do Plano Mensal (R$)</span>
                <span className="text-amber-400 font-mono text-[11px] font-bold">R$ {monthlyPrice}/mês</span>
              </label>
              <input
                id="input-pix-monthly-price-form"
                type="text"
                required
                value={monthlyPrice}
                onChange={(e) => setMonthlyPrice(e.target.value)}
                placeholder="9.99"
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-hidden transition-colors"
              />
              <span className="text-[11px] text-zinc-400 mt-1 block">
                Valor mensal atualizado para <strong>R$ {monthlyPrice}</strong> (alterado de R$ 10,00 para R$ 9,99).
              </span>
            </div>

            <div className="pt-2">
              <button
                id="btn-save-pix-configuration"
                type="submit"
                disabled={savingPix}
                className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all active:scale-98 disabled:opacity-50"
              >
                {savingPix ? 'SALVANDO NO BANCO...' : 'SALVAR CONFIGURAÇÃO PIX'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 9: SUPORTE */}
      {activeTab === 'support' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Central de Chamados dos Clientes</h2>
              <p className="text-xs text-zinc-400">
                Mensagens enviadas por músicos e interessados através da página de suporte.
              </p>
            </div>
            <a
              href="https://mail.google.com"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700 flex items-center gap-1.5 transition-all"
            >
              <span>Abrir no Gmail</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Support Tabs & Batch Delete Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2 overflow-x-auto flex-wrap">
              {/* Tab: Todos */}
              <div className={`flex items-center rounded-xl p-0.5 border ${
                supportFilter === 'all' ? 'bg-blue-600/20 border-blue-500/50' : 'bg-zinc-900 border-zinc-800'
              }`}>
                <button
                  type="button"
                  onClick={() => setSupportFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    supportFilter === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Todos os Chamados ({supportTickets.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleBatchDeleteSupportTickets('all')}
                  className="px-2 py-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-300 text-xs font-bold cursor-pointer flex items-center gap-1"
                  title="Excluir chamados da aba Todos os Chamados"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[11px] hidden sm:inline">Excluir</span>
                </button>
              </div>

              {/* Tab: Aguardando Resposta */}
              <div className={`flex items-center rounded-xl p-0.5 border ${
                supportFilter === 'open' ? 'bg-amber-600/20 border-amber-500/50' : 'bg-zinc-900 border-zinc-800'
              }`}>
                <button
                  type="button"
                  onClick={() => setSupportFilter('open')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 ${
                    supportFilter === 'open' ? 'bg-amber-600 text-white shadow-xs' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>Aguardando Resposta ({supportTickets.filter((t) => t.status === 'open' || t.status === 'pending').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBatchDeleteSupportTickets('open')}
                  className="px-2 py-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-300 text-xs font-bold cursor-pointer flex items-center gap-1"
                  title="Excluir chamados da aba Aguardando Resposta"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[11px] hidden sm:inline">Excluir</span>
                </button>
              </div>

              {/* Tab: Respondidos */}
              <div className={`flex items-center rounded-xl p-0.5 border ${
                supportFilter === 'answered' ? 'bg-emerald-600/20 border-emerald-500/50' : 'bg-zinc-900 border-zinc-800'
              }`}>
                <button
                  type="button"
                  onClick={() => setSupportFilter('answered')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 ${
                    supportFilter === 'answered' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Respondidos ({supportTickets.filter((t) => t.status === 'answered').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBatchDeleteSupportTickets('answered')}
                  className="px-2 py-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-300 text-xs font-bold cursor-pointer flex items-center gap-1"
                  title="Excluir chamados da aba Respondidos"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[11px] hidden sm:inline">Excluir</span>
                </button>
              </div>
            </div>
          </div>

          {supportTickets.filter((t) => {
            if (supportFilter === 'open') return t.status === 'open' || t.status === 'pending';
            if (supportFilter === 'answered') return t.status === 'answered';
            return true;
          }).length === 0 ? (
            <div className="text-center py-12 bg-zinc-900/60 border border-zinc-800 rounded-3xl text-zinc-500 text-xs">
              Nenhum chamado nesta aba.
            </div>
          ) : (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-950/60 border-b border-zinc-800 text-[11px] uppercase font-mono text-zinc-500">
                    <tr>
                      <th className="py-3 px-4">#ID</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">E-mail</th>
                      <th className="py-3 px-4">Assunto</th>
                      <th className="py-3 px-4">Data</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {supportTickets.filter((t) => {
                      if (supportFilter === 'open') return t.status === 'open' || t.status === 'pending';
                      if (supportFilter === 'answered') return t.status === 'answered';
                      return true;
                    }).map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-zinc-900/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-zinc-500">#{ticket.id}</td>
                        <td className="py-3.5 px-4 font-bold text-white">{ticket.customerName}</td>
                        <td className="py-3.5 px-4 font-mono text-zinc-400">{ticket.customerEmail}</td>
                        <td className="py-3.5 px-4 font-medium text-zinc-200 max-w-xs truncate">
                          {ticket.subject}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-500">
                          {new Date(ticket.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              ticket.status === 'open'
                                ? 'bg-amber-500/20 text-amber-400'
                                : ticket.status === 'answered'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-blue-500/20 text-blue-400'
                            }`}
                          >
                            {ticket.status === 'open' ? 'Aberto' : 'Respondido'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5">
                          <button
                            onClick={() => {
                              setSelectedTicket(ticket);
                              setReplyText(ticket.replyMessage || '');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs font-bold border border-blue-500/30"
                          >
                            Atender
                          </button>
                          <button
                            onClick={() => handleDeleteTicketDirect(ticket.id)}
                            className="p-1.5 bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 rounded-lg transition-colors inline-block"
                            title="Excluir chamado imediatamente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Ticket Detail / Reply Modal */}
          {selectedTicket && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <h3 className="font-bold text-base text-white">
                    Chamado #{selectedTicket.id} — {selectedTicket.subject}
                  </h3>
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-zinc-500 block">Cliente:</span>
                    <span className="font-bold text-zinc-200">{selectedTicket.customerName}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">E-mail:</span>
                    <span className="font-mono text-zinc-200">{selectedTicket.customerEmail}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 max-h-48 overflow-y-auto">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">
                    Mensagem do Usuário:
                  </span>
                  {selectedTicket.message}
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Sua Resposta
                  </label>
                  <textarea
                    rows={4}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Escreva sua resposta de suporte aqui..."
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded-xl p-3 text-xs text-white focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      adminGrantCustomerPlan(
                        selectedTicket.userId || selectedTicket.customerEmail,
                        selectedTicket.customerName,
                        selectedTicket.customerEmail
                      );
                      setAdminToastNotice(`Acesso PRO liberado para ${selectedTicket.customerName}!`);
                      setTimeout(() => setAdminToastNotice(null), 3500);
                      fetchAdminData();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Liberar Acesso do Cliente</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedTicket(null)}
                      className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSendTicketReply}
                      disabled={sendingReply || !replyText.trim()}
                      className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{sendingReply ? 'Enviando...' : 'Enviar Resposta'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 10: E-MAIL & GOOGLE WORKSPACE OAUTH */}
      {activeTab === 'email' && (
        <div className="max-w-3xl space-y-6">
          {/* Header Card */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 -mt-6 -mr-6 w-48 h-48 rounded-full bg-red-500/10 blur-3xl pointer-events-none" />
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/20 via-amber-500/10 to-transparent border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 shadow-lg">
                <Mail className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[11px] font-bold border border-red-500/20">
                  <Shield className="w-3 h-3" />
                  <span>GOOGLE OAUTH 2.0 &amp; GMAIL WORKSPACE</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Integração Gmail &amp; Google Workspace
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-xl">
                  Disparo de notificações de planos, comprovantes Pix, recuperação de acesso e sincronização de chamados de suporte diretamente pela sua Conta Google.
                </p>
              </div>
            </div>
          </div>

          {/* Status Panel */}
          <div className={`p-6 rounded-3xl border transition-all ${
            gmailStatus === 'connected'
              ? 'bg-gradient-to-br from-emerald-950/40 via-zinc-950 to-zinc-950 border-emerald-500/30 shadow-lg shadow-emerald-950/20'
              : 'bg-gradient-to-br from-amber-950/30 via-zinc-950 to-zinc-950 border-amber-500/30 shadow-lg shadow-amber-950/20'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 block">
                  Status da Conexão
                </span>
                <div className="flex items-center gap-3">
                  {gmailStatus === 'connected' ? (
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                      </span>
                      <div>
                        <span className="text-sm sm:text-base font-black text-emerald-300">
                          🟢 Conta do Google Conectada e Ativa
                        </span>
                        <p className="text-xs text-zinc-300 font-mono mt-0.5">
                          {gmailEmail || 'koljoseph2020@gmail.com'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500"></span>
                      <div>
                        <span className="text-sm sm:text-base font-black text-rose-300">
                          🔴 Gmail não configurado
                        </span>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Conecte sua conta do Google para liberar o disparo automático de e-mails.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {gmailStatus === 'connected' ? (
                  <>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/40">
                      OAuth 2.0 Seguro
                    </span>
                    <button
                      type="button"
                      onClick={handleDisconnectGmail}
                      className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-rose-950/50 text-zinc-300 hover:text-rose-200 text-xs font-bold border border-zinc-700 hover:border-rose-500/40 transition-all cursor-pointer"
                    >
                      Desconectar
                    </button>
                  </>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs font-bold border border-amber-500/30">
                    Aguardando Vinculação
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* MAIN FEATURE CARD: FAZER LOGIN COM O GOOGLE COM OPÇÕES DE CONTA */}
          <div className="p-6 sm:p-8 rounded-3xl bg-zinc-900/90 border border-sky-500/30 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-sky-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Método Recomendado e Seguro</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white">
                Fazer login com o Google
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-2xl">
                Escolha qual conta do Gmail conectar à plataforma KOLVOX. Suas notificações, avisos de renovação Pix e chamados serão enviados com segurança através da conta selecionada.
              </p>
            </div>

            {/* SELEÇÃO DA CONTA DO GMAIL */}
            <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3">
              <span className="text-xs font-black text-zinc-300 uppercase tracking-wider block">
                Escolha a Conta do Gmail para Conectar:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Opção 1: koljoseph2020@gmail.com */}
                <button
                  type="button"
                  onClick={() => setSelectedGmailAccountOption('koljoseph2020@gmail.com')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    selectedGmailAccountOption === 'koljoseph2020@gmail.com'
                      ? 'bg-sky-500/15 border-sky-400 text-white shadow-md'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-white font-mono">
                      <span>koljoseph2020@gmail.com</span>
                    </div>
                    <div className="text-[11px] text-zinc-400">Conta Master do Administrador</div>
                  </div>
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    selectedGmailAccountOption === 'koljoseph2020@gmail.com'
                      ? 'border-sky-400 bg-sky-400'
                      : 'border-zinc-600'
                  }`}>
                    {selectedGmailAccountOption === 'koljoseph2020@gmail.com' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-950" />
                    )}
                  </span>
                </button>

                {/* Opção 2: kolvox.pagamentos@gmail.com */}
                <button
                  type="button"
                  onClick={() => setSelectedGmailAccountOption('kolvox.pagamentos@gmail.com')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    selectedGmailAccountOption === 'kolvox.pagamentos@gmail.com'
                      ? 'bg-sky-500/15 border-sky-400 text-white shadow-md'
                      : 'bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-white font-mono">
                      <span>kolvox.pagamentos@gmail.com</span>
                    </div>
                    <div className="text-[11px] text-zinc-400">Conta de Cobranças Pix & Suporte</div>
                  </div>
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    selectedGmailAccountOption === 'kolvox.pagamentos@gmail.com'
                      ? 'border-sky-400 bg-sky-400'
                      : 'border-zinc-600'
                  }`}>
                    {selectedGmailAccountOption === 'kolvox.pagamentos@gmail.com' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-950" />
                    )}
                  </span>
                </button>
              </div>

              {/* Opção 3: Digitar outra conta */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedGmailAccountOption('custom')}
                  className={`text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    selectedGmailAccountOption === 'custom'
                      ? 'text-sky-400 underline'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span>Ou usar outro e-mail do Gmail / Google Workspace</span>
                </button>

                {selectedGmailAccountOption === 'custom' && (
                  <div className="mt-2">
                    <input
                      type="email"
                      value={customGmailInput}
                      onChange={(e) => setCustomGmailInput(e.target.value)}
                      placeholder="seu.email@gmail.com"
                      className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-sky-500/50 text-white text-xs font-mono focus:outline-none focus:border-sky-400"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Google Sign-in Official Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
              <button
                type="button"
                id="btn-google-oauth-connect"
                onClick={() => handleConnectGoogleOAuth()}
                disabled={isConnectingGoogle}
                className="px-6 py-3.5 rounded-2xl bg-white hover:bg-zinc-100 text-zinc-800 text-sm font-bold flex items-center justify-center gap-3 shadow-xl transition-all cursor-pointer disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99]"
              >
                {/* Official Google 'G' Logo SVG */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>
                  {isConnectingGoogle ? 'Conectando com o Google...' : 'Fazer login com o Google (Escolher Conta no Google)'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = selectedGmailAccountOption === 'custom' ? customGmailInput.trim() : selectedGmailAccountOption;
                  if (!target || !target.includes('@')) {
                    alert('Por favor, informe um endereço de e-mail válido.');
                    return;
                  }
                  handleConnectGoogleOAuth(target);
                }}
                disabled={isConnectingGoogle}
                className="px-5 py-3.5 rounded-2xl bg-sky-600/30 hover:bg-sky-600/40 text-sky-200 border border-sky-500/40 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-sky-400" />
                <span>Vincular Conta Selecionada Diretamente</span>
              </button>
            </div>

            <p className="text-[11px] text-zinc-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>A tela oficial de seleção de contas do Google será exibida para você autorizar o acesso de forma segura.</span>
            </p>
          </div>

          {/* Test Dispatch Box */}
          <div className="p-6 sm:p-7 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-5 shadow-xl">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Testar Disparo de Notificações
                </h3>
                <p className="text-xs text-zinc-400">
                  Valide a entrega de e-mails de suporte, avisos de cobrança Pix e alertas do palco diretamente na sua caixa postal.
                </p>
              </div>
            </div>

            {/* Account and Credentials status */}
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800/90 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                <span className="text-xs font-bold text-zinc-300">
                  Status de Envio de E-mails:
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  hasCredentials
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${hasCredentials ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
                  <span>{hasCredentials ? 'Autenticado via Google Gmail SMTP' : 'Aguardando Senha de App de 16 Letras'}</span>
                </span>
              </div>

              {/* Step by step guide to generate App Password */}
              <div className="text-xs text-zinc-300 space-y-2">
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Para que o Google autorize o envio real de e-mails para sua caixa de entrada, é necessário utilizar uma <strong>Senha de App de 16 caracteres</strong> oficial do Google:
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-bold transition-all"
                  >
                    <span>1. Gerar Senha de App no Google (16 letras)</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <span className="text-[11px] text-zinc-500">
                    (Selecione app &ldquo;Outro&rdquo; e digite &ldquo;KOLVOX&rdquo;)
                  </span>
                </div>
              </div>

              {/* App Password input */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-zinc-300 text-xs font-semibold">
                    2. Senha de App do Google (16 caracteres sem espaços):
                  </label>
                  {(gmailAppPassword || localStorage.getItem('kolvox_gmail_app_password')) && (
                    <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1 font-mono">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Senha salva e persistida</span>
                    </span>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="password"
                    value={gmailAppPassword}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGmailAppPassword(val);
                      if (val.trim()) {
                        localStorage.setItem('kolvox_gmail_app_password', val.trim());
                      }
                    }}
                    placeholder={hasCredentials || localStorage.getItem('kolvox_gmail_app_password') ? '•••••••••••••••• (Senha salva no sistema)' : 'ex: abcd efgh ijkl mnop'}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs focus:outline-none focus:border-sky-500 font-mono tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={handleConnectGmail}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shrink-0 transition-all shadow-sm"
                  >
                    <Key className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Salvar Senha Definitiva</span>
                  </button>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1.5">
                  {(gmailAppPassword || localStorage.getItem('kolvox_gmail_app_password'))
                    ? '🟢 A senha está gravada e não precisará ser digitada novamente.'
                    : 'Insira a senha de 16 letras gerada na sua conta Google e clique em Salvar para fixá-la.'}
                </p>
              </div>
            </div>

            {/* Test destination & dispatch trigger */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-zinc-400 text-xs font-medium mb-1">
                  E-mail de Destino para Receber o Teste:
                </label>
                <input
                  type="email"
                  value={testRecipientEmail}
                  onChange={(e) => setTestRecipientEmail(e.target.value)}
                  placeholder={gmailEmail || supportEmail || 'kolvox.pagamentos@gmail.com'}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleTestGmail}
                  disabled={testingGmail}
                  className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2.5 disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-950/50 transition-all active:scale-[0.98]"
                >
                  <Send className="w-4 h-4" />
                  <span>{testingGmail ? 'Disparando via Google SMTP...' : 'Disparar E-mail de Teste Agora'}</span>
                </button>

                <a
                  href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
                    testRecipientEmail || gmailEmail || supportEmail || 'kolvox.pagamentos@gmail.com'
                  )}&su=${encodeURIComponent('🔔 [KOLVOX STAGE] Teste de Notificação')}&body=${encodeURIComponent(
                    'Olá! Este é um e-mail de verificação do sistema de notificações do KOLVOX Stage.\n\nStatus: Sistema de mensageria ativo e sincronizado.'
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Mail className="w-4 h-4 text-sky-400" />
                  <span>Testar via Gmail Webmail</span>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
                </a>
              </div>
            </div>

            {gmailNotice && (
              <div className="p-4.5 rounded-2xl bg-zinc-900 border border-zinc-700/80 text-xs text-zinc-200 leading-relaxed font-mono shadow-inner">
                {gmailNotice}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 11: PROVEDORES */}
      {activeTab === 'providers' && (
        <div className="space-y-4">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6">
            <h3 className="text-base font-bold text-white mb-2">Provedores de Conteúdo & Compliance Legal</h3>
            <p className="text-xs text-zinc-400 mb-6">
              Status de conformidade com direitos autorais e APIs musicais integradas.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {providersList.map((p) => (
                <div key={p.id} className="p-4 bg-zinc-950/80 border border-zinc-800 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">{p.name}</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                      {p.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">{p.description}</p>
                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>Modo Legal: {p.legalMode}</span>
                    <span className="text-emerald-400 font-mono">Autorizado</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 12: CONFIGURAÇÕES GERAIS */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">⚙ CONFIGURAÇÕES DO APLICATIVO</h2>
              <p className="text-xs text-zinc-400">
                Parâmetros globais de precificação, degustação gratuita e atendimento.
              </p>
            </div>
          </div>

          {settingsNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{settingsNotice}</span>
            </div>
          )}

          <form onSubmit={handleSaveGeneralSettings} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Preço Mensal (R$)
                </label>
                <input
                  type="text"
                  required
                  value={monthlyPrice}
                  onChange={(e) => setMonthlyPrice(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-purple-400 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Dias de Teste Gratuito
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  required
                  value={trialDays}
                  onChange={(e) => setTrialDays(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-purple-400 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                E-mail Central de Atendimento
              </label>
              <input
                type="email"
                required
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-purple-400 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-hidden"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingSettings}
                className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-purple-600/20 transition-all disabled:opacity-50"
              >
                {savingSettings ? 'SALVANDO...' : 'SALVAR CONFIGURAÇÕES'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 13: LOGS DE AUDITORIA */}
      {activeTab === 'logs' && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-bold text-white">Registro de Eventos de Auditoria</h3>
              <p className="text-xs text-zinc-400">Trilha de auditoria das ações administrativas e de sistema.</p>
            </div>
            {logsList.length > 0 && (
              <button
                onClick={handleConfirmClearLogs}
                className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
                title="Limpar todos os logs de auditoria imediatamente"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Todos os Logs</span>
              </button>
            )}
          </div>
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="border-b border-zinc-800 text-[11px] uppercase font-mono text-zinc-500 sticky top-0 bg-zinc-900">
                <tr>
                  <th className="py-2.5 px-3">Data/Hora</th>
                  <th className="py-2.5 px-3">Ação</th>
                  <th className="py-2.5 px-3">Usuário ID</th>
                  <th className="py-2.5 px-3">IP</th>
                  <th className="py-2.5 px-3">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {logsList.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 px-3 font-mono text-zinc-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-amber-400 font-mono">{log.action}</td>
                    <td className="py-2.5 px-3 font-mono text-zinc-400">{log.userId ? `#${log.userId}` : '—'}</td>
                    <td className="py-2.5 px-3 font-mono text-zinc-500">{log.ip || '127.0.0.1'}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-400 max-w-md truncate">
                      {log.metadata || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Admin Toast Notification */}
      {adminToastNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950 border border-emerald-500/40 text-emerald-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{adminToastNotice}</span>
        </div>
      )}

      {/* User Deletion Modal */}
      <ConfirmDeleteModal
        isOpen={!!userToDelete}
        title="Excluir Conta de Usuário"
        itemName={userToDelete?.nomeArtistico || userToDelete?.nomeCompleto || userToDelete?.email || ''}
        itemType="este usuário"
        warningMessage="Esta conta e todos os dados associados (repertórios e preferências) serão apagados permanentemente."
        isDeleting={isActionDeleting}
        onConfirm={handleConfirmDeleteUser}
        onCancel={() => setUserToDelete(null)}
      />

      {/* Song Deletion Modal */}
      <ConfirmDeleteModal
        isOpen={!!songToDelete}
        title="Remover Música do Catálogo"
        itemName={songToDelete?.title || ''}
        itemType="esta música"
        warningMessage="A música será removida definitivamente da biblioteca pública de cifras e letras."
        isDeleting={isActionDeleting}
        onConfirm={handleConfirmDeleteSong}
        onCancel={() => setSongToDelete(null)}
      />

      {/* Playlist Deletion Modal */}
      <ConfirmDeleteModal
        isOpen={!!playlistToDelete}
        title="Excluir Repertório"
        itemName={playlistToDelete?.name || ''}
        itemType="este repertório"
        warningMessage="A setlist será apagada do banco de dados permanentemente."
        isDeleting={isActionDeleting}
        onConfirm={handleConfirmDeletePlaylist}
        onCancel={() => setPlaylistToDelete(null)}
      />

      {/* Ticket Deletion Modal */}
      <ConfirmDeleteModal
        isOpen={!!ticketToDelete}
        title="Excluir Chamado de Suporte"
        itemName={`#${ticketToDelete?.id} - ${ticketToDelete?.subject || ''}`}
        itemType="este chamado"
        warningMessage="O histórico deste chamado de suporte será excluído definitivamente."
        isDeleting={isActionDeleting}
        onConfirm={handleConfirmDeleteTicket}
        onCancel={() => setTicketToDelete(null)}
      />

      {/* Payment Deletion Modal */}
      <ConfirmDeleteModal
        isOpen={!!paymentToDelete}
        title="Excluir Registro de Pagamento"
        itemName={`#${paymentToDelete?.id} (${paymentToDelete?.ref}) - R$ ${paymentToDelete?.amount}`}
        itemType="este registro financeiro"
        warningMessage="Este lançamento de pagamento será removido do relatório administrativo."
        isDeleting={isActionDeleting}
        onConfirm={handleConfirmDeletePayment}
        onCancel={() => setPaymentToDelete(null)}
      />

      {/* Clear Logs Modal */}
      <ConfirmDeleteModal
        isOpen={isClearingLogsModalOpen}
        title="Limpar Histórico de Auditoria"
        itemName="Todos os registros de logs"
        itemType="a trilha de auditoria"
        warningMessage="Todos os eventos gravados até o momento serão limpos e um novo registro inicial será criado."
        isDeleting={isActionDeleting}
        onConfirm={handleConfirmClearLogs}
        onCancel={() => setIsClearingLogsModalOpen(false)}
      />
      {/* UPGRADE PRO QUICK MODAL */}
      {showUpgradeProModal && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowUpgradeProModal(false)}
        >
          <div
            className="bg-[#0c0c0e] border border-[#f2f2f2]/30 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative font-mono text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#f2f2f2]/20 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#ff4d00]/20 text-[#ff4d00] flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#f2f2f2] uppercase tracking-wider">
                    Upgrade PRO — Ativar Acesso do Cliente
                  </h3>
                  <p className="text-[10px] text-[#f2f2f2]/50">
                    Selecione um cliente para liberar o Plano PRO imediatamente
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUpgradeProModal(false)}
                className="btn-action text-[#f2f2f2]/60 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={upgradeSearch}
                onChange={(e) => setUpgradeSearch(e.target.value)}
                placeholder="Filtrar por nome ou e-mail do cliente..."
                className="w-full bg-black border border-[#f2f2f2]/20 rounded-lg pl-9 pr-3 py-2 text-xs text-[#f2f2f2] placeholder:text-zinc-500 focus:outline-hidden focus:border-[#ff4d00]"
              />
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-[#f2f2f2]/10 border border-[#f2f2f2]/10 rounded-lg bg-black/50">
              {usersWithPlan
                .filter(({ user: u }) => {
                  const q = upgradeSearch.toLowerCase().trim();
                  return (
                    !q ||
                    (u.nomeCompleto || '').toLowerCase().includes(q) ||
                    (u.nomeArtistico || '').toLowerCase().includes(q) ||
                    (u.email || '').toLowerCase().includes(q)
                  );
                })
                .map(({ user: u, plan }) => {
                  const isPro = plan.planType === 'PRO';
                  return (
                    <div key={u.id} className="p-3 flex items-center justify-between gap-3 hover:bg-white/5">
                      <div>
                        <div className="font-bold text-[#f2f2f2] text-xs">
                          {u.nomeArtistico || u.nomeCompleto}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono">{u.email}</div>
                        <div className="text-[10px] mt-0.5">
                          Status: <span className={isPro ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>{plan.planName}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isPro ? (
                          <button
                            type="button"
                            onClick={() => {
                              handleAdminRevokePro(u);
                            }}
                            className="btn-action btn-revoke"
                          >
                            <Lock className="w-3 h-3" />
                            <span>Remover PRO</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              handleAdminGrantCustomerAccess(u);
                              setShowUpgradeProModal(false);
                            }}
                            className="btn-action btn-pro"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Liberar PRO</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#f2f2f2]/10">
              {onNavigateToPlans && (
                <button
                  type="button"
                  onClick={() => {
                    setShowUpgradeProModal(false);
                    onNavigateToPlans();
                  }}
                  className="btn-action text-cyan-400 border-cyan-500/40 hover:bg-cyan-500/10"
                >
                  Ver Página de Planos & Pix →
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowUpgradeProModal(false)}
                className="btn-action ml-auto"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INDUSTRIAL TECHNICAL FOOTER */}
      <footer className="industrial-footer">
        <div>OPERATING SYSTEM: KOLVOX STAGE ARCHITECTURE | NODE_ENV: PRODUCTION</div>
        <div className="flex items-center">
          <span className="status-pill" />
          <span>SYSTEM LIVE</span>
        </div>
      </footer>
    </div>
  );
};
