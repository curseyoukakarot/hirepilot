import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../../../lib/api';
import {
  CostLine,
  CostStatus,
  DocumentType,
  EventDoc,
  EventKind,
  EventListItem,
  EventRecord,
  EventStatus,
  EventSummary,
  Sponsor,
  SponsorKind,
  SponsorStatus,
} from './types';

function asString(value: any, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function asNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nullableString(value: any): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function nullableNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeKind(value: any): EventKind {
  return String(value || 'internal').toLowerCase() === 'external' ? 'external' : 'internal';
}

function normalizeStatus(value: any): EventStatus {
  const s = String(value || 'draft').toLowerCase();
  return (['draft', 'planning', 'live', 'closed'] as EventStatus[]).includes(s as EventStatus)
    ? (s as EventStatus)
    : 'draft';
}

function normalizeSponsorKind(value: any): SponsorKind {
  return String(value || 'cash').toLowerCase() === 'in_kind' ? 'in_kind' : 'cash';
}

function normalizeSponsorStatus(value: any): SponsorStatus {
  const s = String(value || 'prospect').toLowerCase();
  return (['prospect', 'committed', 'invoiced', 'paid'] as SponsorStatus[]).includes(s as SponsorStatus)
    ? (s as SponsorStatus)
    : 'prospect';
}

function normalizeCostStatus(value: any): CostStatus {
  const s = String(value || 'budgeted').toLowerCase();
  return (['budgeted', 'committed', 'invoiced', 'paid'] as CostStatus[]).includes(s as CostStatus)
    ? (s as CostStatus)
    : 'budgeted';
}

function normalizeDocType(value: any): DocumentType {
  const s = String(value || 'misc').toLowerCase();
  return (['beo', 'invoice', 'contract', 'quote', 'misc'] as DocumentType[]).includes(s as DocumentType)
    ? (s as DocumentType)
    : 'misc';
}

function normalizeSponsor(row: any): Sponsor {
  return {
    id: asString(row?.id),
    name: asString(row?.name),
    kind: normalizeSponsorKind(row?.kind),
    amount: asNumber(row?.amount, 0),
    status: normalizeSponsorStatus(row?.status),
    contact: row?.contact ?? null,
    notes: row?.notes ?? null,
    referralOwner: row?.referral_owner ?? null,
    referralPercent: row?.referral_percent != null ? asNumber(row.referral_percent) : null,
  };
}

function normalizeCost(row: any): CostLine {
  return {
    id: asString(row?.id),
    category: asString(row?.category, 'Other'),
    description: asString(row?.description),
    vendor: row?.vendor ?? null,
    qty: asNumber(row?.qty, 1),
    unitCost: asNumber(row?.unit_cost, 0),
    status: normalizeCostStatus(row?.status),
    notes: row?.notes ?? null,
  };
}

function normalizeDocument(row: any): EventDoc {
  const createdAt = row?.created_at ? String(row.created_at).slice(0, 10) : '';
  return {
    id: asString(row?.id),
    name: asString(row?.name),
    type: normalizeDocType(row?.doc_type),
    uploadedAt: createdAt,
    uploadedBy: asString(row?.uploaded_by_name) || 'Team',
    fileUrl: row?.file_url ?? null,
  };
}

function normalizeTotals(totals: any): EventSummary {
  return {
    cashRevenue: asNumber(totals?.cash_revenue, 0),
    inKindValue: asNumber(totals?.in_kind_value, 0),
    totalCosts: asNumber(totals?.total_costs, 0),
    margin: asNumber(totals?.margin, 0),
    marginPct: asNumber(totals?.margin_pct, 0),
    sponsorCount: Math.max(0, Math.floor(asNumber(totals?.sponsor_count, 0))),
    costLineCount: Math.max(0, Math.floor(asNumber(totals?.cost_line_count, 0))),
  };
}

function normalizeListItem(row: any): EventListItem {
  return {
    id: asString(row?.id),
    name: asString(row?.name) || 'Untitled Event',
    kind: normalizeKind(row?.kind),
    status: normalizeStatus(row?.status),
    clientId: row?.client_id ?? null,
    clientName: row?.client_name_override ?? null,
    startDate: asString(row?.start_date),
    endDate: row?.end_date ?? null,
    city: asString(row?.city),
    venue: asString(row?.venue),
    headcount: Math.max(0, Math.floor(asNumber(row?.headcount, 0))),
    primaryContact: asString(row?.primary_contact),
    ownerName: asString(row?.owner_name),
    description: row?.description ?? null,
    targetMarginPct: asNumber(row?.target_margin_pct, 20),
    totals: normalizeTotals(row?.totals),
  };
}

function normalizeEventRecord(bundle: any): EventRecord {
  const event = bundle?.event || {};
  const sponsors = Array.isArray(bundle?.sponsors) ? bundle.sponsors.map(normalizeSponsor) : [];
  const costs = Array.isArray(bundle?.costs) ? bundle.costs.map(normalizeCost) : [];
  const documents = Array.isArray(bundle?.documents) ? bundle.documents.map(normalizeDocument) : [];
  return {
    id: asString(event.id),
    name: asString(event.name) || 'Untitled Event',
    kind: normalizeKind(event.kind),
    status: normalizeStatus(event.status),
    clientId: event.client_id ?? null,
    clientName: event.client_name_override ?? null,
    startDate: asString(event.start_date),
    endDate: event.end_date ?? null,
    city: asString(event.city),
    venue: asString(event.venue),
    headcount: Math.max(0, Math.floor(asNumber(event.headcount, 0))),
    primaryContact: asString(event.primary_contact),
    ownerName: asString(event.owner_name),
    description: event.description ?? null,
    targetMarginPct: asNumber(event.target_margin_pct, 20),
    sponsors,
    costs,
    documents,
  };
}

export type EventBasicsInput = {
  name: string;
  kind: EventKind;
  status?: EventStatus;
  clientId?: string | null;
  clientName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  city?: string | null;
  venue?: string | null;
  headcount?: number | string;
  primaryContact?: string | null;
  ownerName?: string | null;
  description?: string | null;
  targetMarginPct?: number | string;
};

export type SponsorInput = {
  id?: string;
  name: string;
  kind: SponsorKind;
  amount: number | string;
  status: SponsorStatus;
  contact?: string | null;
  notes?: string | null;
  referralOwner?: string | null;
  referralPercent?: number | string | null;
};

export type CostInput = {
  id?: string;
  category: string;
  description: string;
  vendor?: string | null;
  qty: number | string;
  unitCost: number | string;
  status: CostStatus;
  notes?: string | null;
};

function serializeEventBasics(input: EventBasicsInput): Record<string, any> {
  return {
    name: asString(input.name),
    kind: normalizeKind(input.kind),
    status: input.status ? normalizeStatus(input.status) : undefined,
    client_id: nullableString(input.clientId),
    client_name_override: nullableString(input.clientName),
    start_date: nullableString(input.startDate),
    end_date: nullableString(input.endDate),
    city: nullableString(input.city),
    venue: nullableString(input.venue),
    headcount: Math.max(0, Math.floor(asNumber(input.headcount, 0))),
    primary_contact: nullableString(input.primaryContact),
    owner_name: nullableString(input.ownerName),
    description: nullableString(input.description),
    target_margin_pct: asNumber(input.targetMarginPct, 20),
  };
}

function serializeSponsor(input: SponsorInput) {
  return {
    name: asString(input.name),
    kind: normalizeSponsorKind(input.kind),
    amount: asNumber(input.amount, 0),
    status: normalizeSponsorStatus(input.status),
    contact: nullableString(input.contact),
    notes: nullableString(input.notes),
    referral_owner: nullableString(input.referralOwner),
    referral_percent: nullableNumber(input.referralPercent),
  };
}

function serializeCost(input: CostInput) {
  return {
    category: asString(input.category, 'Other'),
    description: asString(input.description),
    vendor: nullableString(input.vendor),
    qty: asNumber(input.qty, 1),
    unit_cost: asNumber(input.unitCost, 0),
    status: normalizeCostStatus(input.status),
    notes: nullableString(input.notes),
  };
}

export async function listEvents(): Promise<EventListItem[]> {
  const response = await apiGet('/api/ignite/events');
  const rows = Array.isArray(response?.events) ? response.events : [];
  return rows.map(normalizeListItem);
}

export async function fetchEvent(eventId: string): Promise<EventRecord> {
  const response = await apiGet(`/api/ignite/events/${eventId}`);
  return normalizeEventRecord(response);
}

export async function createEvent(input: EventBasicsInput): Promise<EventListItem> {
  const response = await apiPost('/api/ignite/events', serializeEventBasics(input));
  const event = response?.event || {};
  return normalizeListItem({ ...event, totals: {} });
}

export async function updateEventBasics(eventId: string, input: Partial<EventBasicsInput>): Promise<void> {
  const payload: Record<string, any> = {};
  if (input.name !== undefined) payload.name = asString(input.name);
  if (input.kind !== undefined) payload.kind = normalizeKind(input.kind);
  if (input.status !== undefined) payload.status = normalizeStatus(input.status);
  if (input.clientId !== undefined) payload.client_id = nullableString(input.clientId);
  if (input.clientName !== undefined) payload.client_name_override = nullableString(input.clientName);
  if (input.startDate !== undefined) payload.start_date = nullableString(input.startDate);
  if (input.endDate !== undefined) payload.end_date = nullableString(input.endDate);
  if (input.city !== undefined) payload.city = nullableString(input.city);
  if (input.venue !== undefined) payload.venue = nullableString(input.venue);
  if (input.headcount !== undefined) payload.headcount = Math.max(0, Math.floor(asNumber(input.headcount, 0)));
  if (input.primaryContact !== undefined) payload.primary_contact = nullableString(input.primaryContact);
  if (input.ownerName !== undefined) payload.owner_name = nullableString(input.ownerName);
  if (input.description !== undefined) payload.description = nullableString(input.description);
  if (input.targetMarginPct !== undefined) payload.target_margin_pct = asNumber(input.targetMarginPct, 20);
  await apiPatch(`/api/ignite/events/${eventId}`, payload);
}

export async function archiveEvent(eventId: string): Promise<void> {
  await apiDelete(`/api/ignite/events/${eventId}`);
}

export async function replaceSponsors(eventId: string, sponsors: SponsorInput[]): Promise<void> {
  await apiPut(`/api/ignite/events/${eventId}/sponsors`, {
    sponsors: sponsors.map(serializeSponsor),
  });
}

export async function replaceCosts(eventId: string, costs: CostInput[]): Promise<void> {
  await apiPut(`/api/ignite/events/${eventId}/costs`, {
    costs: costs.map(serializeCost),
  });
}

export async function addDocument(
  eventId: string,
  doc: { name: string; docType: DocumentType; fileUrl?: string | null; uploadedByName?: string | null }
): Promise<EventDoc> {
  const response = await apiPost(`/api/ignite/events/${eventId}/documents`, {
    name: doc.name,
    doc_type: doc.docType,
    file_url: nullableString(doc.fileUrl),
    uploaded_by_name: nullableString(doc.uploadedByName),
  });
  return normalizeDocument(response?.document || {});
}

export async function deleteDocument(eventId: string, docId: string): Promise<void> {
  await apiDelete(`/api/ignite/events/${eventId}/documents/${docId}`);
}
