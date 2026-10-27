import { Sparkles } from "lucide-react";

const BUBBLES: { sender: string; text: string; mine?: boolean }[] = [
  { sender: "Rahul", text: "bhai maine petrol ka 2k diya 🚗" },
  { sender: "Priya", text: "cab 600, me + Aman + Rahul", mine: true },
  { sender: "Aman", text: "wait it was 650 not 600 😅" },
  { sender: "Sneha", text: "who paid for the shack dinner??" },
];

const LINES = [
  ["Aman", "Rahul", "₹3,535"],
  ["Priya", "Rahul", "₹2,060"],
  ["Sneha", "Rahul", "₹1,335"],
];

/** Looping, CSS-only demo: chat chaos turns into a settle-up receipt. */
export function HeroDemo() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-sm select-none">
      <div className="float glass relative rounded-[2rem] p-4">
        <div className="flex items-center gap-2 border-b border-black/5 pb-3">
          <span className="size-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600" />
          <div>
            <p className="text-sm font-semibold">Goa Trip 🏖️</p>
            <p className="text-[11px] text-muted-foreground">
              Rahul, Priya, Aman, Sneha, Karan
            </p>
          </div>
        </div>

        <ul className="demo-chat mt-3 h-52 space-y-2">
          {BUBBLES.map((bubble, index) => (
            <li
              key={bubble.text}
              style={{ "--i": index } as React.CSSProperties}
              className={`demo-bubble flex ${bubble.mine ? "justify-end" : ""}`}
            >
              <span
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] shadow-sm ${
                  bubble.mine
                    ? "rounded-tr-sm bg-emerald-100 text-emerald-950"
                    : "rounded-tl-sm bg-white text-zinc-800"
                }`}
              >
                <span className="block text-[10px] font-semibold text-emerald-700">
                  {bubble.sender}
                </span>
                {bubble.text}
              </span>
            </li>
          ))}
        </ul>

        <div className="demo-receipt absolute inset-x-6 bottom-6">
          <div className="receipt-edge rounded-t-2xl bg-white px-4 pt-4 pb-6 shadow-2xl ring-1 ring-black/5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-widest text-emerald-700 uppercase">
              <Sparkles className="size-3" /> Settled by SplitChat
            </p>
            <ul className="mt-2 space-y-1.5 font-mono text-[12px] text-zinc-700">
              {LINES.map(([from, to, amount]) => (
                <li key={from} className="flex justify-between gap-2">
                  <span>
                    {from} → {to}
                  </span>
                  <span className="font-semibold text-zinc-900">{amount}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-dashed border-zinc-300 pt-2 font-mono text-[12px]">
              <span className="text-zinc-500">TOTAL</span>
              <span className="font-semibold text-zinc-900">₹25,450</span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -top-4 -right-3 rotate-6 rounded-full bg-zinc-900 px-3 py-1 text-[11px] font-medium text-white shadow-lg">
        200 messages → 3 payments
      </div>
    </div>
  );
}
