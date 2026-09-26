import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { UserProfile } from '../types/kolvox';
import {
  User as UserIcon,
  Mic,
  Bell,
  Palette,
  Shield,
  Volume2,
  Sliders,
  Check,
  LogOut,
  Sparkles,
  Smartphone,
  Save,
  Radio,
  Eye,
  Type,
  SunMoon,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SettingsViewProps {
  user: { uid: string; email: string | null; displayName: string | null };
  userProfile: UserProfile | null;
  logout: () => void;
  onNavigateToPlans?: () => void;
}

export type SettingsTab = 'conta' | 'audio' | 'notificacoes' | 'aparencia';

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  userProfile,
  logout,
  onNavigateToPlans,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('conta');

  // Conta settings
  const [stageName, setStageName] = useState(() => {
    return localStorage.getItem('kolvox_setting_stage_name') || userProfile?.name || user.displayName || 'Vocalista KOLVOX';
  });
  const [bio, setBio] = useState(() => {
    return localStorage.getItem('kolvox_setting_bio') || 'Cantor(a) e Músico de Palco';
  });
  const [savedContaMsg, setSavedContaMsg] = useState(false);

  // Audio settings
  const [micDevice, setMicDevice] = useState(() => {
    return localStorage.getItem('kolvox_setting_mic_device') || 'default';
  });
  const [audioQuality, setAudioQuality] = useState(() => {
    return localStorage.getItem('kolvox_setting_audio_quality') || '48khz';
  });
  const [noiseGate, setNoiseGate] = useState(() => {
    return localStorage.getItem('kolvox_setting_noise_gate') !== 'false';
  });
  const [directMonitoring, setDirectMonitoring] = useState(() => {
    return localStorage.getItem('kolvox_setting_direct_monitor') === 'true';
  });
  const [micGain, setMicGain] = useState(() => {
    return Number(localStorage.getItem('kolvox_setting_mic_gain')) || 85;
  });
  const [metronomeSound, setMetronomeSound] = useState(() => {
    return localStorage.getItem('kolvox_setting_metronome') === 'true';
  });

  // Notifications settings
  const [notifyRecordings, setNotifyRecordings] = useState(() => {
    return localStorage.getItem('kolvox_setting_notify_rec') !== 'false';
  });
  const [notifySetlist, setNotifySetlist] = useState(() => {
    return localStorage.getItem('kolvox_setting_notify_setlist') !== 'false';
  });
  const [notifyRehearsal, setNotifyRehearsal] = useState(() => {
    return localStorage.getItem('kolvox_setting_notify_rehearsal') !== 'false';
  });
  const [notifySync, setNotifySync] = useState(() => {
    return localStorage.getItem('kolvox_setting_notify_sync') !== 'false';
  });
  const [stageBeep, setStageBeep] = useState(() => {
    return localStorage.getItem('kolvox_setting_stage_beep') === 'true';
  });

  // Appearance settings
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('kolvox_setting_dark_mode') !== 'false';
  });
  const [offlinePWA, setOfflinePWA] = useState(() => {
    return localStorage.getItem('kolvox_setting_offline_pwa') !== 'false';
  });
  const [stageTheme, setStageTheme] = useState(() => {
    return localStorage.getItem('kolvox_setting_stage_theme') || 'neon_cyan';
  });
  const [fontSizeSetting, setFontSizeSetting] = useState(() => {
    return localStorage.getItem('kolvox_setting_font_size') || 'normal';
  });
  const [wakeLock, setWakeLock] = useState(() => {
    return localStorage.getItem('kolvox_setting_wakelock') !== 'false';
  });
  const [chordHighlight, setChordHighlight] = useState(() => {
    return localStorage.getItem('kolvox_setting_chord_highlight') !== 'false';
  });
  const [scrollSpeedDefault, setScrollSpeedDefault] = useState(() => {
    return Number(localStorage.getItem('kolvox_setting_default_speed')) || 1.0;
  });

  const userName = userProfile?.name || user.displayName || user.email?.split('@')[0] || 'Usuário KOLVOX';
  const userInitials = userName.slice(0, 2).toUpperCase();

  const handleSaveConta = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('kolvox_setting_stage_name', stageName);
    localStorage.setItem('kolvox_setting_bio', bio);
    setSavedContaMsg(true);
    confetti({ particleCount: 25, spread: 50 });
    setTimeout(() => setSavedContaMsg(false), 3000);
  };

  const handleToggle = (key: string, currentVal: boolean, setter: (v: boolean) => void) => {
    const next = !currentVal;
    setter(next);
    localStorage.setItem(key, String(next));
  };

  const handleSelect = (key: string, val: string, setter: (v: string) => void) => {
    setter(val);
    localStorage.setItem(key, val);
    if (key === 'kolvox_setting_stage_theme') {
      document.documentElement.setAttribute('data-theme', val);
      document.body.setAttribute('data-theme', val);
      window.dispatchEvent(new CustomEvent('kolvox-theme-changed', { detail: val }));
    }
  };

  React.useEffect(() => {
    const saved = localStorage.getItem('kolvox_setting_stage_theme') || 'neon_cyan';
    document.documentElement.setAttribute('data-theme', saved);
    document.body.setAttribute('data-theme', saved);
  }, []);

  return (
    <section className="page settings-page">
      <div className="page-title mb-6">
        <div>
          <span className="small-label text-[#08a8ff] tracking-widest text-xs font-mono font-semibold">PREFERÊNCIAS</span>
          <h1 className="text-3xl font-bold text-white tracking-wide mt-1">Configurações</h1>
        </div>
      </div>

      <div className="settings-card bg-[#050f1d]/90 border border-[#0d4d82]/40 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
        {/* TABS DE CONFIGURAÇÕES COM EVENTOS FUNCIONAIS ONCLICK */}
        <div className="settings-tabs flex gap-2 border-b border-white/10 pb-4 mb-8 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('conta')}
            className={`px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'conta'
                ? 'bg-gradient-to-r from-[#073875] to-[#10205b] text-white border border-[#0b6dc0] shadow-[0_0_16px_rgba(11,109,192,0.4)]'
                : 'text-[#8190a8] hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <UserIcon className="w-4 h-4 text-[#00c8ff]" />
            <span>Conta</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audio')}
            className={`px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'audio'
                ? 'bg-gradient-to-r from-[#073875] to-[#10205b] text-white border border-[#0b6dc0] shadow-[0_0_16px_rgba(11,109,192,0.4)]'
                : 'text-[#8190a8] hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Mic className="w-4 h-4 text-[#00c8ff]" />
            <span>Áudio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notificacoes')}
            className={`px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'notificacoes'
                ? 'bg-gradient-to-r from-[#073875] to-[#10205b] text-white border border-[#0b6dc0] shadow-[0_0_16px_rgba(11,109,192,0.4)]'
                : 'text-[#8190a8] hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Bell className="w-4 h-4 text-[#00c8ff]" />
            <span>Notificações</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('aparencia')}
            className={`px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'aparencia'
                ? 'bg-gradient-to-r from-[#073875] to-[#10205b] text-white border border-[#0b6dc0] shadow-[0_0_16px_rgba(11,109,192,0.4)]'
                : 'text-[#8190a8] hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Palette className="w-4 h-4 text-[#00c8ff]" />
            <span>Aparência</span>
          </button>
        </div>

        {/* TAB 1: CONTA */}
        {activeTab === 'conta' && (
          <div className="space-y-6">
            <div className="profile-section flex items-center gap-4 p-4 rounded-2xl bg-[#030914]/80 border border-[#0e3b66]">
              <div className="avatar big-avatar w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0066ff] to-[#7928ca] flex items-center justify-center font-bold text-white text-xl shadow-lg">
                {userInitials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white truncate">{userName}</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    KOLVOX Pro
                  </span>
                </div>
                <p className="text-xs text-[#8393a9] truncate mt-0.5">{user.email || 'Conta de Demonstração'}</p>
              </div>
            </div>

            {/* Bloco: Planos Pagos & Pagamento Pix vinculado ao e-mail */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#07192f] to-[#040f1f] border border-cyan-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-cyan-500/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-lg shrink-0">
                  💎
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="text-white text-sm">Planos Pagos & Pix</strong>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                      Liberação Automática
                    </span>
                  </div>
                  <span className="text-xs text-[#8393a9] block mt-0.5">
                    Conta vinculada: <span className="text-cyan-300 font-mono font-bold">{user.email || 'kolvox.pagamentos@gmail.com'}</span>
                  </span>
                  <span className="text-[11px] text-zinc-400 block mt-0.5">
                    Ao pagar via Pix, a liberação da conta vinculada a este e-mail ocorre de forma imediata e automática.
                  </span>
                </div>
              </div>

              {onNavigateToPlans && (
                <button
                  type="button"
                  onClick={onNavigateToPlans}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-cyan-500/25 flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                >
                  <span>💎</span>
                  <span>Ver Planos & Pix</span>
                </button>
              )}
            </div>

            <form onSubmit={handleSaveConta} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#8393a9] mb-1.5 uppercase">
                    Nome Artístico no Palco
                  </label>
                  <input
                    type="text"
                    value={stageName}
                    onChange={(e) => setStageName(e.target.value)}
                    className="w-full bg-[#020712] border border-[#0e3b66] rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-[#00c8ff]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#8393a9] mb-1.5 uppercase">
                    Função / Descrição
                  </label>
                  <input
                    type="text"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full bg-[#020712] border border-[#0e3b66] rounded-xl px-3.5 py-2.5 text-white text-sm outline-none focus:border-[#00c8ff]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#078fff] to-[#633cff] text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-[#078fff]/25 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Dados da Conta</span>
                </button>
                {savedContaMsg && (
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                    <Check className="w-4 h-4" /> Alterações salvas com sucesso!
                  </span>
                )}
              </div>
            </form>

            <div className="setting-row flex items-center justify-between py-4 border-t border-white/5">
              <div>
                <strong className="text-white text-sm block">Status da Nuvem & Firestore</strong>
                <small className="text-[#8190a8] text-xs block mt-0.5">
                  Sincronização em tempo real de repertório, setlists e gravações
                </small>
              </div>
              <span className="text-xs font-semibold text-emerald-400 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Conectado
              </span>
            </div>

            <div className="setting-row flex items-center justify-between py-4 border-t border-white/5">
              <div>
                <strong className="text-white text-sm block">Encerrar sessão</strong>
                <small className="text-[#8190a8] text-xs block mt-0.5">Desconectar este dispositivo do KOLVOX</small>
              </div>
              <button
                type="button"
                onClick={logout}
                className="px-4 py-2 rounded-xl bg-red-950/40 text-red-300 border border-red-800/40 hover:bg-red-900/60 hover:text-white transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair da Conta</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: ÁUDIO */}
        {activeTab === 'audio' && (
          <div className="space-y-6">
            <div className="setting-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 border-b border-white/5">
              <div>
                <strong className="text-white text-sm block">Dispositivo de Entrada do Microfone</strong>
                <small className="text-[#8190a8] text-xs block mt-0.5">Selecione o microfone ou placa de áudio conectada</small>
              </div>
              <select
                value={micDevice}
                onChange={(e) => handleSelect('kolvox_setting_mic_device', e.target.value, setMicDevice)}
                className="bg-[#020712] border border-[#0e3b66] text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-[#00c8ff]"
              >
                <option value="default">Microfone Padrão do Sistema</option>
                <option value="usb_interface">Interface de Áudio USB / Mixer de Palco</option>
                <option value="headset">Microfone Auricular / Headset</option>
              </select>
            </div>

            <div className="setting-row flex items-center justify-between py-4 border-b border-white/5">
              <div>
                <strong className="text-white text-sm block">Qualidade de Gravação do Microfone</strong>
                <small className="text-[#8190a8] text-xs block mt-0.5">Frequência de amostragem em alta fidelidade WebAudio</small>
              </div>
              <div className="flex gap-2">
                {['48khz', '44khz', '32khz'].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSelect('kolvox_setting_audio_quality', q, setAudioQuality)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      audioQuality === q
                        ? 'bg-[#00c8ff] text-black font-bold'
                        : 'bg-[#020712] text-[#8190a8] border border-[#0e3b66]'
                    }`}
                  >
                    {q === '48khz' ? '48 kHz Estéreo (HD)' : q === '44khz' ? '44.1 kHz (CD)' : '32 kHz (Compacto)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-row flex items-center justify-between py-4 border-b border-white/5">
              <div>
                <strong className="text-white text-sm block">Redução de Ruído & Noise Gate de Palco</strong>
                <small className="text-[#8190a8] text-xs block mt-0.5">Atenua vazamento de bateria e barulho ambiente da plateia</small>
              </div>
              <label className="switch cursor-pointer">
                <input
                  type="checkbox"
                  checked={noiseGate}
                  onChange={() => handleToggle('kolvox_setting_noise_gate', noiseGate, setNoiseGate)}
                />
                <span />
              </label>
            </div>

            <div className="setting-row flex items-center justify-between py-4 border-b border-white/5">
              <div>
                <strong className="text-white text-sm block">Monitoramento de Retorno (Direct Monitor)</strong>
                <small className="text-[#8190a8] text-xs block mt-0.5">Ouvir sua própria voz no fone de ouvido em tempo real</small>
              </div>
              <label className="switch cursor-pointer">
                <input
                  type="checkbox"
                  checked={directMonitoring}
                  onChange={() => handleToggle('kolvox_setting_direct_monitor', directMonitoring, setDirectMonitoring)}
                />
                <span />
              </label>
            </div>

            <div className="setting-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 border-b border-white/5">
              <div className="flex-1">
                <strong className="text-white text-sm block">Ganho do Microfone ({micGain}%)</strong>
                <small className="text-[#8190a8] text-xs block mt-0.5">Ajuste a sensibilidade de captação vocal</small>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-64">
                <Volume2 className="w-4 h-4 text-[#00c8ff]" />
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={micGain}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setMicGain(v);
                    localStorage.setItem('kolvox_setting_mic_gain', String(v));
                  }}
                  className="flex-1 accent-[#00c8ff]"
                />
                <span className="text-xs font-mono text-white w-10 text-right">{micGain}%</span>
              </div>
            </div>

            <div className="setting-row flex items-center justify-between py-4">
              <div>
                <strong className="text-white text-sm block">Bip Metrônomo no Fone de Palco</strong>
                <small className="text-[#8190a8] text-xs block mt-0.5">Executar clique suave sincronizado com o BPM da música</small>
              </div>
              <label className="switch cursor-pointer">
                <input
                  type="checkbox"
                  checked={metronomeSound}
                  onChange={() => handleToggle('kolvox_setting_metronome', metronomeSound, setMetronomeSound)}
                />
                <span />
              </label>
            </div>
          </div>
        )}

        {/* TAB 3: NOTIFICAÇÕES */}
        {activeTab === 'notificacoes' && (
          <div className="space-y-6">
            <div className="setting-row flex items-center justify-between py-4 border-b border-white/5">
              <div>
                <strong className="text-white text-sm block">Alertas de Gravação Concluída</strong>
                <small className="text-[#8190a8] text-xs block mt-0.5">Exibir notificação ao finalizar e salvar um take de ensaio</small>
              </div>
              <label className="switch cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyRecordings}
                  onChange={() => handleToggle('kolvox_setting_notify_rec', notifyRecordings, setNotifyRecordings)}
                />
                <span />
              </label>
            </div>

            <div className="setting-row flex items-center justify-between py-4 border-b border-white/5">
              <div>
                <strong className="text-white text-sm block">Lembretes de Ordem do Setlist</strong>
                <small className="text-[#8190a8] text-xs block mt-0.5">Avisar a próxima música do roteiro 15 segundos antes do fim</small>
              </div>
              <label className="switch cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifySetlist}
                  onChange={() => handleToggle('kolvox_setting_notify_setlist', notifySetlist, setNotifySetlist)}
                />
                <span />
              </label>
            </div>

            <div className="setting-row flex items-center justify-between py-4 border-b border-white/5">
              <div>
                <strong className="text-white text-sm block">Notificações de Ensaio da Banda</strong>
                <small className="text-[#8190a8] text-xs block mt-0.5">Receber lembretes de horários e mudanças de repertório</small>
              </div>
              <label className="switch cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyRehearsal}
                  onChange={() => handleToggle('kolvox_setting_notify_rehearsal', notifyRehearsal, setNotifyRehearsal)}
                />
                <span />
              </label>
            </div>

            <div className="setting-row flex items-center justify-between py-4 border-b border-white/5">
              <div>
                <strong className="text-white text-sm block">Avisos de Sincronização de Letras</strong>
                <small className="text-[#8190a8] text-xs block mt-0.5">Notificar quando novas letras e cifras completas forem adicionadas</small>
              </div>
              <label className="switch cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifySync}
                  onChange={() => handleToggle('kolvox_setting_notify_sync', notifySync, setNotifySync)}
                />
                <span />
              </label>
            </div>

            <div className="setting-row flex items-center justify-between py-4">
              <div>
                <strong className="text-white text-sm block">Bip Suave ao Trocar de Música no Palco</strong>
                <small className="text-[#8190a8] text-xs block mt-0.5">Sinal auditivo de confirmação ao avançar via pedal ou teclado</small>
              </div>
              <label className="switch cursor-pointer">
                <input
                  type="checkbox"
                  checked={stageBeep}
                  onChange={() => handleToggle('kolvox_setting_stage_beep', stageBeep, setStageBeep)}
                />
                <span />
              </label>
            </div>
          </div>
        )}

        {/* TAB 4: APARÊNCIA */}
        {activeTab === 'aparencia' && (
          <div className="space-y-6">
            <div className="setting-row flex items-center justify-between py-4 border-b border-white/5">
              <div>
                <strong className="text-white text-sm block">Modo Escuro / Palco Neon</strong>
                <small className="text-[#8190a8] text-xs block mt-0.5">Ativar contraste máximo para apresentações noturnas</small>
              </div>
              <label className="switch cursor-pointer">
                <input
                  type="checkbox"
                  checked={darkMode}
                  onChange={() => handleToggle('kolvox_setting_dark_mode', darkMode, setDarkMode)}
                />
                <span />
              </label>
            </div>

            <div className="setting-row flex items-center justify-between py-4 border-b border-white/5">
              <div>
                <strong className="text-white text-sm block">Salvar músicas offline (PWA)</strong>
                <small className="text-[#8190a8] text-xs block mt-0.5">Guardar letras e cifras no dispositivo para ensaios sem internet</small>
              </div>
              <label className="switch cursor-pointer">
                <input
                  type="checkbox"
                  checked={offlinePWA}
                  onChange={() => handleToggle('kolvox_setting_offline_pwa', offlinePWA, setOfflinePWA)}
                />
                <span />
              </label>
            </div>

            <div className="setting-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 border-b border-white/5">
              <div>
                <strong className="text-white text-sm block">Esquema de Cores do Palco</strong>
                <small className="text-[#8190a8] text-xs block mt-0.5">Paleta visual para o teleprompter e painel</small>
              </div>
              <div className="flex gap-2">
                {[
                  { id: 'neon_cyan', label: 'Ciano Neon' },
                  { id: 'deep_blue', label: 'Azul Cyber' },
                  { id: 'pure_oled', label: 'Preto OLED' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelect('kolvox_setting_stage_theme', t.id, setStageTheme)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      stageTheme === t.id
                        ? 'bg-[#00c8ff] text-black font-bold'
                        : 'bg-[#020712] text-[#8190a8] border border-[#0e3b66]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 border-b border-white/5">
              <div>
                <strong className="text-white text-sm block">Tamanho da Fonte das Letras no Modo Show</strong>
                <small className="text-[#8190a8] text-xs block mt-0.5">Dimensão dos versos para leitura de 1 a 3 metros de distância</small>
              </div>
              <div className="flex gap-2">
                {[
                  { id: 'small', label: '20px' },
                  { id: 'normal', label: '26px' },
                  { id: 'large', label: '32px' },
                  { id: 'huge', label: '40px' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => handleSelect('kolvox_setting_font_size', f.id, setFontSizeSetting)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      fontSizeSetting === f.id
                        ? 'bg-[#00c8ff] text-black font-bold'
                        : 'bg-[#020712] text-[#8190a8] border border-[#0e3b66]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-row flex items-center justify-between py-4 border-b border-white/5">
              <div>
                <strong className="text-white text-sm block">Manter Tela Sempre Ligada (WakeLock)</strong>
                <small className="text-[#8190a8] text-xs block mt-0.5">Impede a tela de apagar ou suspender durante o show</small>
              </div>
              <label className="switch cursor-pointer">
                <input
                  type="checkbox"
                  checked={wakeLock}
                  onChange={() => handleToggle('kolvox_setting_wakelock', wakeLock, setWakeLock)}
                />
                <span />
              </label>
            </div>

            <div className="setting-row flex items-center justify-between py-4">
              <div>
                <strong className="text-white text-sm block">Destaque Colorido para Acordes e Cifras</strong>
                <small className="text-[#8190a8] text-xs block mt-0.5">Realça cifras em tom âmbar neon no topo de cada verso</small>
              </div>
              <label className="switch cursor-pointer">
                <input
                  type="checkbox"
                  checked={chordHighlight}
                  onChange={() => handleToggle('kolvox_setting_chord_highlight', chordHighlight, setChordHighlight)}
                />
                <span />
              </label>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
