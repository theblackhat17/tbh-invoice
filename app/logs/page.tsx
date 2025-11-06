'use client';

import { useEffect, useState } from 'react';

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

  // Filtres
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

  // Premier chargement
  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quand on clique sur "Appliquer les filtres"
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Logs d&apos;accès</h1>
          <p className="text-sm text-gray-500">
            Suivi des actions (login, génération de facture, téléchargements...) et détection de bruteforce.
          </p>
        </div>

        <div className="text-sm text-gray-500">
          {total !== null && (
            <span>
              {total} logs au total • Page {Math.floor(offset / PAGE_SIZE) + 1}
            </span>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Filtres</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">IP</label>
            <input
              type="text"
              placeholder="ex: 192.168.1.10"
              value={filterIp}
              onChange={(e) => setFilterIp(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Action</label>
            <input
              type="text"
              placeholder="ex: login_attempt"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Tous</option>
              <option value="success">success</option>
              <option value="failed">failed</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={applyFilters}
              className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
            >
              Appliquer les filtres
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Tableau */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Chargement des logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">Aucun log pour ces filtres.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">Date</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">IP</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">Action</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">Status</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">User ID</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">Ressource</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">User Agent</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const isBruteforceLike = log.action === 'login_attempt' && log.status === 'failed';

                return (
                  <tr
                    key={log.id}
                    className={isBruteforceLike ? 'bg-red-50' : 'hover:bg-gray-50 transition'}
                  >
                    <td className="px-3 py-2 border-b text-gray-700">
                      {log.created_at
                        ? new Date(log.created_at).toLocaleString('fr-FR')
                        : '-'}
                    </td>
                    <td className="px-3 py-2 border-b text-gray-700">{log.ip_address || '-'}</td>
                    <td className="px-3 py-2 border-b font-mono text-xs text-gray-800">
                      {log.action}
                    </td>
                    <td className="px-3 py-2 border-b">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          log.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {log.status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-3 py-2 border-b text-xs text-gray-600">
                      {log.user_id || '-'}
                    </td>
                    <td className="px-3 py-2 border-b text-xs text-gray-700 max-w-xs truncate">
                      {log.resource || '-'}
                    </td>
                    <td className="px-3 py-2 border-b text-[11px] text-gray-500 max-w-xs truncate">
                      {log.user_agent || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <button
          onClick={prevPage}
          disabled={offset === 0 || loading}
          className={`rounded-md border px-3 py-1.5 ${
            offset === 0 || loading
              ? 'border-gray-200 text-gray-300 cursor-not-allowed'
              : 'border-gray-300 hover:bg-gray-50'
          }`}
        >
          ← Précédent
        </button>

        <div>
          Page {Math.floor(offset / PAGE_SIZE) + 1}
          {total !== null && ` sur ${Math.max(1, Math.ceil(total / PAGE_SIZE))}`}
        </div>

        <button
          onClick={nextPage}
          disabled={loading || (total !== null && offset + PAGE_SIZE >= total)}
          className={`rounded-md border px-3 py-1.5 ${
            loading || (total !== null && offset + PAGE_SIZE >= total)
              ? 'border-gray-200 text-gray-300 cursor-not-allowed'
              : 'border-gray-300 hover:bg-gray-50'
          }`}
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}
