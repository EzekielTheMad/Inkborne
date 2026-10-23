/** The finite reference/choice vocabulary used by the public 2014 API. */
export interface ApiReference { index: string; name: string; url?: string }
export interface ApiChoice {
  choose: number;
  desc?: string;
  type?: string;
  from: { option_set_type?: string; options?: ApiOption[]; equipment_category?: ApiReference };
}
export interface ApiOption {
  option_type?: string;
  item?: ApiReference;
  of?: ApiReference;
  count?: number;
  items?: ApiOption[];
  choice?: ApiChoice;
}

/** Nested choose-one alternatives (Monk tools OR instruments) are one union.
 * Bundled/count-changing proficiency choices are rejected, never flattened.
 */
export function referenceOptions(choice: ApiChoice): ApiReference[] {
  const refs = (choice.from.options ?? []).flatMap(option => {
    if (option.item) return [option.item];
    if (option.choice?.choose === 1) return referenceOptions(option.choice);
    throw new Error("Unsupported SRD reference-choice option.");
  });
  const unique = [...new Map(refs.map(ref => [ref.index, ref])).values()];
  if (!Number.isInteger(choice.choose) || choice.choose < 1 || unique.length < choice.choose) throw new Error("Incomplete SRD reference choice.");
  return unique;
}

const EQUIPMENT_CATEGORIES: Record<string, string> = {
  "simple-weapons": "simple weapon", "simple-melee-weapons": "simple melee weapon",
  "martial-weapons": "martial weapon", "martial-melee-weapons": "martial melee weapon",
  "musical-instruments": "musical instrument", "holy-symbols": "holy symbol",
  "arcane-foci": "arcane focus", "druidic-foci": "druidic focus",
};

/** Avoid commas inside catalog names: the shipped equipment grammar uses them
 * as bundle delimiters (Crossbow, light => light crossbow).
 */
function equipmentName(name: string): string {
  const [head, ...tail] = name.split(", ");
  return tail.length ? `${tail.join(" ")} ${head}` : name;
}
function counted(name: string, count = 1): string {
  if (!Number.isInteger(count) || count < 1) throw new Error("Invalid SRD equipment quantity.");
  return `${count} ${equipmentName(name)}`;
}
function renderEquipmentOption(option: ApiOption): string {
  if (option.of) return counted(option.of.name, option.count);
  if (option.item) return counted(option.item.name);
  if (option.items?.length) return option.items.map(renderEquipmentOption).join(" and ");
  if (option.choice) return renderEquipmentChoice(option.choice);
  throw new Error("Unsupported SRD equipment option.");
}
export function renderEquipmentChoice(choice: ApiChoice): string {
  const category = choice.from.equipment_category;
  if (category) {
    const label = EQUIPMENT_CATEGORIES[category.index];
    if (!label || !Number.isInteger(choice.choose) || choice.choose < 1) throw new Error(`Unsupported SRD equipment category: ${category.index}`);
    return `${choice.choose} ${label}`;
  }
  if (choice.choose !== 1 || !choice.from.options?.length) throw new Error("Unsupported SRD equipment choice cardinality.");
  return choice.from.options.map(renderEquipmentOption).join(" or ");
}
export function startingEquipmentText(
  fixed: Array<{ equipment: ApiReference; quantity: number }>, choices: ApiChoice[], separator = "; ",
): string {
  return [...choices.map(renderEquipmentChoice), ...fixed.map(item => counted(item.equipment.name, item.quantity))].join(separator);
}
