export interface TableItem {
  id: string;
  code: string | null;
  zone: "action" | "concerto";
  x: number;
  y: number;
  faceDown: boolean;
}

export interface PlayerFlags {
  damageTaken?: boolean;
  heals?: number;
  encoreBasic?: boolean;
  usedTags?: string[];
  pursuit?: number;
  switchLock?: boolean;
  bonusDamage?: number;
  speedBonus?: number;
  costBonus?: number;
  introDraw?: number;
  peek?: boolean;
  redTaxTurn?: number;
  noComboTurn?: number;
  entered?: Record<string, number>;
  [key: string]: unknown;
}

export interface PlayerUsedActions {
  charge?: boolean;
  level?: boolean;
  switch?: boolean;
  [key: string]: boolean | undefined;
}

export interface Player {
  token: string;
  name: string;
  hp: number;
  energy?: number;
  ready: boolean;
  hand: string[];
  deck: string[];
  field: string[];
  reserve: string[];
  leader: string;
  stacks: Record<string, string[]>;
  table: TableItem[];
  action: string[];
  concerto: string[];
  trash: string[];
  pending: string | null;
  mulligan: boolean;
  revealHand: boolean;
  isBot?: boolean;
  used?: PlayerUsedActions;
  locked?: boolean;
  payment?: string[];
  flags?: PlayerFlags;
  effectsDone?: boolean;
}

export interface PublicPlayer {
  name: string;
  hp: number;
  energy: number;
  isBot: boolean;
  ready: boolean;
  leader: string | null;
  field: string[];
  stacks: Record<string, string[]>;
  used?: PlayerUsedActions;
  locked?: boolean;
  flags?: PlayerFlags;
  table: TableItem[];
  action: string[];
  concerto: string[];
  trash: string[];
  handCount: number;
  deckCount: number;
  reserveCount: number;
  hand: string[];
  reserve: string[];
  pending: boolean | string | null;
  mulligan: boolean;
  revealHand: boolean;
  token?: string;
  deck?: string[];
}

export interface ChoiceOption {
  label: string;
  value: unknown;
  sub?: string;
}

export interface GameChoice {
  id: string;
  type: string;
  seat: number;
  label: string;
  count?: number;
  indices?: number[];
  options?: ChoiceOption[];
  canAnswer?: boolean;
  [key: string]: unknown;
}

export interface DuelResult {
  winner: number | null;
  damage?: number;
  reason?: string;
  human?: string;
  bot?: string;
}

export interface GameLogEntry {
  id?: string;
  turn?: number;
  battle?: boolean;
  source?: string;
  notice?: boolean;
  time: string;
  text: string;
}

export type GamePhase =
  | "waiting"
  | "order"
  | "setup"
  | "start"
  | "draw"
  | "action"
  | "battle"
  | "defense"
  | "reveal"
  | "judgment"
  | "combo"
  | "comboEffects"
  | "end"
  | "result"
  | "finished";

export interface GameRoom {
  rulesVersion?: number;
  code: string;
  mode?: "bot" | "friend" | string;
  difficulty?: "easy" | "normal" | string;
  version: number;
  turn: number;
  active: number;
  status: "waiting" | "playing" | "finished";
  created?: number;
  players: Player[];
  log: GameLogEntry[];
  phase?: GamePhase;
  orderWinner?: number;
  first?: number | null;
  queue?: unknown[];
  choice?: GameChoice | null;
  lastWinner?: number | null;
  ruleNotice?: string;
  setupSeat?: number;
  comboSeat?: number | null;
  comboLeft?: number;
  hadBattle?: boolean;
  previousWinner?: number | null;
  lastDuel?: DuelResult | null;
  duel?: (string | null)[];
  botPhase?: string;
  winner?: number | null;
}

export interface PublicRoom {
  rulesVersion?: number;
  phase?: string;
  previousWinner?: number | null;
  first?: number | null;
  orderWinner?: number;
  setupSeat?: number;
  comboSeat?: number | null;
  comboLeft?: number;
  ruleNotice?: string;
  choice?: GameChoice | null;
  turnOwner?: number;
  canAct?: boolean;
  mode: string;
  difficulty?: string;
  botPhase?: string;
  lastDuel?: DuelResult | null;
  winner?: number | null;
  code: string;
  version: number;
  turn: number;
  active: number;
  status: "waiting" | "playing" | "finished";
  seat: number;
  log: GameLogEntry[];
  players: PublicPlayer[];
}

export interface GameCommand {
  type: string;
  version?: number;
  [key: string]: unknown;
}
