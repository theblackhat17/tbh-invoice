import fs from 'fs';
import path from 'path';

import 'server-only';

const DB_PATH = path.join(process.cwd(), 'data');
const CLIENTS_FILE = path.join(DB_PATH, 'clients.json');
const FACTURES_FILE = path.join(DB_PATH, 'factures.json');

// Interface types
export interface Client {
  id: string;
  nom: string;
  adresse: string;
  email?: string;
  telephone?: string;
  siret?: string;
  createdAt: string;
}

export interface Prestation {
  id: string;
  description: string;
  quantite: number;
  prixUnit: number;
}

export interface Facture {
  id: string;
  numero: string;
  date: string;
  typeDocument: string;
  clientId: string;
  prestations: Prestation[];
  totalHT: number;
  createdAt: string;
}

// Initialiser les fichiers de données
function initDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(DB_PATH, { recursive: true });
  }
  if (!fs.existsSync(CLIENTS_FILE)) {
    fs.writeFileSync(CLIENTS_FILE, JSON.stringify([]), 'utf-8');
  }
  if (!fs.existsSync(FACTURES_FILE)) {
    fs.writeFileSync(FACTURES_FILE, JSON.stringify([]), 'utf-8');
  }
}

// Générer un ID unique
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// === CLIENTS ===

export function getAllClients(): Client[] {
  initDB();
  const data = fs.readFileSync(CLIENTS_FILE, 'utf-8');
  return JSON.parse(data);
}

export function getClientById(id: string): Client | null {
  const clients = getAllClients();
  return clients.find(c => c.id === id) || null;
}

export function createClient(data: Omit<Client, 'id' | 'createdAt'>): Client {
  initDB();
  const clients = getAllClients();
  const newClient: Client = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  clients.push(newClient);
  fs.writeFileSync(CLIENTS_FILE, JSON.stringify(clients, null, 2), 'utf-8');
  return newClient;
}

export function deleteClient(id: string): boolean {
  initDB();
  const clients = getAllClients();
  const filteredClients = clients.filter(c => c.id !== id);
  if (filteredClients.length === clients.length) return false;
  fs.writeFileSync(CLIENTS_FILE, JSON.stringify(filteredClients, null, 2), 'utf-8');
  return true;
}

// === FACTURES ===

export function getAllFactures(): Facture[] {
  initDB();
  const data = fs.readFileSync(FACTURES_FILE, 'utf-8');
  return JSON.parse(data);
}

export function getFactureById(id: string): Facture | null {
  const factures = getAllFactures();
  return factures.find(f => f.id === id) || null;
}

// Générer le prochain numéro de facture (2025-10-001)
export function genererNumeroFacture(): string {
  const maintenant = new Date();
  const annee = maintenant.getFullYear();
  const mois = String(maintenant.getMonth() + 1).padStart(2, '0');
  const prefixe = `${annee}-${mois}`;

  const factures = getAllFactures();
  const facturesDuMois = factures.filter(f => f.numero.startsWith(prefixe));

  let nouveauNumero = 1;
  if (facturesDuMois.length > 0) {
    const dernierNumero = Math.max(
      ...facturesDuMois.map(f => parseInt(f.numero.split('-')[2]))
    );
    nouveauNumero = dernierNumero + 1;
  }

  return `${prefixe}-${String(nouveauNumero).padStart(3, '0')}`;
}

export function createFacture(data: Omit<Facture, 'id' | 'numero' | 'createdAt'>): Facture {
  initDB();
  const factures = getAllFactures();
  
  // Ajouter des IDs aux prestations
  const prestationsAvecId = data.prestations.map(p => ({
    ...p,
    id: generateId()
  }));
  
  const newFacture: Facture = {
    ...data,
    prestations: prestationsAvecId,
    id: generateId(),
    numero: genererNumeroFacture(),
    createdAt: new Date().toISOString(),
  };
  factures.push(newFacture);
  fs.writeFileSync(FACTURES_FILE, JSON.stringify(factures, null, 2), 'utf-8');
  return newFacture;
}

export function deleteFacture(id: string): boolean {
  initDB();
  const factures = getAllFactures();
  const filteredFactures = factures.filter(f => f.id !== id);
  if (filteredFactures.length === factures.length) return false;
  fs.writeFileSync(FACTURES_FILE, JSON.stringify(filteredFactures, null, 2), 'utf-8');
  return true;
}
