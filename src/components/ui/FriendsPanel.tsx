'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  searchUsers,
  sendFriendRequest,
  respondFriendRequest,
  removeFriend,
  getFriends,
  getPendingRequests,
  getSentRequests,
  subscribeFriendships,
} from '@/src/lib/supabase';
import type { Friendship, UserSearchResult } from '@/src/lib/types';
import {
  X,
  Search,
  Users,
  Bell,
  UserPlus,
  Check,
  XCircle,
  Trash2,
  Loader2,
  BarChart3,
  Clock,
  Send,
} from 'lucide-react';

type Tab = 'friends' | 'requests' | 'search';

interface FriendsPanelProps {
  onClose: () => void;
  onCompare: (friendId: string, friendName: string) => void;
  pendingCount: number;
  onPendingCountChange: (count: number) => void;
}

export function FriendsPanel({
  onClose,
  onCompare,
  pendingCount,
  onPendingCountChange,
}: FriendsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pending, setPending] = useState<Friendship[]>([]);
  const [sent, setSent] = useState<Friendship[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    const [friendsData, pendingData, sentData] = await Promise.all([
      getFriends(),
      getPendingRequests(),
      getSentRequests(),
    ]);
    setFriends(friendsData);
    setPending(pendingData);
    setSent(sentData);
    onPendingCountChange(pendingData.length);
    setLoading(false);
  }, [onPendingCountChange]);

  // Initial data load
  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  // Realtime subscription
  useEffect(() => {
    const channel = subscribeFriendships(() => {
      void refreshData();
    });

    return () => {
      void channel.unsubscribe();
    };
  }, [refreshData]);

  // Search debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      const results = await searchUsers(searchQuery);
      setSearchResults(results);
      setSearchLoading(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  function showFeedback(type: 'success' | 'error', msg: string) {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3000);
  }

  async function handleSendRequest(userId: string) {
    setActionLoading(userId);
    const result = await sendFriendRequest(userId);
    if (result.success) {
      if (result.autoAccepted) {
        showFeedback('success', '¡Ahora son amigos! (solicitud mutua)');
      } else {
        showFeedback('success', 'Solicitud enviada');
      }
      void refreshData();
      setSearchQuery('');
      setSearchResults([]);
    } else {
      showFeedback('error', result.error ?? 'Error');
    }
    setActionLoading(null);
  }

  async function handleRespond(friendshipId: string, accept: boolean) {
    setActionLoading(friendshipId);
    const result = await respondFriendRequest(friendshipId, accept);
    if (result.success) {
      showFeedback('success', accept ? '¡Solicitud aceptada!' : 'Solicitud rechazada');
      void refreshData();
    } else {
      showFeedback('error', result.error ?? 'Error');
    }
    setActionLoading(null);
  }

  async function handleRemove(friendshipId: string) {
    setActionLoading(friendshipId);
    const result = await removeFriend(friendshipId);
    if (result.success) {
      showFeedback('success', 'Amigo eliminado');
      void refreshData();
    } else {
      showFeedback('error', result.error ?? 'Error');
    }
    setActionLoading(null);
    setConfirmRemoveId(null);
  }

  // Check if a user is already a friend or has a pending request
  function getUserRelationStatus(userId: string): 'friend' | 'pending_sent' | 'pending_received' | null {
    if (friends.some((f) => f.friend_profile?.id === userId)) return 'friend';
    if (sent.some((f) => f.friend_id === userId)) return 'pending_sent';
    if (pending.some((f) => f.user_id === userId)) return 'pending_received';
    return null;
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'friends', label: 'Amigos', icon: <Users className="w-3.5 h-3.5" />, count: friends.length },
    {
      id: 'requests',
      label: 'Solicitudes',
      icon: <Bell className="w-3.5 h-3.5" />,
      count: pendingCount,
    },
    { id: 'search', label: 'Buscar', icon: <Search className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md h-full bg-[#0e0e1f] border-l border-[#2a2a4a] shadow-2xl shadow-purple-500/10 animate-slide-in-right flex flex-col z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a4a]">
          <h2 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 font-heading flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            AMIGOS
          </h2>
          <button
            id="friends-panel-close-btn"
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors cursor-pointer p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mx-4 mt-4 bg-[#1a1a2e] rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`friends-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-bold transition-all duration-200 cursor-pointer relative ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg shadow-purple-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-[#252547]'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`min-w-[18px] h-[18px] text-[10px] rounded-full flex items-center justify-center font-bold ${
                    tab.id === 'requests' && tab.count > 0
                      ? 'bg-red-500 text-white badge-pulse'
                      : 'bg-[#2a2a4a] text-gray-300'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Feedback toast */}
        {feedback && (
          <div
            className={`mx-4 mt-3 px-3 py-2 rounded-lg text-sm animate-slide-up ${
              feedback.type === 'success'
                ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}
          >
            {feedback.msg}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* ── Friends Tab ───────────────────────────────── */}
              {activeTab === 'friends' && (
                <div className="space-y-2">
                  {friends.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No tienes amigos aún</p>
                      <p className="text-gray-600 text-xs mt-1">
                        Busca usuarios para enviar solicitudes
                      </p>
                    </div>
                  ) : (
                    friends.map((friend) => (
                      <div
                        key={friend.id}
                        className="flex items-center justify-between bg-[#12122a] border border-[#2a2a4a] rounded-xl px-4 py-3 hover:border-purple-500/30 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-cyan-600 flex items-center justify-center text-white text-sm font-bold">
                            {friend.friend_profile?.username?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <span className="text-sm font-medium text-gray-200">
                            {friend.friend_profile?.username ?? 'Usuario'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            id={`compare-btn-${friend.id}`}
                            onClick={() =>
                              onCompare(
                                friend.friend_profile?.id ?? '',
                                friend.friend_profile?.username ?? 'Amigo',
                              )
                            }
                            className="p-2 rounded-lg bg-cyan-600/10 text-cyan-400 hover:bg-cyan-600/20 transition-colors cursor-pointer"
                            title="Comparar scores"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </button>
                          {confirmRemoveId === friend.id ? (
                            <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1 animate-slide-up">
                              <span className="text-[10px] text-red-300 mr-1">¿Eliminar?</span>
                              <button
                                id={`confirm-remove-btn-${friend.id}`}
                                onClick={() => handleRemove(friend.id)}
                                disabled={actionLoading === friend.id}
                                className="p-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/40 transition-colors cursor-pointer disabled:opacity-50"
                                title="Confirmar"
                              >
                                {actionLoading === friend.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                id={`cancel-remove-btn-${friend.id}`}
                                onClick={() => setConfirmRemoveId(null)}
                                className="p-1 rounded bg-gray-600/20 text-gray-400 hover:bg-gray-600/40 transition-colors cursor-pointer"
                                title="Cancelar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              id={`remove-btn-${friend.id}`}
                              onClick={() => setConfirmRemoveId(friend.id)}
                              disabled={actionLoading === friend.id}
                              className="p-2 rounded-lg bg-red-600/10 text-red-400 hover:bg-red-600/20 transition-colors cursor-pointer disabled:opacity-50"
                              title="Eliminar amigo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── Requests Tab ──────────────────────────────── */}
              {activeTab === 'requests' && (
                <div className="space-y-4">
                  {/* Received */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Bell className="w-3 h-3" />
                      Recibidas ({pending.length})
                    </h3>
                    {pending.length === 0 ? (
                      <p className="text-gray-600 text-sm py-4 text-center">
                        No hay solicitudes pendientes
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {pending.map((req) => (
                          <div
                            key={req.id}
                            className="flex items-center justify-between bg-[#12122a] border border-[#2a2a4a] rounded-xl px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">
                                {req.friend_profile?.username?.[0]?.toUpperCase() ?? '?'}
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-200 block">
                                  {req.friend_profile?.username ?? 'Usuario'}
                                </span>
                                <span className="text-[10px] text-gray-500">
                                  Quiere ser tu amigo
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                id={`accept-btn-${req.id}`}
                                onClick={() => handleRespond(req.id, true)}
                                disabled={actionLoading === req.id}
                                className="p-2 rounded-lg bg-green-600/10 text-green-400 hover:bg-green-600/20 transition-colors cursor-pointer disabled:opacity-50"
                                title="Aceptar"
                              >
                                {actionLoading === req.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Check className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                id={`reject-btn-${req.id}`}
                                onClick={() => handleRespond(req.id, false)}
                                disabled={actionLoading === req.id}
                                className="p-2 rounded-lg bg-red-600/10 text-red-400 hover:bg-red-600/20 transition-colors cursor-pointer disabled:opacity-50"
                                title="Rechazar"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sent */}
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Send className="w-3 h-3" />
                      Enviadas ({sent.length})
                    </h3>
                    {sent.length === 0 ? (
                      <p className="text-gray-600 text-sm py-4 text-center">
                        No has enviado solicitudes
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {sent.map((req) => (
                          <div
                            key={req.id}
                            className="flex items-center justify-between bg-[#12122a] border border-[#2a2a4a] rounded-xl px-4 py-3 opacity-70"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-white text-sm font-bold">
                                {req.friend_profile?.username?.[0]?.toUpperCase() ?? '?'}
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-300 block">
                                  {req.friend_profile?.username ?? 'Usuario'}
                                </span>
                                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  Pendiente
                                </span>
                              </div>
                            </div>

                            <button
                              id={`cancel-btn-${req.id}`}
                              onClick={() => handleRemove(req.id)}
                              disabled={actionLoading === req.id}
                              className="p-2 rounded-lg bg-gray-600/10 text-gray-400 hover:bg-gray-600/20 transition-colors cursor-pointer disabled:opacity-50"
                              title="Cancelar solicitud"
                            >
                              {actionLoading === req.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <X className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Search Tab ────────────────────────────────── */}
              {activeTab === 'search' && (
                <div>
                  {/* Search input */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      id="friend-search-input"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por username..."
                      className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a2e] border border-[#2a2a4a] rounded-lg text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-all"
                      autoFocus
                    />
                    {searchLoading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 animate-spin" />
                    )}
                  </div>

                  {/* Results */}
                  {searchQuery.trim() && !searchLoading && searchResults.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-8">
                      No se encontraron usuarios
                    </p>
                  )}

                  <div className="space-y-2">
                    {searchResults.map((user) => {
                      const status = getUserRelationStatus(user.id);
                      return (
                        <div
                          key={user.id}
                          className="flex items-center justify-between bg-[#12122a] border border-[#2a2a4a] rounded-xl px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                              {user.username[0]?.toUpperCase() ?? '?'}
                            </div>
                            <span className="text-sm font-medium text-gray-200">
                              {user.username}
                            </span>
                          </div>

                          {status === 'friend' ? (
                            <span className="text-xs text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full">
                              ✓ Amigos
                            </span>
                          ) : status === 'pending_sent' ? (
                            <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Enviada
                            </span>
                          ) : status === 'pending_received' ? (
                            <span className="text-xs text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full">
                              Te envió solicitud
                            </span>
                          ) : (
                            <button
                              id={`send-request-btn-${user.id}`}
                              onClick={() => handleSendRequest(user.id)}
                              disabled={actionLoading === user.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {actionLoading === user.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <UserPlus className="w-3.5 h-3.5" />
                              )}
                              Agregar
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {!searchQuery.trim() && (
                    <div className="text-center py-12">
                      <Search className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">
                        Escribe un username para buscar
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
