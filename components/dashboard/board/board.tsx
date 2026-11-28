"use client"

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { closestCenter, DndContext, KeyboardSensor, pointerWithin, PointerSensor, useSensor, useSensors, type CollisionDetection, type DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, type SortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ArrowRightIcon,
  CalendarClockIcon,
  ChartColumnIcon,
  ChartLineIcon,
  ChartPieIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  GripVerticalIcon,
  HourglassIcon,
  LayoutGridIcon,
  ListIcon,
  PencilLineIcon,
  PlusIcon,
  RssIcon,
  Settings2Icon,
  Trash2Icon,
  UsersIcon,
  WalletIcon,
  XIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react"
import { cn } from "cn"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  boardFromPreset,
  COOKIE,
  MAX_BOARDS,
  MAX_CARDS,
  newId,
  PRESETS,
  serializeBoards,
  SIZE_LABEL,
  SIZES,
  WIDGET_TYPES,
  WIDGETS,
  type Board as BoardT,
  type Boards,
  type Card,
  type PresetId,
  type Size,
  type WidgetType,
} from "@/lib/dashboard/boards"
import type { DashboardData } from "@/lib/server/db/dashboard"
import { spring } from "@/lib/motion"

import { Widget, WIDGET_LINK } from "./widgets"

export const WIDGET_ICON: Record<WidgetType, LucideIcon> = {
  cashflow: ChartLineIcon,
  ageing: ChartColumnIcon,
  status: ChartPieIcon,
  methods: WalletIcon,
  topClients: UsersIcon,
  forecast: CalendarClockIcon,
  daysToPay: HourglassIcon,
  overdue: ListIcon,
  upcoming: CalendarClockIcon,
  recent: ListIcon,
  activity: RssIcon,
  shortcuts: ZapIcon,
}

// cards come in three sizes, so drop onto whatever is under the pointer; nearest centre only as a fallback
const collision: CollisionDetection = (args) => {
  const hit = pointerWithin(args)
  return hit.length ? hit : closestCenter(args)
}

// Cards are different sizes, so live reflow while dragging looks jumpy: the others stay put, the
// card under the pointer lights up, and the order changes on drop.
const stayPut: SortingStrategy = () => null

const SPAN: Record<Size, string> = { s: "col-span-1", m: "col-span-1 lg:col-span-2", l: "col-span-1 lg:col-span-2 xl:col-span-3" }

/**
 * The dashboard: tabs for each saved dashboard, then its cards in an edge-to-
 * edge grid. "Edit" shows drag handles, sizes and remove; "Add card" opens
 * the catalog. Every change is saved to a cookie, so the server renders the
 * same layout next time.
 */
export function Board({ initial, data, top }: { initial: Boards; data: DashboardData; top: React.ReactNode }) {
  const [state, setState] = React.useState(initial)
  const [editing, setEditing] = React.useState(false)
  const [adding, setAdding] = React.useState(false)
  const [renaming, setRenaming] = React.useState<string | null>(null)
  const [deleting, setDeleting] = React.useState<BoardT | null>(null)
  const [flash, setFlash] = React.useState<string | null>(null)
  const board = state.boards.find((b) => b.id === state.active) ?? state.boards[0]

  // persist every change
  const first = React.useRef(true)
  React.useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    document.cookie = `${COOKIE}=${encodeURIComponent(serializeBoards(state))}; path=/; max-age=31536000; samesite=lax`
  }, [state])

  const update = (fn: (b: BoardT) => BoardT) => setState((s) => ({ ...s, boards: s.boards.map((b) => (b.id === board.id ? fn(b) : b)) }))
  const setCards = (fn: (cards: Card[]) => Card[]) => update((b) => ({ ...b, cards: fn(b.cards) }))

  const addCard = (type: WidgetType) => {
    const id = newId("c")
    setCards((cards) => [...cards, { id, type, size: WIDGETS[type].size }].slice(0, MAX_CARDS))
    setAdding(false)
    setFlash(id)
    setTimeout(() => document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120)
    setTimeout(() => setFlash((f) => (f === id ? null : f)), 1600)
  }

  const addBoard = (preset: PresetId) => {
    if (state.boards.length >= MAX_BOARDS) return
    const names = new Set(state.boards.map((b) => b.name))
    let name: string = PRESETS[preset].name
    for (let n = 2; names.has(name); n++) name = `${PRESETS[preset].name} ${n}`
    const b = boardFromPreset(preset, name)
    setState((s) => ({ active: b.id, boards: [...s.boards, b] }))
    if (preset === "blank") setEditing(true)
  }

  const duplicate = (src: BoardT) => {
    if (state.boards.length >= MAX_BOARDS) return
    const b: BoardT = { id: newId("b"), name: `${src.name} copy`.slice(0, 40), cards: src.cards.map((c) => ({ ...c, id: newId("c") })) }
    setState((s) => ({ active: b.id, boards: [...s.boards, b] }))
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setCards((cards) => arrayMove(cards, cards.findIndex((c) => c.id === active.id), cards.findIndex((c) => c.id === over.id)))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* dashboards + controls */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2">
        <nav aria-label="Dashboards" className="-mx-1 max-w-full overflow-x-auto px-1">
          <ul className="flex items-center gap-0.5">
            {state.boards.map((b) => {
              const on = b.id === board.id
              return (
                <li key={b.id} className="relative">
                  {renaming === b.id ? (
                    <RenameInput
                      value={b.name}
                      onDone={(name) => {
                        setRenaming(null)
                        if (name) setState((s) => ({ ...s, boards: s.boards.map((x) => (x.id === b.id ? { ...x, name } : x)) }))
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      aria-current={on ? "page" : undefined}
                      onClick={() => setState((s) => ({ ...s, active: b.id }))}
                      onDoubleClick={() => setRenaming(b.id)}
                      title="Double-click to rename"
                      className={cn("relative isolate inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] whitespace-nowrap transition-colors", on ? "font-medium text-foreground" : "text-foreground/60 hover:text-foreground")}
                    >
                      {on && <motion.span layoutId="board-tabs" transition={spring} className="absolute inset-0 -z-10 rounded-md border bg-muted/70" />}
                      <LayoutGridIcon className="size-3.5 opacity-60" />
                      {b.name}
                    </button>
                  )}
                </li>
              )
            })}
            <li className="ml-1 flex items-center gap-0.5 border-l pl-1.5">
              <BoardMenu board={board} canDelete={state.boards.length > 1} onRename={() => setRenaming(board.id)} onDuplicate={() => duplicate(board)} onDelete={() => setDeleting(board)} />
              {state.boards.length < MAX_BOARDS && <NewBoardMenu onPick={addBoard} />}
            </li>
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <AnimatePresence initial={false}>
            {editing && (
              <motion.span initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }} className="hidden text-xs text-muted-foreground md:inline">
                Drag cards to reorder · pick a size · remove
              </motion.span>
            )}
          </AnimatePresence>
          <Button variant={editing ? "default" : "outline"} className="h-8 gap-1.5 px-2.5 text-[13px] font-normal" onClick={() => setEditing((e) => !e)} aria-pressed={editing}>
            {editing ? <CheckIcon className="size-3.5" /> : <Settings2Icon className="size-3.5 text-muted-foreground" />}
            {editing ? "Done" : "Edit cards"}
          </Button>
          <Button className="h-8 gap-1.5 px-3 text-[13px]" onClick={() => setAdding(true)} disabled={board.cards.length >= MAX_CARDS}>
            <PlusIcon /> Add card
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        {top}
        {board.cards.length === 0 ? (
          <EmptyBoard onAdd={() => setAdding(true)} onPreset={(p) => setCards(() => boardFromPreset(p).cards)} />
        ) : (
          <DndContext sensors={sensors} collisionDetection={collision} onDragEnd={onDragEnd}>
            <SortableContext items={board.cards.map((c) => c.id)} strategy={stayPut}>
              <div className="-mr-px grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence initial={false} mode="popLayout">
                  {board.cards.map((c) => (
                    <motion.div key={c.id} id={`card-${c.id}`} className={cn("min-w-0", SPAN[c.size])} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={spring}>
                      <CardShell
                        card={c}
                        data={data}
                        editing={editing}
                        flash={flash === c.id}
                        onSize={(size) => setCards((cards) => cards.map((x) => (x.id === c.id ? { ...x, size } : x)))}
                        onRemove={() => setCards((cards) => cards.filter((x) => x.id !== c.id))}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <AddCardDialog open={adding} onOpenChange={setAdding} present={new Set(board.cards.map((c) => c.type))} onAdd={addCard} />

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="sm:max-w-[380px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Only the layout goes. Your invoices and numbers aren&apos;t touched, and you can build it again from a template.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-[13px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="h-8 text-[13px]"
              onClick={() => {
                const id = deleting?.id
                setDeleting(null)
                setState((s) => {
                  const boards = s.boards.filter((b) => b.id !== id)
                  return { active: s.active === id ? boards[0].id : s.active, boards }
                })
              }}
            >
              Delete dashboard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* --------------------------------- card --------------------------------- */

function CardShell({ card, data, editing, flash, onSize, onRemove }: { card: Card; data: DashboardData; editing: boolean; flash: boolean; onSize: (s: Size) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isOver, active } = useSortable({ id: card.id, disabled: !editing })
  const target = isOver && !!active && active.id !== card.id
  const meta = WIDGETS[card.type]
  const link = WIDGET_LINK[card.type]
  const Icon = WIDGET_ICON[card.type]
  return (
    <section
      ref={setNodeRef}
      aria-label={meta.title}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative flex h-full min-h-56 flex-col border-r border-b bg-background transition-[box-shadow,background-color] duration-300",
        // opaque tint, so a dragged card never shows what's under it
        editing && "bg-[color-mix(in_oklab,var(--muted)_30%,var(--background))]",
        isDragging && "z-30 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)] ring-1 ring-brand/40",
        target && "bg-brand/5 ring-2 ring-brand/50 ring-inset",
        flash && "bg-brand/5 ring-1 ring-brand/40 ring-inset"
      )}
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b px-4">
        {editing ? (
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label={`Move ${meta.title}`}
            className="-ml-2 grid size-6 cursor-grab touch-none place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon className="size-3.5" />
          </button>
        ) : (
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <h2 className="truncate text-[13px] font-semibold">{meta.title}</h2>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {editing ? (
            <>
              <div role="radiogroup" aria-label="Card size" className="inline-flex rounded-md border bg-background p-0.5">
                {SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={card.size === s}
                    title={SIZE_LABEL[s]}
                    onClick={() => onSize(s)}
                    className={cn("h-5 min-w-5 rounded px-1 text-[10px] font-semibold uppercase transition-colors", card.size === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button type="button" aria-label={`Remove ${meta.title}`} onClick={onRemove} className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600">
                <XIcon className="size-3.5" />
              </button>
            </>
          ) : (
            link && (
              <Link href={link.href} className="group/link inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
                {link.label} <ArrowRightIcon className="size-3 transition-transform group-hover/link:translate-x-0.5" />
              </Link>
            )
          )}
        </div>
      </header>
      {target && <span className="pointer-events-none absolute inset-x-0 top-12 z-10 mx-auto w-fit rounded-md bg-brand px-2 py-0.5 text-[11px] font-medium text-white shadow">Drop here</span>}
      <div className={cn("min-h-0 flex-1", editing && "pointer-events-none select-none")}>
        <Widget type={card.type} data={data} wide={card.size !== "s"} />
      </div>
    </section>
  )
}

/* -------------------------------- menus -------------------------------- */

const item = "gap-2 py-1.5 text-[13px]"

function BoardMenu({ board, canDelete, onRename, onDuplicate, onDelete }: { board: BoardT; canDelete: boolean; onRename: () => void; onDuplicate: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Options for ${board.name}`} className="text-muted-foreground" />}>
        <ChevronDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44 rounded-xl p-1.5">
        <DropdownMenuItem className={item} onClick={onRename}>
          <PencilLineIcon /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem className={item} onClick={onDuplicate}>
          <CopyIcon /> Duplicate
        </DropdownMenuItem>
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" className={item} onClick={onDelete}>
              <Trash2Icon /> Delete dashboard
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NewBoardMenu({ onPick }: { onPick: (p: PresetId) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-7 gap-1 px-2 text-[13px] font-normal text-muted-foreground" />}>
        <PlusIcon className="size-3.5" /> <span className="hidden sm:inline">Dashboard</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 rounded-xl p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs">Start from a template</DropdownMenuLabel>
          {(Object.keys(PRESETS) as PresetId[]).map((p) => (
            <DropdownMenuItem key={p} className="items-start gap-2.5 py-2" onClick={() => onPick(p)}>
              <LayoutGridIcon className="mt-0.5" />
              <span className="grid gap-0.5">
                <span className="text-[13px] font-medium">{PRESETS[p].name}</span>
                <span className="text-xs text-muted-foreground">{PRESETS[p].description}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function RenameInput({ value, onDone }: { value: string; onDone: (name: string | null) => void }) {
  const [v, setV] = React.useState(value)
  return (
    <input
      autoFocus
      value={v}
      maxLength={40}
      aria-label="Dashboard name"
      onChange={(e) => setV(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => onDone(v.trim() || null)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onDone(v.trim() || null)
        if (e.key === "Escape") onDone(null)
      }}
      className="h-7 w-36 rounded-md border bg-background px-2 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    />
  )
}

/* ------------------------------ add a card ------------------------------ */

function AddCardDialog({ open, onOpenChange, present, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; present: Set<WidgetType>; onAdd: (t: WidgetType) => void }) {
  const groups = ["Charts", "Lists", "Other"] as const
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] gap-0 overflow-hidden p-0 sm:max-w-[720px]">
        <div className="border-b px-5 py-4">
          <DialogTitle className="text-[15px] font-semibold">Add a card</DialogTitle>
          <DialogDescription className="mt-0.5 text-xs text-muted-foreground">Cards use your live invoices and payments. Resize or move them with Edit cards.</DialogDescription>
        </div>
        <div className="max-h-[calc(90dvh-72px)] overflow-y-auto">
          {groups.map((g) => (
            <section key={g} className="border-b last:border-b-0">
              <h3 className="px-5 pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{g}</h3>
              <div className="grid sm:grid-cols-2">
                {WIDGET_TYPES.filter((t) => WIDGETS[t].group === g).map((t, i) => {
                  const Icon = WIDGET_ICON[t]
                  const on = present.has(t)
                  return (
                    <motion.button
                      key={t}
                      type="button"
                      disabled={on}
                      onClick={() => onAdd(t)}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...spring, delay: i * 0.025 }}
                      className="group flex items-start gap-3 border-t bg-background px-5 py-3 text-left sm:odd:border-r transition-colors hover:bg-muted/40 disabled:cursor-default disabled:opacity-55 disabled:hover:bg-background"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg border bg-muted/40 text-muted-foreground transition-colors group-hover:border-brand/40 group-hover:bg-brand/10 group-hover:text-brand dark:group-hover:text-[#6da2ff]">
                        <Icon className="size-4" />
                      </span>
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className="flex items-center gap-2 text-[13px] font-medium">
                          {WIDGETS[t].title}
                          {on && <span className="rounded bg-muted px-1.5 text-[10px] font-normal text-muted-foreground">On this dashboard</span>}
                        </span>
                        <span className="text-xs text-muted-foreground">{WIDGETS[t].description}</span>
                      </span>
                      {!on && <PlusIcon className="mt-1 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
                    </motion.button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EmptyBoard({ onAdd, onPreset }: { onAdd: () => void; onPreset: (p: PresetId) => void }) {
  return (
    <div className="grid place-items-center px-4 py-16 text-center">
      <div className="grid max-w-md justify-items-center gap-2">
        <span className="grid size-10 place-items-center rounded-xl border bg-muted/40 text-muted-foreground">
          <LayoutGridIcon className="size-4.5" />
        </span>
        <h2 className="mt-1 text-[15px] font-semibold">This dashboard is empty</h2>
        <p className="text-[13px] text-muted-foreground">Add the cards you want, or fill it from a template.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          <Button className="h-8 gap-1.5 px-3 text-[13px]" onClick={onAdd}>
            <PlusIcon /> Add a card
          </Button>
          {(["overview", "collections", "clients"] as const).map((p) => (
            <Button key={p} variant="outline" className="h-8 px-2.5 text-[13px]" onClick={() => onPreset(p)}>
              {PRESETS[p].name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
