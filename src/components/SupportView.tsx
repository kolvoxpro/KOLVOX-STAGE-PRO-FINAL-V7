import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { ConfirmDeleteModal } from './ConfirmDeleteModal.tsx';
import { safeFetchJson, safeResponseJson } from '../utils/safeFetch.ts';
import { adminGrantCustomerPlan } from '../utils/customerPlanHelper.ts';
import confetti from 'canvas-confetti';
import {
  Mail,
  Send,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Trash2,
  Search,
  RefreshCw,
  UserCheck,
  ShieldCheck,
  MessageCircle,
  Reply,
  Check,
  User,
  X,
  Filter,
  Calendar,
} from 'lucide-react';

export const SupportView: React.FC = () => {
  const { user, token, isAdmin: authIsAdmin } = useAuth();
  const isAdmin = Boolean(authIsAdmin || user?.role === 'admin' || user?.tipoUsuario === 'ADMIN');

  // Dynamic settings from server
  const [supportEmail, setSupportEmail] = useState('kolvox.pagamentos@gmail.com');
  const [gmailOnline, setGmailOnline] = useState(false);

  // Admin view state
  const [adminViewMode, setAdminViewMode] = useState<'inbox' | 'client_form'>('inbox');
  const [adminTickets, setAdminTickets] = useState<any[]>([]);
  const [loadingAdminTickets, setLoadingAdminTickets] = useState(false);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminFilter, setAdminFilter] = useState<'all' | 'open' | 'answered'>('all');
  const [adminReplyText, setAdminReplyText] = useState<Record<number, string>>({});
  const [adminSendingReply, setAdminSendingReply] = useState<Record<number, boolean>>({});
  const [adminToast, setAdminToast] = useState<string | null>(null);

  // Client form states (for normal users or admin testing client form)
  const [activeClientTab, setActiveClientTab] = useState<'form' | 'tickets'>('form');
  const [name, setName] = useState(user?.nomeCompleto || '');
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Client tickets list (for normal user)
  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<{ id: number; subject: string } | null>(null);
  const [isDeletingTicket, setIsDeletingTicket] = useState(false);
  const [adminTicketToDelete, setAdminTicketToDelete] = useState<any | null>(null);
  const [isDeletingAdminTicket, setIsDeletingAdminTicket] = useState(false);
  const [clientReplyText, setClientReplyText] = useState<Record<number, string>>({});
  const [sendingReply, setSendingReply] = useState<Record<number, boolean>>({});

  const showToast = (msg: string) => {
    setAdminToast(msg);
    setTimeout(() => {
      setAdminToast((curr) => (curr === msg ? null : curr));
    }, 4000);
  };

  // Load public settings
  useEffect(() => {
    if (user) {
      setName(user.nomeCompleto || user.nomeArtistico || '');
      setEmail(user.email || '');
    }

    safeFetchJson('/api/settings/public', {}, {
      supportEmail: 'kolvox.pagamentos@gmail.com',
      gmailSupportOnline: true,
    }).then((data) => {
      if (data?.supportEmail) setSupportEmail(data.supportEmail);
      if (data?.gmailSupportOnline !== undefined) setGmailOnline(data.gmailSupportOnline);
    });
  }, [user]);

  const FAKE_TICKET_EMAILS = [
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

  // Persistent tracking of deleted tickets so they never reappear
  const getDeletedTicketIds = (): Set<string> => {
    try {
      const raw = localStorage.getItem('kolvox_deleted_ticket_ids');
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  };

  const markTicketAsDeleted = (id: string | number) => {
    try {
      const set = getDeletedTicketIds();
      set.add(String(id));
      localStorage.setItem('kolvox_deleted_ticket_ids', JSON.stringify(Array.from(set)));
    } catch {}
  };

  // Load Admin Tickets (only real customer accounts, ignoring fake or deleted ones)
  const loadAdminTickets = async () => {
    setLoadingAdminTickets(true);
    const deletedIds = getDeletedTicketIds();
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/support/admin/tickets', { headers });
      if (res.ok) {
        const data = await res.json().catch(() => []);
        if (Array.isArray(data)) {
          const realOnly = data.filter((t) => 
            !deletedIds.has(String(t.id)) &&
            !FAKE_TICKET_EMAILS.includes((t.customerEmail || '').toLowerCase())
          );
          setAdminTickets(realOnly);
          return;
        }
      }

      // Fallback to my-tickets if admin endpoint is empty
      const fallback = await safeFetchJson<any[]>('/api/support/my-tickets', { headers }, []);
      if (Array.isArray(fallback)) {
        const realOnly = fallback.filter((t) => 
          !deletedIds.has(String(t.id)) &&
          !FAKE_TICKET_EMAILS.includes((t.customerEmail || '').toLowerCase())
        );
        setAdminTickets(realOnly);
      }
    } catch (err) {
      console.warn('Error fetching admin tickets:', err);
    } finally {
      setLoadingAdminTickets(false);
    }
  };

  // Load Client's own tickets
  const loadMyTickets = async () => {
    if (!token) return;
    setLoadingTickets(true);
    const deletedIds = getDeletedTicketIds();
    try {
      const data = await safeFetchJson<any[]>('/api/support/my-tickets', {
        headers: { Authorization: `Bearer ${token}` },
      }, []);
      if (Array.isArray(data)) {
        const realOnly = data.filter((t) => 
          !deletedIds.has(String(t.id)) &&
          !FAKE_TICKET_EMAILS.includes((t.customerEmail || '').toLowerCase())
        );
        setMyTickets(realOnly);
      }
    } catch (err) {
      console.warn('Notice loading tickets:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadAdminTickets();
    } else if (token) {
      loadMyTickets();
    }
  }, [isAdmin, token]);

  // Admin: Reply to customer ticket
  const handleAdminReplyTicket = async (ticketId: number) => {
    const text = adminReplyText[ticketId]?.trim();
    if (!text) {
      alert('Por favor, escreva a resposta para o cliente antes de enviar.');
      return;
    }

    setAdminSendingReply((prev) => ({ ...prev, [ticketId]: true }));
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/support/admin/tickets/${ticketId}/reply`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ replyMessage: text, status: 'answered' }),
      });

      if (res.ok) {
        showToast(`✓ Resposta enviada com sucesso para o cliente!`);
        confetti({
          particleCount: 45,
          spread: 50,
          origin: { y: 0.7 },
        });

        // Update local state immediately
        setAdminTickets((prev) =>
          prev.map((t) =>
            t.id === ticketId
              ? {
                  ...t,
                  replyMessage: text,
                  replySentAt: new Date().toISOString(),
                  status: 'answered',
                }
              : t
          )
        );
        // Clear reply draft for this ticket
        setAdminReplyText((prev) => ({ ...prev, [ticketId]: '' }));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Erro ao enviar resposta para o cliente.');
      }
    } catch (err) {
      alert('Erro de conexão ao enviar resposta ao chamado.');
    } finally {
      setAdminSendingReply((prev) => ({ ...prev, [ticketId]: false }));
    }
  };

  // Resilient single ticket deletion for admin & client
  const executeDeleteTicket = async (ticket: any) => {
    if (!ticket) return;
    const ticketId = ticket.id;

    // Permanently record deletion in localStorage
    markTicketAsDeleted(ticketId);

    // 1. Optimistic removal - remove instantly so UI updates without freeze
    setAdminTickets((prev) => prev.filter((t) => String(t.id) !== String(ticketId)));
    setMyTickets((prev) => prev.filter((t) => String(t.id) !== String(ticketId)));
    setAdminTicketToDelete(null);
    setTicketToDelete(null);
    showToast(`✓ Chamado #${ticketId} excluído com sucesso.`);

    // 2. Perform backend deletions in background across all endpoints
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await Promise.allSettled([
        fetch(`/api/support/admin/tickets/${ticketId}`, { method: 'DELETE', headers }),
        fetch(`/api/support/my-tickets/${ticketId}`, { method: 'DELETE', headers }),
        fetch(`/api/support/tickets/${ticketId}`, { method: 'DELETE', headers }),
      ]);
    } catch (err) {
      console.warn('Background ticket delete notice:', err);
    }
  };

  // Dedicated direct delete function called by buttons and modals
  const handleDeleteTicketDirect = async (ticketId: number | string) => {
    setIsDeletingTicket(true);
    try {
      const ticket =
        adminTickets.find((t) => String(t.id) === String(ticketId)) ||
        myTickets.find((t) => String(t.id) === String(ticketId)) || { id: ticketId };
      await executeDeleteTicket(ticket);
    } finally {
      setIsDeletingTicket(false);
    }
  };

  // Batch delete all tickets in a specific tab ('all' | 'open' | 'answered')
  const handleBatchDeleteTab = async (targetTab: 'all' | 'open' | 'answered') => {
    const tabName =
      targetTab === 'all'
        ? 'Todos os Chamados'
        : targetTab === 'open'
        ? 'Aguardando Resposta'
        : 'Respondidos';

    // Find all matching tickets
    const matchingTickets = adminTickets.filter((t) => {
      if (targetTab === 'open') return t.status === 'open' || t.status === 'pending';
      if (targetTab === 'answered') return t.status === 'answered';
      return true; // 'all'
    });

    const idsToDelete = new Set(matchingTickets.map((t) => String(t.id)));

    // Mark all deleted IDs persistently in localStorage
    matchingTickets.forEach((t) => markTicketAsDeleted(t.id));

    // Optimistically remove all from UI
    if (targetTab === 'all') {
      setAdminTickets([]);
      setMyTickets([]);
    } else {
      setAdminTickets((prev) => prev.filter((t) => !idsToDelete.has(String(t.id))));
      setMyTickets((prev) => prev.filter((t) => !idsToDelete.has(String(t.id))));
    }

    showToast(`✓ Chamados da aba "${tabName}" excluídos com sucesso.`);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await Promise.allSettled([
        fetch('/api/support/admin/tickets/batch-delete', {
          method: 'POST',
          headers,
          body: JSON.stringify({ filter: targetTab }),
        }),
        ...Array.from(idsToDelete).map((id) =>
          fetch(`/api/support/admin/tickets/${id}`, { method: 'DELETE', headers }).catch(() => null)
        ),
      ]);
    } catch (err) {
      console.warn('Batch delete background notice:', err);
    }
  };

  const handleBatchDeleteCurrentTab = async () => {
    await handleBatchDeleteTab(adminFilter);
  };

  // Admin: Delete a customer ticket
  const handleAdminDeleteTicket = (ticket: any) => {
    executeDeleteTicket(ticket);
  };

  const confirmAdminDeleteTicket = async () => {
    if (!adminTicketToDelete) return;
    await executeDeleteTicket(adminTicketToDelete);
  };

  // Admin: Quick action to grant PRO access to customer
  const handleAdminGrantCustomerPro = (ticket: any) => {
    const targetId = ticket.userId || ticket.customerEmail;
    adminGrantCustomerPlan(targetId, ticket.customerName, ticket.customerEmail);

    // Pre-populate friendly reply message
    setAdminReplyText((prev) => ({
      ...prev,
      [ticket.id]: `Olá ${ticket.customerName}! Seu pagamento via Pix foi identificado com sucesso e o seu Acesso PRO com teleprompter ilimitado no palco já está ativo na sua conta. Tenha ótimos shows! Qualquer dúvida conte conosco.`,
    }));

    showToast(`👑 Acesso PRO liberado com sucesso para ${ticket.customerName}!`);
    confetti({
      particleCount: 60,
      spread: 60,
      origin: { y: 0.6 },
    });
  };

  // Admin: Insert quick response templates
  const applyReplyTemplate = (ticketId: number, templateType: 'pix' | 'pedal' | 'pitch' | 'thanks') => {
    const ticket = adminTickets.find((t) => t.id === ticketId);
    const clientName = ticket?.customerName?.split(' ')[0] || 'Cliente';

    let template = '';
    if (templateType === 'pix') {
      template = `Olá ${clientName}! Seu comprovante Pix foi conferido e seu plano PRO já foi liberado no sistema. Basta atualizar o app para usufruir de todas as cifras e teleprompter ilimitado!`;
    } else if (templateType === 'pedal') {
      template = `Olá ${clientName}! Para utilizar pedal Bluetooth no Modo Show (AirTurn / PageTurner), basta configurar o pedal no modo de tecla 'Seta para Baixo' (Down Arrow) ou 'Page Down'. Assim que você pisar, o teleprompter rolará suavemente na velocidade desejada.`;
    } else if (templateType === 'pitch') {
      template = `Olá ${clientName}! A tonalidade agora fica salva de forma persistente: basta ajustar o tom desejado no repertório e clicar no botão de salvar. Na hora de tocar no Modo Show, as cifras carregarão automaticamente com a sua transposição.`;
    } else if (templateType === 'thanks') {
      template = `Olá ${clientName}! Agradecemos muito pelo contato e por usar o KOLVOX Stage. Sua sugestão foi anotada por nossa equipe. Estamos sempre à disposição!`;
    }

    setAdminReplyText((prev) => ({
      ...prev,
      [ticketId]: template,
    }));
  };

  // Client: Submit new message
  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessNotice(null);
    setErrorNotice(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customerName: name,
          customerEmail: email,
          subject,
          message,
        }),
      });

      let data: any = {};
      const responseText = await res.text();
      try {
        data = JSON.parse(responseText);
      } catch {
        if (!res.ok) {
          throw new Error('O servidor de suporte encontrou uma instabilidade temporária. Tente novamente em instantes.');
        }
      }

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao enviar mensagem para a equipe.');
      }

      setSuccessNotice('Mensagem enviada com sucesso! Nossa equipe responderá em breve no seu e-mail e aqui no painel.');
      setSubject('');
      setMessage('');

      if (isAdmin) {
        loadAdminTickets();
      } else if (token) {
        loadMyTickets();
      }
    } catch (err: any) {
      setErrorNotice(err.message || 'Falha ao conectar com a central de atendimento.');
    } finally {
      setSubmitting(false);
    }
  };

  // Client: Send follow-up reply
  const handleSendClientReply = async (ticketId: number) => {
    const text = clientReplyText[ticketId]?.trim();
    if (!text || !token) return;

    setSendingReply((prev) => ({ ...prev, [ticketId]: true }));
    try {
      const res = await fetch(`/api/support/my-tickets/${ticketId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text }),
      });

      if (res.ok) {
        setClientReplyText((prev) => ({ ...prev, [ticketId]: '' }));
        await loadMyTickets();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Erro ao enviar resposta ao suporte.');
      }
    } catch {
      alert('Erro de conexão ao enviar resposta.');
    } finally {
      setSendingReply((prev) => ({ ...prev, [ticketId]: false }));
    }
  };

  // Status badge helper

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span>Aberto • Aguarda Resposta</span>
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <span>Em Análise</span>
          </span>
        );
      case 'answered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>Respondido</span>
          </span>
        );
      case 'closed':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
            Encerrado
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-800 text-zinc-400">
            {status}
          </span>
        );
    }
  };

  // Filtered tickets for admin
  const filteredAdminTickets = adminTickets.filter((t) => {
    if (adminFilter === 'open' && t.status !== 'open' && t.status !== 'pending') return false;
    if (adminFilter === 'answered' && t.status !== 'answered') return false;

    if (adminSearch.trim()) {
      const q = adminSearch.toLowerCase();
      const matchName = t.customerName?.toLowerCase().includes(q);
      const matchEmail = t.customerEmail?.toLowerCase().includes(q);
      const matchSubject = t.subject?.toLowerCase().includes(q);
      const matchMsg = t.message?.toLowerCase().includes(q);
      return matchName || matchEmail || matchSubject || matchMsg;
    }
    return true;
  });

  const openTicketsCount = adminTickets.filter((t) => t.status === 'open' || t.status === 'pending').length;
  const answeredTicketsCount = adminTickets.filter((t) => t.status === 'answered').length;

  // =========================================================================
  // VIEW: ADMINISTRATOR VERSION (RECEIVE, VIEW & REPLY TO CLIENT MESSAGES)
  // =========================================================================
  if (isAdmin) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Admin Header Banner */}
        <div className="bg-gradient-to-r from-blue-950/40 via-zinc-900 to-zinc-950 border border-blue-500/30 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-black uppercase tracking-wider mb-3 border border-blue-500/40">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>CENTRAL DE ATENDIMENTO • MODO ADMINISTRADOR</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-white font-display flex items-center gap-2.5">
                <span>Mensagens Recebidas dos Clientes</span>
              </h1>

              <p className="text-xs sm:text-sm text-zinc-300 mt-2 max-w-2xl leading-relaxed">
                Caixa de entrada oficial para receber chamados enviados pelas contas dos clientes, visualizar dúvidas sobre Pix, repertórios e modo palco, e responder cada um diretamente.
              </p>
            </div>

            <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={loadAdminTickets}
                disabled={loadingAdminTickets}
                className="px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 hover:text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                title="Buscar mensagens recentes de clientes"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAdminTickets ? 'animate-spin' : ''}`} />
                <span>{loadingAdminTickets ? 'Atualizando...' : 'Atualizar Mensagens'}</span>
              </button>

              <a
                href="https://mail.google.com"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold transition-all flex items-center gap-2 shrink-0"
              >
                <span>Abrir Gmail Oficial</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Quick Info bar */}
          <div className="mt-6 p-4 rounded-2xl bg-black/40 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 block">
                  E-mail de Notificação de Suporte
                </span>
                <span className="text-xs sm:text-sm font-bold text-white font-mono">{supportEmail}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Central Ativa • Respostas Sincronizadas</span>
              </span>
            </div>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4.5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
                Total de Mensagens
              </span>
              <strong className="text-2xl font-black text-white">{adminTickets.length}</strong>
            </div>
          </div>

          <div className="bg-zinc-900/70 border border-amber-500/30 rounded-2xl p-4.5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 block">
                Aguardando Resposta
              </span>
              <strong className="text-2xl font-black text-amber-300">{openTicketsCount}</strong>
            </div>
          </div>

          <div className="bg-zinc-900/70 border border-emerald-500/30 rounded-2xl p-4.5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 block">
                Chamados Respondidos
              </span>
              <strong className="text-2xl font-black text-emerald-300">{answeredTicketsCount}</strong>
            </div>
          </div>
        </div>

        {/* NAVIGATION & ACTIONS BAR */}
        <div className="space-y-3 border-b border-zinc-800 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Tabs with Integrated Excluir Buttons */}
            <div className="flex items-center gap-2 overflow-x-auto flex-wrap sm:flex-nowrap">
              {/* ABA 1: TODOS OS CHAMADOS */}
              <div className={`flex items-center rounded-xl p-0.5 transition-all border ${
                adminViewMode === 'inbox' && adminFilter === 'all'
                  ? 'bg-blue-600/20 border-blue-500/50'
                  : 'bg-zinc-900 border-zinc-800'
              }`}>
                <button
                  type="button"
                  onClick={() => {
                    setAdminViewMode('inbox');
                    setAdminFilter('all');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    adminViewMode === 'inbox' && adminFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span>Todos os Chamados ({adminTickets.length})</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBatchDeleteTab('all');
                  }}
                  className="px-2 py-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                  title="Excluir chamados da aba Todos os Chamados"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[11px] hidden sm:inline">Excluir</span>
                </button>
              </div>

              {/* ABA 2: AGUARDANDO RESPOSTA */}
              <div className={`flex items-center rounded-xl p-0.5 transition-all border ${
                adminViewMode === 'inbox' && adminFilter === 'open'
                  ? 'bg-amber-600/20 border-amber-500/50'
                  : 'bg-zinc-900 border-zinc-800'
              }`}>
                <button
                  type="button"
                  onClick={() => {
                    setAdminViewMode('inbox');
                    setAdminFilter('open');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    adminViewMode === 'inbox' && adminFilter === 'open'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>Aguardando Resposta ({openTicketsCount})</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBatchDeleteTab('open');
                  }}
                  className="px-2 py-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                  title="Excluir chamados da aba Aguardando Resposta"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[11px] hidden sm:inline">Excluir</span>
                </button>
              </div>

              {/* ABA 3: RESPONDIDOS */}
              <div className={`flex items-center rounded-xl p-0.5 transition-all border ${
                adminViewMode === 'inbox' && adminFilter === 'answered'
                  ? 'bg-emerald-600/20 border-emerald-500/50'
                  : 'bg-zinc-900 border-zinc-800'
              }`}>
                <button
                  type="button"
                  onClick={() => {
                    setAdminViewMode('inbox');
                    setAdminFilter('answered');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    adminViewMode === 'inbox' && adminFilter === 'answered'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Respondidos ({answeredTicketsCount})</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBatchDeleteTab('answered');
                  }}
                  className="px-2 py-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                  title="Excluir chamados da aba Respondidos"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[11px] hidden sm:inline">Excluir</span>
                </button>
              </div>
            </div>

            {/* Toggle to client test form */}
            <button
              type="button"
              onClick={() => setAdminViewMode(adminViewMode === 'inbox' ? 'client_form' : 'inbox')}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 shrink-0 cursor-pointer self-start sm:self-auto"
            >
              {adminViewMode === 'inbox' ? (
                <>
                  <Send className="w-3.5 h-3.5 text-blue-400" />
                  <span>+ Enviar Mensagem Teste (Formulário)</span>
                </>
              ) : (
                <>
                  <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                  <span>← Voltar para Caixa de Entrada</span>
                </>
              )}
            </button>
          </div>

          {/* Dedicated Action Buttons for the 3 tabs */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mr-1 flex items-center gap-1">
              <Trash2 className="w-3 h-3" />
              <span>Ações de Excluir por Aba:</span>
            </span>

            <button
              type="button"
              onClick={() => handleBatchDeleteTab('all')}
              className="px-3 py-1.5 rounded-xl bg-red-600/15 hover:bg-red-600/30 border border-red-500/40 text-red-400 hover:text-red-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-xs"
              title="Excluir todos os chamados da aba Todos os Chamados"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir Todos os Chamados ({adminTickets.length})</span>
            </button>

            <button
              type="button"
              onClick={() => handleBatchDeleteTab('open')}
              className="px-3 py-1.5 rounded-xl bg-amber-600/15 hover:bg-amber-600/30 border border-amber-500/40 text-amber-400 hover:text-amber-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-xs"
              title="Excluir chamados da aba Aguardando Resposta"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir Aguardando Resposta ({openTicketsCount})</span>
            </button>

            <button
              type="button"
              onClick={() => handleBatchDeleteTab('answered')}
              className="px-3 py-1.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 hover:text-emerald-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-xs"
              title="Excluir chamados da aba Respondidos"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir Respondidos ({answeredTicketsCount})</span>
            </button>
          </div>
        </div>

        {/* INBOX VIEW */}
        {adminViewMode === 'inbox' && (
          <div className="space-y-6">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
                placeholder="Pesquisar por nome do cliente, e-mail, assunto ou conteúdo da mensagem..."
                className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-blue-500 rounded-2xl pl-10 pr-4 py-3 text-xs text-white focus:outline-none transition-colors"
              />
              {adminSearch && (
                <button
                  type="button"
                  onClick={() => setAdminSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-1 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {loadingAdminTickets ? (
              <div className="p-12 text-center text-zinc-400 text-xs flex flex-col items-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                <span>Carregando mensagens dos clientes...</span>
              </div>
            ) : filteredAdminTickets.length === 0 ? (
              <div className="p-12 text-center bg-zinc-900/50 border border-zinc-800 rounded-3xl text-zinc-400 text-xs flex flex-col items-center gap-2">
                <MessageSquare className="w-8 h-8 text-zinc-600" />
                <strong className="text-sm text-white">Nenhum chamado encontrado</strong>
                <p className="text-zinc-500 max-w-sm">
                  {adminSearch
                    ? 'Nenhum resultado corresponde à sua pesquisa.'
                    : 'Ainda não há mensagens nesta categoria.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAdminTickets.map((ticket) => {
                  const isAnswered = ticket.status === 'answered';
                  const replyDraft = adminReplyText[ticket.id] || '';
                  const isSending = adminSendingReply[ticket.id];

                  return (
                    <div
                      key={ticket.id}
                      id={`admin-ticket-card-${ticket.id}`}
                      className={`rounded-3xl p-5 sm:p-6 transition-all border ${
                        isAnswered
                          ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                          : 'bg-zinc-950/80 border-blue-500/30 hover:border-blue-500/50 shadow-lg shadow-blue-950/20'
                      }`}
                    >
                      {/* Ticket Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-xs font-black text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
                            #{ticket.id}
                          </span>
                          {getStatusBadge(ticket.status)}
                          <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-zinc-500" />
                            <span>{new Date(ticket.createdAt).toLocaleString('pt-BR')}</span>
                          </span>
                        </div>

                        {/* Direct Delete button */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              executeDeleteTicket(ticket);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-red-600/15 hover:bg-red-600/30 border border-red-500/40 text-red-400 hover:text-red-300 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-xs"
                            title="Excluir este chamado"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Excluir</span>
                          </button>
                        </div>
                      </div>

                      {/* Client Info Bar */}
                      <div className="py-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-300 font-bold text-xs uppercase">
                            {ticket.customerName ? ticket.customerName.slice(0, 2) : 'CL'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <strong className="text-white text-sm font-bold">{ticket.customerName}</strong>
                              <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">
                                Cliente
                              </span>
                            </div>
                            <span className="text-xs text-blue-300/80 font-mono block">
                              {ticket.customerEmail}
                            </span>
                          </div>
                        </div>

                        {/* Quick Grant PRO Button */}
                        <button
                          type="button"
                          onClick={() => handleAdminGrantCustomerPro(ticket)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                          title="Liberar assinatura PRO para este cliente"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Liberar Acesso PRO</span>
                        </button>
                      </div>

                      {/* Subject & Client Message */}
                      <div className="mt-2 space-y-2">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <span className="text-blue-400 font-normal text-xs uppercase tracking-wide">Assunto:</span>
                          <span>{ticket.subject}</span>
                        </h3>

                        <div className="p-4 rounded-2xl bg-black/50 border border-zinc-800/90 text-xs text-zinc-200 leading-relaxed">
                          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block mb-1.5 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 text-zinc-500" />
                            <span>Mensagem Enviada pelo Cliente:</span>
                          </span>
                          <p className="whitespace-pre-wrap">{ticket.message}</p>
                        </div>
                      </div>

                      {/* Client follow-up replies if any */}
                      {ticket.clientReplies && ticket.clientReplies.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block">
                            Réplica do Cliente:
                          </span>
                          {ticket.clientReplies.map((reply: any, idx: number) => (
                            <div
                              key={idx}
                              className="p-3 bg-blue-950/30 border border-blue-500/30 rounded-xl text-xs text-blue-200"
                            >
                              <div className="text-[10px] text-blue-400/80 font-mono mb-1">
                                {reply.sentAt ? new Date(reply.sentAt).toLocaleString('pt-BR') : 'Réplica recente'}
                              </div>
                              <p className="whitespace-pre-wrap">{reply.message}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Existing Admin Reply */}
                      {ticket.replyMessage && (
                        <div className="mt-4 p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              <span>Sua Resposta Enviada ao Cliente:</span>
                            </span>
                            {ticket.replySentAt && (
                              <span className="text-[10px] font-mono text-emerald-400/80">
                                {new Date(ticket.replySentAt).toLocaleString('pt-BR')}
                              </span>
                            )}
                          </div>
                          <p className="text-emerald-100 whitespace-pre-wrap bg-black/40 p-3 rounded-xl border border-emerald-500/20 font-medium">
                            {ticket.replyMessage}
                          </p>
                        </div>
                      )}

                      {/* REPLY COMPOSER SECTION */}
                      <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Reply className="w-3.5 h-3.5 text-blue-400" />
                            <span>{isAnswered ? 'Atualizar / Enviar Nova Resposta:' : 'Responder a Este Cliente:'}</span>
                          </label>

                          {/* Quick response templates chips */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase mr-1">Modelos:</span>
                            <button
                              type="button"
                              onClick={() => applyReplyTemplate(ticket.id, 'pix')}
                              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-semibold transition-colors cursor-pointer"
                            >
                              Pix Aprovado
                            </button>
                            <button
                              type="button"
                              onClick={() => applyReplyTemplate(ticket.id, 'pedal')}
                              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-semibold transition-colors cursor-pointer"
                            >
                              Pedal Bluetooth
                            </button>
                            <button
                              type="button"
                              onClick={() => applyReplyTemplate(ticket.id, 'pitch')}
                              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-semibold transition-colors cursor-pointer"
                            >
                              Tom Salvo
                            </button>
                            <button
                              type="button"
                              onClick={() => applyReplyTemplate(ticket.id, 'thanks')}
                              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-semibold transition-colors cursor-pointer"
                            >
                              Agradecimento
                            </button>
                          </div>
                        </div>

                        <textarea
                          rows={3}
                          value={replyDraft}
                          onChange={(e) =>
                            setAdminReplyText((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                          }
                          placeholder={`Escreva aqui a resposta direta que será enviada para ${ticket.customerName} (${ticket.customerEmail})...`}
                          className="w-full bg-[#030712] border border-zinc-700 focus:border-blue-500 rounded-2xl p-3 text-xs text-white focus:outline-none transition-colors"
                        />

                        <div className="flex items-center justify-between gap-3 pt-1">
                          <span className="text-[11px] text-zinc-500">
                            A resposta fica gravada no histórico do cliente e sincronizada com o suporte.
                          </span>

                          <button
                            type="button"
                            onClick={() => handleAdminReplyTicket(ticket.id)}
                            disabled={isSending || !replyDraft.trim()}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-500/20 active:scale-95"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{isSending ? 'Enviando...' : 'Enviar Resposta ao Cliente'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CLIENT FORM SIMULATION FOR ADMIN */}
        {adminViewMode === 'client_form' && (
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 animate-fade-in">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-white">Formulário de Contato do Cliente</h2>
                <p className="text-xs text-zinc-400">
                  Simule o envio de um chamado exatamente como o cliente faz.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdminViewMode('inbox')}
                className="text-xs text-blue-400 hover:underline font-bold"
              >
                ← Voltar para a Caixa de Entrada
              </button>
            </div>

            {successNotice && (
              <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                <span>{successNotice}</span>
              </div>
            )}

            {errorNotice && (
              <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                <span>{errorNotice}</span>
              </div>
            )}

            <form onSubmit={handleClientSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Nome do Cliente
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Rafael Vocalista"
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    E-mail do Cliente
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ex: rafael@email.com"
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Assunto
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ex: Dúvida sobre repertório ou pedal"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Mensagem Detalhada
                </label>
                <textarea
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Descreva a mensagem do cliente..."
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition-colors resize-y"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-lg shadow-blue-500/20"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? 'Enviando...' : 'Enviar Chamado Teste'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Admin Toast Feedback Floating */}
        {adminToast && (
          <div className="fixed bottom-6 right-6 z-50 bg-emerald-950 border border-emerald-500/50 text-emerald-200 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold animate-in fade-in slide-in-from-bottom-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{adminToast}</span>
          </div>
        )}

        {/* Admin Ticket Delete Modal */}
        <ConfirmDeleteModal
          isOpen={!!adminTicketToDelete}
          title="Excluir Chamado de Suporte"
          itemName={adminTicketToDelete ? `#${adminTicketToDelete.id} - ${adminTicketToDelete.customerName}: "${adminTicketToDelete.subject}"` : ''}
          itemType="este chamado da central"
          warningMessage="Esta ação removerá este chamado permanentemente da central de atendimento do administrador."
          isDeleting={isDeletingAdminTicket}
          onConfirm={confirmAdminDeleteTicket}
          onCancel={() => setAdminTicketToDelete(null)}
        />
      </div>
    );
  }

  // =========================================================================
  // VIEW: NORMAL CLIENT / VOCALIST VERSION (SUBMIT INQUIRY & TRACK MY TICKETS)
  // =========================================================================
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-zinc-900/95 via-zinc-900/80 to-zinc-950/95 border border-zinc-800/90 shadow-2xl rounded-3xl p-6 sm:p-8 relative overflow-hidden backdrop-blur-xl">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/15 text-sky-300 text-xs font-black tracking-wide mb-3 border border-sky-500/30 shadow-sm shadow-sky-500/10">
          <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
          <span>CENTRAL DE ATENDIMENTO & AJUDA</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white font-display tracking-tight">
          Precisa de Ajuda ou Suporte?
        </h1>

        <p className="text-sm sm:text-base text-zinc-300 mt-2 max-w-xl leading-relaxed">
          Nossa equipe técnica e artística está pronta para te atender. Dúvidas sobre repertórios, modo palco, cifras, pagamentos Pix ou sua assinatura PRO.
        </p>

        {/* Dynamic Direct Email Card */}
        <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-zinc-950/90 border border-sky-500/25 shadow-inner flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 shadow-sm">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                Canal Oficial de E-mail
              </span>
              <span className="text-sm sm:text-base font-bold text-sky-300 font-mono tracking-tight">{supportEmail}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {gmailOnline && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Atendimento Rápido</span>
              </span>
            )}

            <a
              href={`mailto:${supportEmail}?subject=Suporte%20KOLVOX%20STAGE`}
              className="px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-sky-900/30 flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <span>Abrir no E-mail</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Modern Segmented Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-zinc-950/80 border border-zinc-800/90 rounded-2xl w-fit">
        <button
          id="tab-support-form"
          type="button"
          onClick={() => setActiveClientTab('form')}
          className={`px-4.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeClientTab === 'form'
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25 font-black'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/70'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Enviar Nova Mensagem</span>
        </button>

        {token && (
          <button
            id="tab-support-tickets"
            type="button"
            onClick={() => {
              setActiveClientTab('tickets');
              loadMyTickets();
            }}
            className={`px-4.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeClientTab === 'tickets'
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25 font-black'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/70'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Meus Chamados</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
              activeClientTab === 'tickets'
                ? 'bg-white/20 text-white'
                : 'bg-zinc-800 text-zinc-300'
            }`}>
              {myTickets.length}
            </span>
          </button>
        )}
      </div>

      {/* Tab: Client Form */}
      {activeClientTab === 'form' && (
        <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <h2 className="text-xl font-bold text-white mb-1 tracking-tight">Formulário de Contato</h2>
          <p className="text-sm text-zinc-400 mb-6">
            Preencha os campos abaixo e entraremos em contato direto com você.
          </p>

          {successNotice && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-200 text-sm flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              <span>{successNotice}</span>
            </div>
          )}

          {errorNotice && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/35 text-rose-200 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{errorNotice}</span>
            </div>
          )}

          <form onSubmit={handleClientSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
                  Seu Nome Completo
                </label>
                <input
                  id="input-support-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="w-full bg-zinc-950/90 border border-zinc-700/80 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
                  Seu E-mail para Resposta
                </label>
                <input
                  id="input-support-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ex: joao@email.com"
                  className="w-full bg-zinc-950/90 border border-zinc-700/80 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
                Assunto da Mensagem
              </label>
              <input
                id="input-support-subject"
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex: Dúvida sobre pagamento Pix ou recurso do modo palco"
                className="w-full bg-zinc-950/90 border border-zinc-700/80 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
                Mensagem detalhada
              </label>
              <textarea
                id="input-support-message"
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Descreva o que aconteceu ou como podemos te ajudar..."
                className="w-full bg-zinc-950/90 border border-zinc-700/80 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-500 outline-none transition-all resize-y"
              />
            </div>

            <button
              id="btn-support-submit"
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Enviando Mensagem...' : 'Enviar Mensagem'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Tab: My Tickets (for client) */}
      {activeClientTab === 'tickets' && (
        <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Histórico de Atendimento</h2>
              <p className="text-sm text-zinc-400 mt-0.5">
                Acompanhe o status e as respostas enviadas pela nossa equipe técnica e artística.
              </p>
            </div>
            <button
              onClick={loadMyTickets}
              disabled={loadingTickets}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/70 hover:border-sky-500/40 text-xs font-bold text-sky-400 transition-all cursor-pointer shadow-sm disabled:opacity-50 self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTickets ? 'animate-spin text-sky-400' : ''}`} />
              <span>{loadingTickets ? 'Atualizando...' : 'Atualizar lista'}</span>
            </button>
          </div>

          {loadingTickets ? (
            <div className="text-center py-12 text-zinc-400 text-sm flex items-center justify-center gap-2.5">
              <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
              <span>Carregando seus chamados...</span>
            </div>
          ) : myTickets.length === 0 ? (
            <div className="text-center py-16 px-4 bg-zinc-950/50 rounded-2xl border border-zinc-800/60 space-y-3">
              <MessageSquare className="w-10 h-10 text-zinc-600 mx-auto" />
              <h3 className="text-base font-bold text-zinc-300">Você ainda não abriu nenhum chamado de suporte.</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Precisa de ajuda? Clique na aba "Enviar Nova Mensagem" acima para falar diretamente com nossa equipe.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {myTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  id={`ticket-card-${ticket.id}`}
                  className="bg-zinc-950/90 border border-zinc-800/90 hover:border-zinc-700/90 rounded-2xl p-5 sm:p-6 space-y-4.5 shadow-xl transition-all"
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/70">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0">
                        #{ticket.id}
                      </span>
                      <h3 className="font-bold text-base sm:text-lg text-white leading-snug tracking-tight">
                        {ticket.subject}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      {ticket.status === 'answered' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 shadow-sm shadow-emerald-500/10">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Respondido</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/15 text-amber-300 border border-amber-500/35 shadow-sm shadow-amber-500/10">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                          <span>Aberto • Aguarda Resposta</span>
                        </span>
                      )}
                      <div className="inline-flex items-center gap-1.5 text-xs text-zinc-400 font-medium px-2 py-1 bg-zinc-900 rounded-lg border border-zinc-800">
                        <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{new Date(ticket.createdAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <button
                        onClick={() => setTicketToDelete(ticket)}
                        className="p-1.5 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
                        title="Excluir chamado"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Customer's Initial Message */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-black text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                      <span>Sua Mensagem Inicial:</span>
                    </span>
                    <div className="p-4 bg-zinc-900/90 border border-zinc-800/90 rounded-xl text-sm sm:text-base text-zinc-100 whitespace-pre-wrap leading-relaxed font-normal">
                      {ticket.message}
                    </div>
                  </div>

                  {/* Support Reply Section (when answered) */}
                  {ticket.replyMessage ? (
                    <div className="p-4.5 sm:p-5 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-xs space-y-2.5 shadow-lg shadow-emerald-950/20">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <span className="text-xs sm:text-sm font-black text-emerald-300 uppercase tracking-wide flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Resposta do Suporte (Enviada ao seu E-mail e Aqui)</span>
                        </span>
                        {ticket.replySentAt && (
                          <span className="text-xs text-emerald-400/90 font-mono font-bold">
                            {new Date(ticket.replySentAt).toLocaleString('pt-BR')}
                          </span>
                        )}
                      </div>
                      <div className="whitespace-pre-wrap font-normal text-sm sm:text-base text-emerald-50 leading-relaxed bg-zinc-950/70 p-4 rounded-xl border border-emerald-500/25 shadow-inner">
                        {ticket.replyMessage}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs sm:text-sm text-amber-200 flex items-center gap-3 shadow-inner">
                      <Clock className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
                      <span className="leading-relaxed font-medium">
                        Chamado em análise pela equipe técnica e artística. Você receberá a resposta por e-mail e atualizada diretamente nesta tela.
                      </span>
                    </div>
                  )}

                  {/* Client Follow-up Thread (if any previous replies exist) */}
                  {ticket.clientReplies && Array.isArray(ticket.clientReplies) && ticket.clientReplies.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider block">
                        Suas réplicas enviadas:
                      </span>
                      {ticket.clientReplies.map((r: any, idx: number) => (
                        <div key={idx} className="p-3 bg-sky-950/30 border border-sky-500/25 rounded-xl text-xs sm:text-sm text-sky-100">
                          <div className="flex items-center justify-between text-[11px] text-sky-400/80 mb-1 font-mono">
                            <span>Sua Réplica</span>
                            {r.createdAt && <span>{new Date(r.createdAt).toLocaleString('pt-BR')}</span>}
                          </div>
                          <p className="whitespace-pre-wrap">{r.message || r}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply Input Box */}
                  <div className="pt-3 border-t border-zinc-800/80 space-y-2">
                    <label className="text-[11px] font-black text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Reply className="w-3.5 h-3.5 text-sky-400" />
                      <span>Enviar nova mensagem / réplica sobre este chamado:</span>
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="text"
                        value={clientReplyText[ticket.id] || ''}
                        onChange={(e) =>
                          setClientReplyText((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                        }
                        placeholder="Escreva sua mensagem ou réplica para a equipe..."
                        className="flex-1 bg-zinc-900/90 border border-zinc-700/80 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition-all"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSendClientReply(ticket.id);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleSendClientReply(ticket.id)}
                        disabled={sendingReply[ticket.id] || !clientReplyText[ticket.id]?.trim()}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-sky-950/40 flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-40 transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{sendingReply[ticket.id] ? 'Enviando...' : 'Responder'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Client Ticket Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!ticketToDelete}
        title="Excluir Chamado de Suporte"
        itemName={ticketToDelete?.subject || ''}
        itemType="este chamado"
        warningMessage="O histórico deste atendimento será apagado da sua conta."
        isDeleting={isDeletingTicket}
        onConfirm={async () => {
          if (ticketToDelete) {
            await handleDeleteTicketDirect(ticketToDelete.id);
          }
        }}
        onCancel={() => setTicketToDelete(null)}
      />

      {/* Admin Ticket Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!adminTicketToDelete}
        title="Excluir Chamado de Suporte"
        itemName={adminTicketToDelete ? `#${adminTicketToDelete.id} - ${adminTicketToDelete.customerName}: "${adminTicketToDelete.subject}"` : ''}
        itemType="este chamado da central"
        warningMessage="Esta ação removerá este chamado permanentemente da central de atendimento do administrador."
        isDeleting={isDeletingAdminTicket}
        onConfirm={confirmAdminDeleteTicket}
        onCancel={() => setAdminTicketToDelete(null)}
      />
    </div>
  );
};
