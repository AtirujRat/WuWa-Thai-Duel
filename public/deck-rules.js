export function validateDeck(entries, cards) {
  const map = new Map(cards.map((c) => [c.code, c])),
    errors = [],
    normalized = [];
  if (!entries || typeof entries !== "object" || Array.isArray(entries))
    return {
      valid: false,
      errors: ["รูปแบบเด็คไม่ถูกต้อง"],
      characters: 0,
      actions: 0,
    };
  for (const [code, n] of Object.entries(entries)) {
    const c = map.get(code);
    if (!c || !Number.isInteger(n) || n < 1 || n > 3) {
      errors.push("จำนวนหรือรหัสการ์ดไม่ถูกต้อง: " + code);
      continue;
    }
    if (c.type === "character" && n > 1)
      errors.push(code + " ตัวละครใส่ได้ 1 ใบต่อรหัส");
    normalized.push([c, n]);
  }
  const chars = normalized.filter(([c]) => c.type === "character"),
    actions = normalized.filter(([c]) => c.type === "action");
  const cn = chars.reduce((s, [, n]) => s + n, 0),
    an = actions.reduce((s, [, n]) => s + n, 0),
    names = new Set(chars.map(([c]) => c.character));
  if (cn < 3 || cn > 15) errors.push("เด็คตัวละครต้องมี 3–15 ใบ");
  if (names.size !== 3) errors.push("เลือกตัวละคร 3 ตัว");
  const zero = chars.filter(([c]) => c.level === "0");
  if (zero.length !== 3 || new Set(zero.map(([c]) => c.character)).size !== 3)
    errors.push("ต้องมีตัวละครเลเวล 0 ต่างกัน 3 ตัว");
  if (an !== 40) errors.push("แอ็กชันต้องมี 40 ใบ (ตอนนี้ " + an + " ใบ)");
  for (const [c] of actions)
    if (c.character !== "ใช้ร่วมกัน" && !names.has(c.character))
      errors.push(c.name + " ต้องมี " + c.character + " ในเด็คตัวละคร");
  return { valid: errors.length === 0, errors, characters: cn, actions: an };
}
export function presetDeck(set, cards) {
  const entries = {};
  const chars = cards.filter((c) => c.set === set && c.type === "character");
  for (const c of chars) entries[c.code] = 1;
  const names = new Set(chars.map((c) => c.character));
  for (const c of cards)
    if (c.type === "character" && c.level === "0" && names.has(c.character))
      entries[c.code] = 1;
  const actions = cards.filter((c) => c.set === set && c.type === "action");
  actions.forEach((c, i) => (entries[c.code] = i < 6 ? 3 : 2));
  return { name: set + " · เด็คฝึกเล่น", entries };
}
