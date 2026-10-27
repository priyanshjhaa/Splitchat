export type Message = {
  id: number; // index in the chat
  timestamp: string; // ISO
  sender: string;
  text: string;
};

export type Expense = {
  id: string;
  payer: string; // must match a participant name
  amountPaise: number; // integer; ₹1 = 100 paise
  description: string;
  category: "food" | "travel" | "stay" | "activities" | "shopping" | "other";
  splitAmong: string[]; // participant names; all participants if the chat says "everyone"
  sourceMessageIds: number[];
  confidence: "high" | "medium" | "low";
};

export type Transfer = { from: string; to: string; amountPaise: number };
