import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Radio,
  Search,
  Music,
  FolderHeart,
  Star,
  PlusCircle,
  Eye,
  Guitar,
  Mic,
  Crown,
  Shield,
  LogOut,
  Menu,
  X,
  HelpCircle,
  Settings,
  ChevronDown,
  User as UserIcon,
} from 'lucide-react';

interface NavbarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  onOpenAddModal: () => void;
  onOpenProModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onSelectView,
  onOpenAddModal,
  onOpenProModal,
}) => {
  const { user, trialDaysLeft, isPremiumActive, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { id: 'dashboard', label: 'Início', icon: Radio },
    { id: 'search', label: 'Pesquisar', icon: Search },
    { id: 'my-songs', label: 'Minhas músicas', icon: Music },
    { id: 'playlists', label: 'Repertórios', icon: FolderHeart },
    { id: 'favorites', label: 'Favoritas', icon: Star },
    { id: 'recordings', label: 'Gravações', icon: Mic },
    { id: 'stage', label: 'Modo palco', icon: Eye, highlight: true },
    { id: 'guitar', label: 'Modo violão', icon: Guitar },
  ];

  const handleNavClick = (viewId: string) => {
    onSelectView(viewId);
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setUserDropdownOpen(false);
    setMobileMenuOpen(false);
    await logout();
  };

  return (
    <nav className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavClick('dashboard')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-zinc-950 shadow-md shadow-amber-500/20">
              <Radio className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-lg font-black tracking-tight text-white font-display flex items-center gap-1.5">
                KOLVOX <span className="text-amber-400">STAGE</span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-amber-400 text-zinc-950 shadow-sm shadow-amber-400/20 font-bold'
                      : item.highlight
                      ? 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Action Icons & User Info */}
          <div className="hidden sm:flex items-center gap-2">
            {/* Quick Add Song Button */}
            <button
              id="btn-nav-add-song"
              onClick={onOpenAddModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 transition-colors"
            >
              <PlusCircle className="w-4 h-4 text-amber-400" />
              <span>Adicionar música</span>
            </button>

            {/* Subscription badge */}
            <button
              id="btn-nav-subscription-badge"
              onClick={() => handleNavClick('subscription')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                isPremiumActive
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                  : 'bg-red-500/10 text-red-300 border-red-500/30 hover:bg-red-500/20'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>{isPremiumActive ? `PRO (${trialDaysLeft}d)` : 'Assinar PRO'}</span>
            </button>

            {/* Admin panel link if ADMIN */}
            {user?.tipoUsuario === 'ADMIN' && (
              <button
                id="btn-nav-admin"
                onClick={() => handleNavClick('admin')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20 transition-colors"
              >
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                <span>Admin</span>
              </button>
            )}

            {/* User Profile Button with full Dropdown Menu (Item 6 & 7) */}
            <div className="relative pl-2 border-l border-zinc-800" ref={userMenuRef}>
              <button
                id="btn-nav-profile-menu"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors border border-transparent hover:border-zinc-800"
              >
                <div className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-400 font-bold text-xs">
                  {user?.nomeArtistico?.charAt(0) || user?.nomeCompleto?.charAt(0) || 'M'}
                </div>
                <span className="max-w-[120px] truncate font-semibold">
                  {user?.nomeArtistico || user?.nomeCompleto || 'Artista'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* User Dropdown Menu (Required by Item 7) */}
              {userDropdownOpen && (
                <div
                  id="user-dropdown-menu"
                  className="absolute right-0 mt-2 w-56 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  <div className="px-4 py-2 border-b border-zinc-800">
                    <p className="text-xs font-bold text-white truncate">
                      {user?.nomeArtistico || user?.nomeCompleto}
                    </p>
                    <p className="text-[11px] text-zinc-400 truncate">{user?.email}</p>
                    <span className="inline-block mt-1 text-[10px] uppercase tracking-wider font-mono font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                      {user?.tipoUsuario === 'ADMIN' ? 'Administrador' : 'Músico'}
                    </span>
                  </div>

                  <div className="py-1">
                    {/* 1. Meu perfil */}
                    <button
                      id="menu-item-profile"
                      onClick={() => handleNavClick('profile')}
                      className="w-full px-4 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5 transition-colors"
                    >
                      <UserIcon className="w-4 h-4 text-amber-400" />
                      <span>Meu perfil</span>
                    </button>

                    {/* 2. Minhas músicas */}
                    <button
                      id="menu-item-my-songs"
                      onClick={() => handleNavClick('my-songs')}
                      className="w-full px-4 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5 transition-colors"
                    >
                      <Music className="w-4 h-4 text-amber-400" />
                      <span>Minhas músicas</span>
                    </button>

                    {/* 3. Meus repertórios */}
                    <button
                      id="menu-item-playlists"
                      onClick={() => handleNavClick('playlists')}
                      className="w-full px-4 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5 transition-colors"
                    >
                      <FolderHeart className="w-4 h-4 text-amber-400" />
                      <span>Meus repertórios</span>
                    </button>

                    {/* 4. Favoritas */}
                    <button
                      id="menu-item-favorites"
                      onClick={() => handleNavClick('favorites')}
                      className="w-full px-4 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5 transition-colors"
                    >
                      <Star className="w-4 h-4 text-amber-400" />
                      <span>Favoritas</span>
                    </button>

                    {/* 5. Minha assinatura */}
                    <button
                      id="menu-item-subscription"
                      onClick={() => handleNavClick('subscription')}
                      className="w-full px-4 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5 transition-colors"
                    >
                      <Crown className="w-4 h-4 text-amber-400" />
                      <span>Minha assinatura</span>
                    </button>

                    {/* 6. Suporte */}
                    <button
                      id="menu-item-support"
                      onClick={() => handleNavClick('support')}
                      className="w-full px-4 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5 transition-colors"
                    >
                      <HelpCircle className="w-4 h-4 text-amber-400" />
                      <span>Suporte</span>
                    </button>

                    {/* 7. Configurações */}
                    <button
                      id="menu-item-settings"
                      onClick={() => handleNavClick('profile')}
                      className="w-full px-4 py-2 text-left text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-amber-400" />
                      <span>Configurações</span>
                    </button>
                  </div>

                  {/* 8. Sair (Logout Real) */}
                  <div className="pt-1 border-t border-zinc-800">
                    <button
                      id="menu-item-logout"
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-2.5 font-semibold transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sair</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Hamburger Toggle */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              id="btn-mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-900"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-zinc-800 bg-zinc-950 p-4 space-y-3 animate-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-400/20 text-amber-400 flex items-center justify-center font-bold text-xs border border-amber-400/30">
                {user?.nomeArtistico?.charAt(0) || 'M'}
              </div>
              <div>
                <div className="text-xs font-bold text-white">{user?.nomeArtistico || user?.nomeCompleto}</div>
                <div className="text-[10px] text-zinc-400">{user?.email}</div>
              </div>
            </div>
            <span className="text-[11px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-mono">
              {trialDaysLeft}d restantes
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold ${
                    isActive
                      ? 'bg-amber-400 text-zinc-950 font-bold'
                      : 'bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  <Icon className="w-4 h-4 text-amber-400" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-zinc-800 space-y-1.5">
            <button
              onClick={() => {
                onOpenAddModal();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-zinc-900 text-xs font-bold text-zinc-200"
            >
              <PlusCircle className="w-4 h-4 text-amber-400" /> Adicionar música
            </button>

            <button
              onClick={() => handleNavClick('profile')}
              className="w-full flex items-center justify-start gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-300 hover:bg-zinc-900"
            >
              <UserIcon className="w-4 h-4 text-amber-400" /> Meu perfil
            </button>

            <button
              onClick={() => handleNavClick('subscription')}
              className="w-full flex items-center justify-start gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-300 hover:bg-zinc-900"
            >
              <Crown className="w-4 h-4 text-amber-400" /> Minha assinatura
            </button>

            <button
              onClick={() => handleNavClick('support')}
              className="w-full flex items-center justify-start gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-300 hover:bg-zinc-900"
            >
              <HelpCircle className="w-4 h-4 text-amber-400" /> Suporte
            </button>

            {user?.tipoUsuario === 'ADMIN' && (
              <button
                onClick={() => handleNavClick('admin')}
                className="w-full flex items-center justify-start gap-2.5 px-3 py-2 rounded-xl bg-purple-500/20 text-xs font-bold text-purple-300"
              >
                <Shield className="w-4 h-4 text-purple-400" /> Painel do Administrador
              </button>
            )}

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 mt-2"
            >
              <LogOut className="w-4 h-4" /> Sair da conta
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};
