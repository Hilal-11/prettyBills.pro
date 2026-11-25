"use client"

import * as React from "react"
import { motion } from "motion/react"
import { CalendarDaysIcon, ChevronsUpDownIcon } from "lucide-react"
import { cn } from "cn"

import { Calendar } from "@/components/ui/calendar"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { formatDate, isoToLocalDate, localDateToISO, normaliseNumberInput, type DateFormat } from "@/lib/invoice/format"
import { spring } from "@/lib/motion"

/** 14px input text, label above. Shared by every section. */
export const inputCls = "h-9 bg-background text-sm md:text-sm"

export function Field({
  label,
  required,
  help,
  error,
  className,
  htmlFor,
  aside,
  children,
}: {
  label: string
  required?: boolean
  help?: React.ReactNode
  error?: string
  className?: string
  htmlFor?: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-foreground/90">
          {label}
          {required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="text-xs text-destructive">
          {error}
        </p>
      ) : help ? (
        <p className="text-xs text-foreground/65">{help}</p>
      ) : null}
    </div>
  )
}

/** Text input bound to a field path (for focus linking and touched state). */
export function TextField({
  id,
  field,
  value,
  onChange,
  onBlur,
  error,
  className,
  upper,
  ...rest
}: Omit<React.ComponentProps<"input">, "onChange" | "value"> & {
  field: string
  value: string | undefined
  onChange: (v: string) => void
  error?: string
  upper?: boolean
}) {
  const fid = id ?? `f-${field.replace(/\W/g, "-")}`
  return (
    <Input
      id={fid}
      data-field={field}
      value={value ?? ""}
      onChange={(e) => onChange(upper ? e.target.value.toUpperCase() : e.target.value)}
      onBlur={onBlur}
      aria-invalid={!!error || undefined}
      aria-describedby={error ? `${fid}-error` : undefined}
      className={cn(inputCls, upper && "uppercase", className)}
      {...rest}
    />
  )
}

/** Money in paise. ₹ prefix inside, right-aligned, tabular. */
export function MoneyInput({
  field,
  value,
  onChange,
  onBlur,
  error,
  symbol = "₹",
  className,
  ...rest
}: Omit<React.ComponentProps<"input">, "onChange" | "value"> & { field: string; value: number; onChange: (paise: number) => void; error?: string; symbol?: string }) {
  const [text, setText] = React.useState<string | null>(null)
  const shown = text ?? (value ? (value / 100).toFixed(value % 100 ? 2 : 0) : value === 0 ? "0" : "")
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute inset-y-0 left-2.5 grid place-items-center text-sm text-foreground/60">{symbol.trim()}</span>
      <Input
        data-field={field}
        inputMode="decimal"
        value={shown}
        onFocus={(e) => {
          setText(shown === "0" ? "" : shown)
          e.currentTarget.select()
        }}
        onChange={(e) => {
          const t = normaliseNumberInput(e.target.value, 2)
          setText(t)
          onChange(Math.round(Number(t || 0) * 100))
        }}
        onBlur={(e) => {
          setText(null)
          onBlur?.(e)
        }}
        aria-invalid={!!error || undefined}
        className={cn(inputCls, "pl-7 text-right tabular-nums")}
        {...rest}
      />
    </div>
  )
}

/** Plain decimal number (qty, percent). No leading zeros, up to `decimals`. */
export function NumberInput({
  field,
  value,
  onChange,
  decimals = 3,
  error,
  suffix,
  className,
  ...rest
}: Omit<React.ComponentProps<"input">, "onChange" | "value"> & { field: string; value: number; onChange: (n: number) => void; decimals?: number; error?: string; suffix?: string }) {
  const [text, setText] = React.useState<string | null>(null)
  const shown = text ?? (Number.isFinite(value) ? String(value) : "")
  return (
    <div className={cn("relative", className)}>
      <Input
        data-field={field}
        inputMode="decimal"
        value={shown}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const t = normaliseNumberInput(e.target.value, decimals)
          setText(t)
          onChange(Number(t || 0))
        }}
        onBlur={() => setText(null)}
        aria-invalid={!!error || undefined}
        className={cn(inputCls, "text-right tabular-nums", suffix && "pr-7")}
        {...rest}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-2.5 grid place-items-center text-sm text-foreground/60">{suffix}</span>}
    </div>
  )
}

/** Date picker that always shows DD MMM YYYY (or DD/MM/YYYY), never US order. */
export function DateField({
  field,
  value,
  onChange,
  format = "DD MMM YYYY",
  error,
  min,
}: {
  field: string
  value: string
  onChange: (iso: string) => void
  format?: DateFormat
  error?: string
  min?: string
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            data-field={field}
            aria-haspopup="dialog"
            className={cn(
              "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-2.5 text-left text-sm tabular-nums transition-colors outline-none hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
              error && "border-destructive",
              !value && "text-muted-foreground"
            )}
          />
        }
      >
        {value ? formatDate(value, format) : "Pick a date"}
        <CalendarDaysIcon className="size-4 text-foreground/60" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          weekStartsOn={1}
          selected={isoToLocalDate(value)}
          defaultMonth={isoToLocalDate(value)}
          disabled={min ? { before: isoToLocalDate(min)! } : undefined}
          onSelect={(d) => {
            if (d) onChange(localDateToISO(d))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export type Option = { value: string; label: string; hint?: string; keywords?: string[] }

/** Searchable combobox (cmdk inside a popover). */
export function Combobox({
  field,
  value,
  options,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  empty = "No matches",
  error,
  footer,
  disabled,
  renderValue,
}: {
  field: string
  value: string | undefined
  options: Option[]
  onChange: (v: string) => void
  placeholder?: string
  searchPlaceholder?: string
  empty?: string
  error?: string
  footer?: (close: () => void) => React.ReactNode
  disabled?: boolean
  renderValue?: (o: Option | undefined) => React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const listId = React.useId()
  const current = options.find((o) => o.value === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            data-field={field}
            aria-invalid={!!error || undefined}
            className={cn(
              "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-background px-2.5 text-left text-sm transition-colors outline-none hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive dark:bg-input/30",
              !current && "text-muted-foreground"
            )}
          />
        }
      >
        <span className="min-w-0 truncate">{renderValue ? renderValue(current) : (current?.label ?? placeholder)}</span>
        <ChevronsUpDownIcon className="size-4 shrink-0 text-foreground/50" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList id={listId}>
            <CommandEmpty>{empty}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.value} ${(o.keywords ?? []).join(" ")}`}
                  data-checked={o.value === value}
                  onSelect={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{o.label}</span>
                    {o.hint && <span className="block truncate text-xs text-muted-foreground">{o.hint}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {footer && <div className="border-t p-1">{footer(() => setOpen(false))}</div>}
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function SelectField({ field, value, options, onChange, className }: { field: string; value: string; options: Option[]; onChange: (v: string) => void; className?: string }) {
  return (
    <Select items={options.map((o) => ({ value: o.value, label: o.label }))} value={value} onValueChange={(v) => v != null && onChange(String(v))}>
      <SelectTrigger data-field={field} className={cn(inputCls, "w-full", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-sm">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
  field,
}: {
  label: string
  hint?: React.ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  field?: string
}) {
  return (
    <label className={cn("flex items-center justify-between gap-3 px-3 py-2.5 transition-colors", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted/40")}>
      <span className="grid leading-tight">
        <span className="text-[13px] font-medium">{label}</span>
        {hint && <span className="mt-0.5 text-xs text-foreground/65">{hint}</span>}
      </span>
      <Switch data-field={field} checked={checked} onCheckedChange={onChange} disabled={disabled} className="data-checked:bg-brand" />
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  layoutId,
  className,
  label,
}: {
  value: T
  options: { value: T; label: React.ReactNode }[]
  onChange: (v: T) => void
  layoutId: string
  className?: string
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-lg border bg-muted/50 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative isolate inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            value === o.value ? "text-foreground" : "text-foreground/60 hover:text-foreground"
          )}
        >
          {value === o.value && <motion.span layoutId={layoutId} transition={spring} className="absolute inset-0 -z-10 rounded-md border bg-background shadow-xs" />}
          {o.label}
        </button>
      ))}
    </div>
  )
}
