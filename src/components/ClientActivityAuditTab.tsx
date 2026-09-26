import React, { useState, useEffect } from 'react';
import { ClientActivity, getClientActivities, clearClientActivities, recordClientActivity } from '../services/ActivityLogger';
import {
  Activity,
  LogIn,
  LogOut,
  Mic,
  Music,
  FolderHeart,
  CreditCard,
  Lock,
  Mail,
  RefreshCw,
  Search,
  Filter,
  Trash2,
  Clock,
  User,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface ClientActivityAuditTabProps {
  usersList?: any[];
}

export const ClientActivityAuditTab: React.FC<ClientActivityAuditTabProps> = ({ usersList = [] }) => {
  const [activities, setActivities] = useState<ClientActivity[]>([]);
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const loadActivities = () => {
    const list = getClientActivities(selectedUserFilter !== 'ALL' ? selectedUserFilter : undefined);
    setActivities(list);
    setLastRefreshed(new Date());
  };

  useEffect(() => {
    loadActivities();
  }, [selectedUserFilter]);

  const handleSimulateClientAction = (actionType: 'LOGIN' | 'SHOW_MODE' | 'PAYMENT') => {
    if (actionType === 'LOGIN') {
      recordClientActivity({
        userId: 'guest_vocalist_principal',
        userEmail: 'demo@kolvox.app',
        userName: 'Vocalista Convidado',
        actionType: 'LOGIN',
        action: 'Login no Sistema',
        details: 'Cliente acessou o aplicativo através do modo Convidado.',
        ip: '189.40.12.98 (São Paulo, BR)',
      });
    } else if (actionType === 'SHOW_MODE') {
      recordClientActivity({
        userId: 'guest_vocalist_principal',
        userEmail: 'demo@kolvox.app',
        userName: 'Vocalista Convidado',
        actionType: 'SHOW_MODE',
        action: 'Iniciou Modo Show / Teleprompter',
        details: 'Música: "Metamorfose Ambulante" (Raul Seixas) • Rolagem em 45 px/s • Tom: G',
        ip: '189.40.12.98 (São Paulo, BR)',
      });
    } else if (actionType === 'PAYMENT') {
      recordClientActivity({
        userId: 'guest_vocalist_principal',
        userEmail: 'demo@kolvox.app',
        userName: 'Vocalista Convidado',
        actionType: 'PAYMENT',
        action: 'Tentativa de Pagamento Pix Gerada',
        details: 'Código Pix gerado para Plano Anual (R$ 99,99) • Chave kolvox.pagamentos@gmail.com',
        ip: '189.40.12.98 (São Paulo, BR)',
      });
    }
    loadActivities();
  };

  const filteredActivities = activities.filter((act) => {
    if (selectedTypeFilter !== 'ALL' && act.actionType !== selectedTypeFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      act.action.toLowerCase().includes(q) ||
      act.userName.toLowerCase().includes(q) ||
      act.userEmail.toLowerCase().includes(q) ||
      (act.details && act.details.toLowerCase().includes(q))
    );
  });

  const getActionBadge = (type: ClientActivity['actionType']) => {
    switch (type) {
      case 'LOGIN':
        return {
          icon: LogIn,
          color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          label: 'Login',
        };
      case 'LOGOUT':
        return {
          icon: LogOut,
          color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
          label: 'Logout',
        };
      case 'SHOW_MODE':
        return {
          icon: Mic,
          color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
          label: 'Modo Show',
        };
      case 'SONG':
        return {
          icon: Music,
          color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
          label: 'Música',
        };
      case 'SETLIST':
        return {
          icon: FolderHeart,
          color: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
          label: 'Repertório',
        };
      case 'RECORDING':
        return {
          icon: Mic,
          color: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          label: 'Gravação',
        };
      case 'PAYMENT':
        return {
          icon: CreditCard,
          color: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          label: 'Pagamento Pix',
        };
      case 'TRIAL':
        return {
          icon: Lock,
          color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
          label: 'Teste de 7 Dias',
        };
      case 'SUPPORT':
        return {
          icon: Mail,
          color: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          label: 'Suporte',
        };
      default:
        return {
          icon: Activity,
          color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
          label: 'Sistema',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Summary */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20 mb-2">
              <Activity className="w-3.5 h-3.5" />
              <span>AUDITORIA EM TEMPO REAL • TUDO FEITO NA CONTA DO CLIENTE</span>
            </div>
            <h2 className="text-xl font-bold text-white">Monitoramento de Atividades dos Clientes</h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
              Rastreamento contínuo de logins, acesso ao teleprompter/Modo Show, setlists criados,
              gravações, tentativas de pagamento Pix, bloqueios por teste expirado e suporte.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadActivities}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold border border-zinc-700 flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              <span>Atualizar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Deseja limpar os registros locais de auditoria?')) {
                  clearClientActivities();
                  loadActivities();
                }
              }}
              title="Limpar histórico"
              className="p-2 rounded-xl bg-zinc-800/80 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-zinc-700/80 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Simulation Bar for Demonstration */}
        <div className="mt-4 pt-4 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-zinc-400 flex items-center gap-2">
            <span className="font-bold text-zinc-300">Total de Eventos:</span>
            <span className="font-mono bg-zinc-950 px-2 py-0.5 rounded text-amber-400 font-bold">
              {filteredActivities.length}
            </span>
            <span className="text-[11px] text-zinc-500 ml-2">
              Última atualização: {lastRefreshed.toLocaleTimeString('pt-BR')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500">Simular Ação do Cliente:</span>
            <button
              type="button"
              onClick={() => handleSimulateClientAction('LOGIN')}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 font-semibold"
            >
              + Login
            </button>
            <button
              type="button"
              onClick={() => handleSimulateClientAction('SHOW_MODE')}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 font-semibold"
            >
              + Modo Show
            </button>
            <button
              type="button"
              onClick={() => handleSimulateClientAction('PAYMENT')}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 font-semibold"
            >
              + Gerou Pix
            </button>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar por cliente, ação ou detalhes..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-hidden focus:border-amber-400"
          />
        </div>

        {/* Filter by Client */}
        <div className="relative">
          <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <select
            value={selectedUserFilter}
            onChange={(e) => setSelectedUserFilter(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-hidden focus:border-amber-400"
          >
            <option value="ALL">Todos os Clientes</option>
            <option value="guest_vocalist_principal">Vocalista Convidado (demo@kolvox.app)</option>
            {usersList.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nomeArtistico || u.nomeCompleto} ({u.email})
              </option>
            ))}
          </select>
        </div>

        {/* Filter by Action Type */}
        <div className="relative">
          <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-hidden focus:border-amber-400"
          >
            <option value="ALL">Todas as Ações</option>
            <option value="LOGIN">Logins</option>
            <option value="LOGOUT">Logouts</option>
            <option value="SHOW_MODE">Modo Show / Teleprompter</option>
            <option value="SONG">Músicas Adicionadas / Editadas</option>
            <option value="SETLIST">Setlists / Repertórios</option>
            <option value="RECORDING">Gravações de Voz</option>
            <option value="PAYMENT">Pagamentos / Pix</option>
            <option value="TRIAL">Teste de 7 Dias / Bloqueios</option>
            <option value="SUPPORT">Chamados de Suporte</option>
          </select>
        </div>
      </div>

      {/* Activities Timeline Feed */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-4 sm:p-6">
        {filteredActivities.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-500 mx-auto">
              <Activity className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-zinc-300">Nenhum registro encontrado</h4>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Não foram encontradas atividades recentes para os filtros selecionados.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredActivities.map((act) => {
              const badge = getActionBadge(act.actionType);
              const Icon = badge.icon;
              const date = new Date(act.timestamp);
              const formattedDate = date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              });
              const formattedTime = date.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <div
                  key={act.id}
                  className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${badge.color}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-white">{act.action}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <div className="text-xs text-zinc-300 leading-relaxed break-words">
                        {act.details || 'Sem detalhes adicionais informados.'}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500 pt-0.5">
                        <span className="flex items-center gap-1 font-medium text-zinc-400">
                          <User className="w-3 h-3 text-amber-400" />
                          <strong>{act.userName}</strong> ({act.userEmail})
                        </span>
                        {act.ip && (
                          <span className="font-mono text-zinc-500">• IP: {act.ip}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 text-right font-mono text-[11px] text-zinc-400 pl-13 sm:pl-0">
                    <span className="text-zinc-300 font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      {formattedTime}
                    </span>
                    <span className="text-zinc-500 text-[10px]">{formattedDate}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
