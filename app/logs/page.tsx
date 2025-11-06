'use client';

import { useEffect, useState } from 'react';
import { Search, Filter, AlertCircle, CheckCircle, XCircle, Clock, Shield, Download } from 'lucide-react';

type Log = {
  id: number;
  user_id: string | null;
  action: string;
  resource: string | null;
  status: 'success' | 'failed' | string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string | null;
};

type LogsResponse = {
  total: number | null;
  limit: number;
  offset: number;
  data: Log[];
};

const PAGE_SIZE = 50;

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [filterIp, setFilterIp] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed'>('all');

  async function fetchLogs(params?: { offset?: number; ip?: string; action?: string; status?: string }) {
    setLoading(true);
    setErrorMsg(null);

    try {
      const searchParams = new URLSearchParams();
      searchParams.set('limit', String(PAGE_SIZE));
      searchParams.set('offset', String(params?.offset ?? offset));

      if (params?.ip) searchParams.set('ip', params.ip);
      if (params?.action) searchParams.set('action', params.action);
      if (params?.status && params.status !== 'all') searchParams.set('status', params.status);

      const res = await fetch(`/api/log?${searchParams.toString()}`, {
        method: 'GET',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Erreur HTTP ${res.status}`);
      }

      const json: LogsResponse = await res.json();
      setLogs(json.data || []);
      setTotal(json.total ?? null);
      setOffset(json.offset);
    } catch (err: any) {
      console.error('Erreur fetch logs:', err);
      setErrorMsg(err.message || 'Erreur lors du chargement des logs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  function applyFilters() {
    fetchLogs({
      offset: 0,
      ip: filterIp || undefined,
      action: filterAction || undefined,
      status: filterStatus !== 'all' ? filterStatus : undefined,
    });
  }

  function nextPage() {
    if (total !== null && offset + PAGE_SIZE >= total) return;
    fetchLogs({
      offset: offset + PAGE_SIZE,
      ip: filterIp || undefined,
      action: filterAction || undefined,
      status: filterStatus !== 'all' ? filterStatus : undefined,
    });
  }

  function prevPage() {
    if (offset === 0) return;
    const newOffset = Math.max(0, offset - PAGE_SIZE);
    fetchLogs({
      offset: newOffset,
      ip: filterIp || undefined,
      action: filterAction || undefined,
      status: filterStatus !== 'all' ? filterStatus : undefined,
    });
  }

  const successCount = logs.filter(l => l.status === 'success').length;
  const failedCount = logs.filter(l => l.status === 'failed').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* Header avec statistiques */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Logs d'accès
              </h1>
              <p className="text-slate-600 text-sm mt-1">
                Surveillance en temps réel des activités système
              </p>
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 font-medium">Total</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{total ?? '-'}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 font-medium">Succès</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{successCount}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 font-medium">Échecs</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{failedCount}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Barre de filtres */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-6 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-medium transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span>Filtres avancés</span>
              <span className="text-xs text-slate-500">
                {showFilters ? '▼' : '▶'}
              </span>
            </button>
          </div>

          {showFilters && (
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                    Adresse IP
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="192.168.1.10"
                      value={filterIp}
                      onChange={(e) => setFilterIp(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                    Action
                  </label>
                  <input
                    type="text"
                    placeholder="login_attempt"
                    value={filterAction}
                    onChange={(e) => setFilterAction(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                    Statut
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none bg-white"
                  >
                    <option value="all">Tous les statuts</option>
                    <option value="success">✓ Succès</option>
                    <option value="failed">✗ Échec</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={applyFilters}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5"
                  >
                    Appliquer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Message d'erreur */}
        {errorMsg && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Erreur</p>
              <p className="text-sm text-red-700 mt-1">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Tableau des logs */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-slate-600 mt-4">Chargement des logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">Aucun log trouvé</p>
              <p className="text-sm text-slate-500 mt-1">Essayez de modifier vos filtres</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">IP</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">User ID</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Ressource</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">User Agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => {
                    const isBruteforceLike = log.action === 'login_attempt' && log.status === 'failed';

                    return (
                      <tr
                        key={log.id}
                        className={`transition-colors ${
                          isBruteforceLike 
                            ? 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500' 
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                          {log.created_at
                            ? new Date(log.created_at).toLocaleString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-slate-700">
                          {log.ip_address || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {log.status === 'failed' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                              <XCircle className="w-3 h-3" />
                              Échec
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                              <CheckCircle className="w-3 h-3" />
                              Succès
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 font-mono">
                          {log.user_id || '-'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate">
                          {log.resource || '-'}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-500 max-w-xs truncate">
                          {log.user_agent || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={prevPage}
            disabled={offset === 0 || loading}
            className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
              offset === 0 || loading
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:shadow-md'
            }`}
          >
            ← Précédent
          </button>

          <div className="text-sm font-medium text-slate-700 bg-white px-4 py-2 rounded-lg border border-slate-200">
            Page {Math.floor(offset / PAGE_SIZE) + 1}
            {total !== null && ` sur ${Math.max(1, Math.ceil(total / PAGE_SIZE))}`}
          </div>

          <button
            onClick={nextPage}
            disabled={loading || (total !== null && offset + PAGE_SIZE >= total)}
            className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
              loading || (total !== null && offset + PAGE_SIZE >= total)
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:shadow-md'
            }`}
          >
            Suivant →
          </button>
        </div>
      </div>
    </div>
  );
}