import type { TicketExtract } from './api/complaintsService';
export const TICKET_FIELDS = [
  ['origin', 'Starting stop', 'text'], ['destination', 'Destination stop', 'text'],
  ['bus_number', 'Bus registration / fleet number', 'text'], ['travel_date', 'Travel date', 'date'],
  ['travel_time', 'Travel time', 'time'], ['via', 'Via / corridor', 'text'],
  ['landmark', 'Boarding stop / landmark', 'text'], ['seat_number', 'Seat number', 'text'],
  ['ticket_no', 'Ticket number', 'text'], ['pnr', 'PNR / booking reference', 'text'],
  ['depot', 'Printed depot', 'text'], ['service_type', 'Service type', 'text'],
  ['trip_code', 'Trip code', 'text'], ['depot_phone', 'Depot phone', 'text'],
] as const;
export type TicketField = typeof TICKET_FIELDS[number][0];
export type JourneyValues = Record<TicketField, string>;
export function journeyFromTicket(ticket: Partial<TicketExtract> | null | undefined): JourneyValues {
  return Object.fromEntries(TICKET_FIELDS.map(([key]) => {
    const value = ticket?.[key];
    return [key, typeof value === 'string' && value !== 'null' ? value.trim() : ''];
  })) as JourneyValues;
}
export function editedTicket(values: JourneyValues, original: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!original) return null;
  return { ...original, ...Object.fromEntries(TICKET_FIELDS.map(([key]) => [key, values[key].trim() || null])) };
}
