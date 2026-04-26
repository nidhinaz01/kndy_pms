export function getWorkDisplayCode(item: any): string {
  const planning = item?.prdn_work_planning || item || {};
  const nonStandardCode =
    planning?.other_work_code ||
    item?.other_work_code ||
    planning?.workAdditionData?.other_work_code ||
    item?.workAdditionData?.other_work_code ||
    null;

  if (nonStandardCode) return String(nonStandardCode);

  const standardCode =
    planning?.derived_sw_code ||
    planning?.std_work_type_details?.derived_sw_code ||
    item?.derived_sw_code ||
    item?.std_work_type_details?.derived_sw_code ||
    null;

  return standardCode ? String(standardCode) : '';
}

export function getWorkDisplayName(item: any): string {
  const planning = item?.prdn_work_planning || item || {};
  const nonStandardCode = getWorkDisplayCode({
    ...item,
    ...planning,
    other_work_code: planning?.other_work_code || item?.other_work_code
  });
  const isNonStandard = Boolean(planning?.other_work_code || item?.other_work_code);

  if (isNonStandard) {
    const nonStandardName =
      planning?.workAdditionData?.other_work_desc ||
      item?.workAdditionData?.other_work_desc ||
      planning?.other_work_desc ||
      item?.other_work_desc ||
      '';
    return String(nonStandardName || nonStandardCode || '').trim();
  }

  const swName =
    planning?.std_work_type_details?.std_work_details?.sw_name ||
    item?.std_work_type_details?.std_work_details?.sw_name ||
    planning?.sw_name ||
    item?.sw_name ||
    '';
  const typeDescription =
    planning?.std_work_type_details?.type_description ||
    item?.std_work_type_details?.type_description ||
    '';
  const name = String(swName || '').trim();
  const type = String(typeDescription || '').trim();
  return name + (type ? (name ? ' - ' : '') + type : '');
}
