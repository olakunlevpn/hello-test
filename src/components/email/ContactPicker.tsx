"use client";

import { useState, useCallback, useRef } from "react";
import {
  Input,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Avatar,
  Text,
  Tag,
  TagGroup,
} from "@fluentui/react-components";
import { Dismiss12Regular } from "@fluentui/react-icons";
import type { Person } from "@/types/contacts";
import type { EmailRecipient } from "@/types/mail";

interface ContactPickerProps {
  label: string;
  recipients: EmailRecipient[];
  onRecipientsChange: (recipients: EmailRecipient[]) => void;
  accountId: string;
}

export default function ContactPicker({
  label,
  recipients,
  onRecipientsChange,
  accountId,
}: ContactPickerProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Person[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchPeople = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const res = await fetch(
          `/api/contacts/search?accountId=${accountId}&q=${encodeURIComponent(searchQuery)}`
        );
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.value || []);
          setOpen(true);
        }
      } catch {
        setSuggestions([]);
      }
    },
    [accountId]
  );

  const addRecipient = (person: Person) => {
    const email = person.scoredEmailAddresses?.[0]?.address || "";
    if (!email) return;

    const exists = recipients.some((r) => r.emailAddress.address === email);
    if (exists) return;

    onRecipientsChange([
      ...recipients,
      { emailAddress: { name: person.displayName, address: email } },
    ]);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
  };

  const addManualRecipient = () => {
    if (!query.includes("@")) return;

    const exists = recipients.some((r) => r.emailAddress.address === query);
    if (exists) return;

    onRecipientsChange([
      ...recipients,
      { emailAddress: { name: query, address: query } },
    ]);
    setQuery("");
  };

  const removeRecipient = (address: string) => {
    onRecipientsChange(recipients.filter((r) => r.emailAddress.address !== address));
  };

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <Text size={200} style={{ width: 40, paddingTop: 8, flexShrink: 0 }}>
        {label}
      </Text>
      <div style={{ flex: 1 }}>
        {recipients.length > 0 && (
          <TagGroup
            dismissible
            onDismiss={(_, data) => removeRecipient(data.value as string)}
            style={{ marginBottom: 4, flexWrap: "wrap" }}
          >
            {recipients.map((r) => (
              <Tag
                key={r.emailAddress.address}
                value={r.emailAddress.address}
                dismissible
                dismissIcon={<Dismiss12Regular />}
                size="small"
              >
                {r.emailAddress.name || r.emailAddress.address}
              </Tag>
            ))}
          </TagGroup>
        )}

        <Popover
          open={open && suggestions.length > 0}
          onOpenChange={(_, data) => setOpen(data.open)}
        >
          <PopoverTrigger>
            <Input
              value={query}
              onChange={(_, data) => {
                setQuery(data.value);
                if (debounceRef.current) clearTimeout(debounceRef.current);
                debounceRef.current = setTimeout(() => {
                  searchPeople(data.value);
                }, 300);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addManualRecipient();
                }
              }}
              style={{ width: "100%" }}
              size="small"
            />
          </PopoverTrigger>
          <PopoverSurface style={{ padding: 0, maxHeight: 200, overflow: "auto" }}>
            {suggestions.map((person) => (
              <div
                key={person.id}
                onClick={() => addRecipient(person)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  cursor: "pointer",
                }}
              >
                <Avatar name={person.displayName} size={24} color="colorful" />
                <div>
                  <Text size={200} weight="semibold" block>
                    {person.displayName}
                  </Text>
                  <Text size={100}>{person.scoredEmailAddresses?.[0]?.address}</Text>
                </div>
              </div>
            ))}
          </PopoverSurface>
        </Popover>
      </div>
    </div>
  );
}
