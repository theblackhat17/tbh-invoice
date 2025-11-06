// lib/logger.ts

type LogAction =
  // Auth & Sessions
  | 'login_attempt'
  | 'login_success'
  | 'logout'
  | 'session_expired'
  | 'password_reset_request'
  | 'password_reset_success'
  | 'password_change'
  | 'account_locked'
  // Factures
  | 'invoice_generated'
  | 'invoice_viewed'
  | 'invoice_downloaded'
  | 'invoice_deleted'
  | 'invoice_sent_email'
  | 'invoice_updated'
  // Utilisateurs
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'role_changed'
  // Actions sensibles
  | 'export_data'
  | 'bulk_delete'
  | 'settings_changed'
  | 'api_key_generated'
  | 'unauthorized_access_attempt'
  | 'suspicious_activity';

type LogParams = {
  action: LogAction;
  resource: string;
  status?: 'success' | 'failed';
  userId?: string | null;
};

/**
 * Logger une action dans la base de données
 * Échoue silencieusement pour ne pas bloquer l'action principale
 */
export async function logAction(params: LogParams) {
  try {
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch (err) {
    // Fail silently - ne pas bloquer l'action si le log échoue
    console.error('Erreur logging:', err);
  }
}