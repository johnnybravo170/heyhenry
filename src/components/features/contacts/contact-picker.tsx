'use client';

/**
 * Searchable customer combobox using shadcn Command + Popover.
 * Filters client-side as you type. Scales to hundreds of contacts.
 */

import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type ContactPickerProps = {
  contacts: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  error?: string;
  /**
   * If provided, "Add new customer" calls this instead of navigating
   * to /contacts/new. Used to open an inline create panel and keep
   * the user in their workflow. Receives the current search text so the
   * create form can pre-fill the name the user just typed.
   */
  onAddNew?: (prefillName?: string) => void;
};

export function ContactPicker({
  contacts,
  value,
  onChange,
  placeholder = 'Pick a customer',
  error,
  onAddNew,
}: ContactPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = contacts.find((c) => c.id === value);

  const handleAddNew = useCallback(() => {
    setOpen(false);
    const prefill = query.trim();
    if (onAddNew) onAddNew(prefill || undefined);
    else window.location.href = '/contacts/new';
  }, [onAddNew, query]);

  const handleSelect = useCallback(
    (id: string) => {
      onChange(id === value ? '' : id);
      setOpen(false);
    },
    [onChange, value],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange('');
    },
    [onChange],
  );

  return (
    <div className="flex flex-col gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full justify-between font-normal',
              !selected && 'text-muted-foreground',
              error && 'border-destructive',
            )}
          >
            <span className="truncate">{selected ? selected.name : placeholder}</span>
            <span className="ml-2 flex shrink-0 items-center gap-1">
              {selected && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={handleClear}
                  className="rounded-sm p-0.5 hover:bg-muted"
                  aria-label="Clear customer"
                >
                  <X className="size-3.5 opacity-50" />
                </button>
              )}
              <ChevronsUpDown className="size-4 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search contacts..." value={query} onValueChange={setQuery} />
            {/* Pinned at the top so "Add new customer" is always one click
                away — it's the most common action when populating the
                system, and it must never get filtered out or buried. When
                the user has typed a name, offer to add it directly. */}
            <button
              type="button"
              onClick={handleAddNew}
              className="flex w-full items-center gap-2 border-b px-3 py-2.5 text-sm font-medium text-primary hover:bg-muted"
            >
              <Plus className="size-4 shrink-0" />
              {query.trim() ? `Add "${query.trim()}"` : 'Add new customer'}
            </button>
            <CommandList>
              <CommandEmpty>
                <p className="py-3 text-center text-sm text-muted-foreground">No contacts found.</p>
              </CommandEmpty>
              <CommandGroup>
                {contacts.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.name}
                    onSelect={() => handleSelect(c.id)}
                    data-checked={c.id === value}
                  >
                    <Check
                      className={cn('mr-2 size-4', c.id === value ? 'opacity-100' : 'opacity-0')}
                    />
                    {c.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
