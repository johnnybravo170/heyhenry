'use client';

/**
 * Searchable customer combobox using shadcn Command + Popover.
 * Filters client-side as you type. Scales to hundreds of customers.
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

export type CustomerPickerProps = {
  customers: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  error?: string;
  /**
   * If provided, "Add new customer" calls this instead of navigating
   * to /customers/new. Used to open an inline create panel and keep
   * the user in their workflow.
   */
  onAddNew?: () => void;
};

export function CustomerPicker({
  customers,
  value,
  onChange,
  placeholder = 'Pick a customer',
  error,
  onAddNew,
}: CustomerPickerProps) {
  const [open, setOpen] = useState(false);

  const selected = customers.find((c) => c.id === value);

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
            <CommandInput placeholder="Search customers..." />
            <CommandList>
              <CommandEmpty>
                <div className="flex flex-col items-center gap-2 py-2">
                  <p className="text-sm text-muted-foreground">No customers found.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      if (onAddNew) onAddNew();
                      else window.location.href = '/customers/new';
                    }}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    <Plus className="size-3.5" />
                    Add new customer
                  </button>
                </div>
              </CommandEmpty>
              <CommandGroup>
                {customers.map((c) => (
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
                <CommandItem
                  value="__add_new_customer__"
                  onSelect={() => {
                    setOpen(false);
                    if (onAddNew) onAddNew();
                    else window.location.href = '/customers/new';
                  }}
                  className="text-primary"
                >
                  <Plus className="mr-2 size-4" />
                  Add new customer
                </CommandItem>
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
