export interface CardVariant {
  id: number;
  img: string;
  rarity: string;
  obtain: string;
  originalImage: string;
}

export type CardType = "character" | "action";
export type CardColor = "แดง" | "เขียว" | "น้ำเงิน" | "—" | string;

export interface Card {
  id: number;
  code: string;
  name: string;
  type_id?: number;
  card_type?: string;
  type_name?: string;
  weapon_type_name?: string;
  force_name?: string;
  attr_name?: string;
  feature_name?: string;
  character_name?: string;
  rarity_name?: string;
  fee: string;
  level: string;
  speed: string;
  damage: string;
  obtain: string;
  img: string;
  info: string;
  color_name?: string;
  nameJp?: string;
  nameEn?: string;
  effectTh?: string;
  translationStatus?: string;
  type: CardType;
  character: string;
  element?: string;
  weapon?: string;
  faction?: string;
  color: CardColor;
  tags?: string[];
  set?: string;
  source?: string;
  variants: CardVariant[];
  originalImage?: string;
  nameTh?: string;
  nameLanguage?: string;
  nameNote?: string;
}

export interface CatalogMeta {
  updatedAt?: string;
  totalCards?: number;
  totalVariants?: number;
  [key: string]: unknown;
}
