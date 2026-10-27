"use client";

import { useEffect, useRef, useState } from "react";
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
    <div className="mt-4">
      <p className="text-sm font-medium">People</p>
      <p className="text-xs text-muted-foreground">
        Tap a name to rename it. Renaming someone to an existing name merges
        them (e.g. a phone number into &quot;Rahul&quot;).
      </p>

      <ul className="mt-3 flex flex-wrap gap-2">
        {people.map((person) => (
          <li
            key={person}
            className="flex items-center gap-1 rounded-full bg-muted py-1 pr-1 pl-3 text-sm"
          >
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
                className="w-32 bg-transparent outline-none"
                aria-label={`Rename ${person}`}
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditing(person);
                  setDraft(person);
                }}
                className="hover:underline"
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
              className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30"
              aria-label={`Remove ${person}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <datalist id="people-names">
        {people.map((person) => (
          <option key={person} value={person} />
        ))}
      </datalist>

      <div className="mt-3 flex gap-2">
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitAdd();
          }}
          placeholder="Add someone who never texted"
          className="h-8 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/50"
        />
        <Button variant="outline" onClick={commitAdd} disabled={!newName.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
