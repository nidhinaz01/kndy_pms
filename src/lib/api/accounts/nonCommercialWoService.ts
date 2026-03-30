import { supabase } from '$lib/supabaseClient';

/**
 * Accounts → `prdn_wo_details` (non-commercial rows: `nc_category` IS NOT NULL).
 *
 * UI field              → DB column
 * --------------------- → ------------
 * Non-commercial category → nc_category
 * WO number             → wo_no
 * Production/commercial WO no → pwo_no
 * Date WO placed        → wo_date
 * Customer name         → customer_name
 * Type                  → wo_type
 * Model                 → wo_model
 * Comments              → comments
 */

const NC_WO_TYPE_DE_NAME = 'Non Commercial WO Type';

/** Text placeholder for required varchar columns on non-commercial WOs. */
export const NC_PLACEHOLDER_TEXT = 'NA';

export async function fetchNonCommercialNcCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('sys_data_elements')
    .select('de_value')
    .eq('de_name', NC_WO_TYPE_DE_NAME)
    .eq('is_deleted', false)
    .eq('is_active', true);

  if (error) throw error;
  const values = [...new Set((data ?? []).map((r) => r.de_value).filter(Boolean))] as string[];
  return values.sort((a, b) => a.localeCompare(b));
}

/** Rows for Accounts list: NC work orders whose category is in sys_data_elements (Non Commercial WO Type). */
export interface NonCommercialWoListRow {
  id: number;
  nc_category: string | null;
  wo_no: string | null;
  pwo_no: string | null;
  wo_date: string | null;
  customer_name: string | null;
  wo_type: string | null;
  wo_model: string | null;
  comments: string | null;
}

/**
 * Loads `prdn_wo_details` for non-commercial WOs: `nc_category` not null and in allowed NC types.
 * Pass `allowedCategories` from a prior `fetchNonCommercialNcCategories()` to avoid a duplicate query.
 */
export async function fetchNonCommercialWoList(allowedCategories?: string[]): Promise<NonCommercialWoListRow[]> {
  const categories =
    allowedCategories !== undefined ? allowedCategories : await fetchNonCommercialNcCategories();
  if (categories.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('prdn_wo_details')
    .select(
      'id, nc_category, wo_no, pwo_no, wo_date, customer_name, wo_type, wo_model, comments'
    )
    .not('nc_category', 'is', null)
    .in('nc_category', categories)
    .order('id', { ascending: false });

  if (error) throw error;
  return (data ?? []) as NonCommercialWoListRow[];
}

export async function fetchDistinctWoTypeCodes(): Promise<string[]> {
  const { data, error } = await supabase
    .from('mstr_wo_type')
    .select('wo_type_code')
    .eq('is_active', true);

  if (error) throw error;
  const values = [...new Set((data ?? []).map((r) => r.wo_type_code).filter((v): v is string => !!v?.trim()))];
  return values.sort((a, b) => a.localeCompare(b));
}

export async function fetchDistinctWoTypeNames(): Promise<string[]> {
  const { data, error } = await supabase
    .from('mstr_wo_type')
    .select('wo_type_name')
    .eq('is_active', true);

  if (error) throw error;
  const values = [...new Set((data ?? []).map((r) => r.wo_type_name).filter((v): v is string => !!v?.trim()))];
  return values.sort((a, b) => a.localeCompare(b));
}

/** Remove all whitespace from WO number (DB / business rule). */
export function normalizeNcWoNo(raw: string): string {
  return raw.replace(/\s/g, '');
}

export interface CreateNonCommercialWoInput {
  wo_no: string;
  pwo_no: string | null;
  customer_name: string;
  wo_date: string;
  nc_category: string;
  wo_type: string | null;
  wo_model: string | null;
  comments: string | null;
}

const Z = NC_PLACEHOLDER_TEXT;

function buildNcPrdnWoDetailsInsert(input: {
  wo_no: string;
  pwo_no: string | null;
  customer_name: string;
  wo_date: string;
  nc_category: string;
  wo_type: string | null;
  wo_model: string | null;
  comments: string | null;
}) {
  return {
    wo_no: input.wo_no,
    pwo_no: input.pwo_no,
    wo_type: input.wo_type,
    wo_model: input.wo_model,
    customer_name: input.customer_name,
    wo_date: input.wo_date,
    nc_category: input.nc_category,
    comments: input.comments,
    wo_chassis: Z,
    wheel_base: Z,
    model_rate: 0,
    body_width_mm: Z,
    height: Z,
    air_ventilation_nos: Z,
    escape_hatch: Z,
    front: Z,
    rear: Z,
    front_glass: Z,
    emergency_door_nos: Z,
    platform: Z,
    inside_grab_rails: Z,
    seat_type: Z,
    no_of_seats: Z,
    seat_configuration: Z,
    dickey: Z,
    passenger_door_nos: Z,
    side_ventilation: Z,
    door_position_front: Z,
    door_position_rear: Z,
    inside_top_panel: Z,
    inside_side_panel: Z,
    inside_luggage_rack: Z,
    sound_system: Z,
    paint: Z,
    fire_extinguisher_kg: Z,
    wiper: Z,
    stepney: Z,
    record_box_nos: Z,
    route_board: Z,
    seat_fabrics: Z,
    rear_glass: Z,
    driver_cabin_partition: Z,
    voltage: Z,
    work_order_cost: 0,
    gst: 0,
    cess: 0,
    total_cost: 0
  };
}

/**
 * Inserts a non-commercial work order into `prdn_wo_details`.
 * Commercial rows keep `nc_category` NULL; NC rows set `nc_category` and use `NA` / 0 for unused fields.
 */
export async function createNonCommercialWo(input: CreateNonCommercialWoInput): Promise<{ id: number }> {
  const wo_no = normalizeNcWoNo(input.wo_no);
  if (!wo_no) {
    throw new Error('WO number is required.');
  }

  const pwo_no =
    input.pwo_no && input.pwo_no.trim() !== '' ? input.pwo_no.trim().slice(0, 10) : null;
  const wo_type = input.wo_type?.trim() ? input.wo_type.trim() : null;
  const wo_model = input.wo_model?.trim() ? input.wo_model.trim() : null;
  const comments = input.comments?.trim() ? input.comments.trim() : null;

  const row = buildNcPrdnWoDetailsInsert({
    wo_no,
    pwo_no,
    customer_name: input.customer_name.trim(),
    wo_date: input.wo_date,
    nc_category: input.nc_category.trim(),
    wo_type,
    wo_model,
    comments
  });

  const { data, error } = await supabase.from('prdn_wo_details').insert(row).select('id').single();

  if (error) throw error;
  return { id: data.id as number };
}
