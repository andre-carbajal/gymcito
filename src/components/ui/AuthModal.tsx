'use client';

import { useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { X, LogIn, UserPlus, Loader2 } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
  onAuth: () => void;
}

type AuthMode = 'login' | 'register';

export function AuthModal({ onClose, onAuth }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) {
          setError(authError.message);
          return;
        }
      } else {
        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username || email.split('@')[0] },
          },
        });
        if (authError) {
          setError(authError.message);
          return;
        }
      }
      onAuth();
    } catch {
      setError('Ha ocurrido un error inesperado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#12122a] border border-[#2a2a4a] rounded-2xl shadow-2xl shadow-purple-500/10 p-6 z-10">
        {/* Close button */}
        <button
          id="auth-close-btn"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 font-heading">
            GYMCITO
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {mode === 'login' ? 'Inicia sesión para jugar' : 'Crea tu cuenta'}
          </p>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 mb-6 bg-[#1a1a2e] rounded-lg p-1">
          <button
            id="auth-login-tab"
            onClick={() => { setMode('login'); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <LogIn className="w-4 h-4" />
            Entrar
          </button>
          <button
            id="auth-register-tab"
            onClick={() => { setMode('register'); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Registrar
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label htmlFor="auth-username" className="block text-sm text-gray-300 mb-1">
                Username
              </label>
              <input
                id="auth-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="tu_nombre"
                className="w-full px-4 py-2.5 bg-[#1a1a2e] border border-[#2a2a4a] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-all"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-sm text-gray-300 mb-1">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              className="w-full px-4 py-2.5 bg-[#1a1a2e] border border-[#2a2a4a] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-all"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-sm text-gray-300 mb-1">
              Contraseña
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full px-4 py-2.5 bg-[#1a1a2e] border border-[#2a2a4a] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-all"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold rounded-xl hover:from-purple-500 hover:to-cyan-500 transition-all duration-300 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : mode === 'login' ? (
              'Iniciar Sesión'
            ) : (
              'Crear Cuenta'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
