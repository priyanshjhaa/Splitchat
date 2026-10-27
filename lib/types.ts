export type Message = {
  id: number; // index in the chat
  timestamp: string; // ISO
  sender: string;
  text: string;
};

export type Category =
  | "food"
  | "travel"
  | "stay"
  | "activities"
  | "shopping"
  | "other";

export type Confidence = "high" | "medium" | "low";

export type Expense = {
  id: string;
  payer: string; // must match a participant name
  amountPaise: number; // integer; ₹1 = 100 paise
  description: string;
  category: Category;
  splitAmong: string[]; // participant names; all participants if the chat says "everyone"
  sourceMessageIds: number[];
  confidence: Confidence;
};

export type Transfer = { from: string; to: string; amountPaise: number };

/** The model's raw output: rupees, and "ALL" is still unmapped. */
export type RawExpense = {
  payer: string;
  amount: number;
  description: string;
  category: Category;
  splitAmong: string[];
  sourceMessageIds: number[];
  replacesMessageId: number | null;
  confidence: Confidence;
};
