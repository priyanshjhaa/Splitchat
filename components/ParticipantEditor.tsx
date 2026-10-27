"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";

type Props = {
  people: string[];
  canRemove: (person: string) => boolean;
  onRename: (from: string, to: string) => void;
  onAdd: (name: string) => void;
  onRemove: (person: string) => void;
};

export function ParticipantEditor({
  people,
  canRemove,
  onRename,
  onAdd,
  onRemove,
}: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newName, setNewName] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Select the old name so typing replaces it.
    if (editing) renameRef.current?.select();
  }, [editing]);

  function commitRename() {
    const to = draft.trim();
    if (editing && to && to !== editing) onRename(editing, to);
    setEditing(null);
  }

  function commitAdd() {
    const name = newName.trim();
    if (name && !people.includes(name)) onAdd(name);
    setNewName("");
  }

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">People on this trip</h2>
      <p className="text-sm text-muted-foreground">
        Tap a name to rename. Rename to an existing name to merge them (e.g. a
        phone number into &quot;Rahul&quot;).
      </p>

      <ul className="mt-4 flex flex-wrap gap-2">
        {people.map((person) => (
          <li
            key={person}
            className="flex items-center gap-1.5 rounded-full border bg-background py-1 pr-1 pl-1 text-sm"
          >
            <Avatar name={person} size="sm" />
            {editing === person ? (
              <input
                ref={renameRef}
                list="people-names"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitRename}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitRename();
                  if (event.key === "Escape") setEditing(null);
                }}
                className="w-32 bg-transparent font-medium outline-none"
                aria-label={`Rename ${person}`}
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditing(person);
                  setDraft(person);
                }}
                className="font-medium hover:text-primary"
              >
                {person}
              </button>
            )}
            <button
              type="button"
              onClick={() => onRemove(person)}
              disabled={!canRemove(person)}
              title={
                canRemove(person)
                  ? `Remove ${person}`
                  : `${person} paid for something; change those rows first`
              }
              className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
              aria-label={`Remove ${person}`}
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <datalist id="people-names">
        {people.map((person) => (
          <option key={person} value={person} />
        ))}
      </datalist>

      <div className="mt-4 flex gap-2">
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitAdd();
          }}
          placeholder="Add someone who never texted"
          className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-3 focus:ring-primary/20"
        />
        <Button variant="outline" className="h-9" onClick={commitAdd} disabled={!newName.trim()}>
          <Plus />
          Add
        </Button>
      </div>
    </div>
  );
}
