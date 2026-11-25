"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { KeyRoundIcon, LoaderCircleIcon, LogOutIcon, MonitorSmartphoneIcon, UserRoundIcon } from "lucide-react"
import { FcGoogle } from "react-icons/fc"

import { FormAlert, PasswordInput, PasswordMeter } from "@/components/auth/auth-ui"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { authMessage } from "@/lib/auth/messages"
import { createClient } from "@/lib/supabase/client"

import { GuestCard, Group, Row, SavedTick, TabHeader, useSavedFlash } from "./ui"
import { avatarOf, displayName, initialsOf, type Account } from "./use-account"

const joined = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" })

export function ProfileTab({ account, reload, onOpenFeedback }: { account: Account; reload: () => void; onOpenFeedback: () => void }) {
  if (account.status === "loading") return <ProfileSkeleton />
  if (account.status === "guest")
    return (
      <>
        <TabHeader title="Profile" description="Your name and how you sign in." />
        <GuestCard icon={UserRoundIcon} title="You're using PrettyBills as a guest" body="Create a free account to keep your invoices, clients and business details, and to send invoices by email." />
      </>
    )
  return <SignedInProfile account={account} reload={reload} onOpenFeedback={onOpenFeedback} />
}

function SignedInProfile({ account, reload, onOpenFeedback }: { account: Extract<Account, { status: "user" }>; reload: () => void; onOpenFeedback: () => void }) {
  const { user, profile } = account
  const router = useRouter()
  const current = displayName(user, profile)
  const avatar = avatarOf(user, profile)
  const providers = (user.app_metadata?.providers as string[] | undefined) ?? [user.app_metadata?.provider ?? "email"]

  /* name */
  const [name, setName] = React.useState(current)
  const [nameState, setNameState] = React.useState<{ pending: boolean; error?: string }>({ pending: false })
  const [nameSaved, flashName] = useSavedFlash()
  const trimmed = name.trim().replace(/\s+/g, " ")
  const nameDirty = trimmed !== current

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    if (!trimmed) return setNameState({ pending: false, error: "Enter your name." })
    if (trimmed.length > 120) return setNameState({ pending: false, error: "Keep it under 120 characters." })
    setNameState({ pending: true })
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ data: { full_name: trimmed } })
    if (error) return setNameState({ pending: false, error: authMessage(error) })
    // the profiles row is what the app shows; it may not exist if the migration hasn't run
    await supabase.from("profiles").update({ full_name: trimmed }).eq("id", user.id)
    // fresh token so the server sees the new metadata straight away
    await supabase.auth.refreshSession()
    setNameState({ pending: false })
    flashName()
    reload()
    router.refresh()
  }

  /* product emails */
  const [optIn, setOptIn] = React.useState(profile?.marketing_opt_in ?? false)
  const [optInError, setOptInError] = React.useState<string | null>(null)
  async function toggleOptIn(next: boolean) {
    setOptIn(next)
    setOptInError(null)
    const { error } = await createClient().from("profiles").update({ marketing_opt_in: next }).eq("id", user.id)
    if (error) {
      setOptIn(!next)
      setOptInError("Couldn't save that. Try again.")
    }
  }

  return (
    <>
      <TabHeader title="Profile" description="Your name and how you sign in." />

      <div className="mb-6 flex items-center gap-4 rounded-xl border bg-background p-4">
        <Avatar className="size-14 rounded-xl">
          {avatar && <AvatarImage src={avatar} alt="" referrerPolicy="no-referrer" className="rounded-xl" />}
          <AvatarFallback className="rounded-xl bg-linear-to-b from-brand to-brand-deep text-base font-semibold text-white">{initialsOf(current)}</AvatarFallback>
        </Avatar>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p className="truncate text-[15px] font-semibold">{current || "Your account"}</p>
          <p className="truncate text-[13px] text-muted-foreground">{user.email}</p>
          <p className="text-[11px] text-muted-foreground">Member since {joined.format(new Date(user.created_at))}</p>
        </div>
        <span className="hidden shrink-0 rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">Free</span>
      </div>

      <form onSubmit={saveName}>
        <Group
          title="Personal details"
          footer={
            <>
              <SavedTick show={nameSaved} />
              <Button type="submit" size="sm" className="h-8 min-w-16 text-xs" disabled={!nameDirty || nameState.pending}>
                {nameState.pending ? <LoaderCircleIcon className="animate-spin" /> : "Save"}
              </Button>
            </>
          }
        >
          <Row label="Full name" hint="Shown in the app and on emails you send." htmlFor="settings-name">
            <Input id="settings-name" value={name} maxLength={120} autoComplete="name" onChange={(e) => setName(e.target.value)} className="h-9 w-full bg-background text-[13px] sm:w-64 md:text-[13px]" />
          </Row>
          <Row label="Email" hint="The address you log in with.">
            <span className="max-w-64 truncate text-[13px] text-muted-foreground">{user.email}</span>
          </Row>
          {nameState.error && (
            <div className="px-4 py-2">
              <FormAlert>{nameState.error}</FormAlert>
            </div>
          )}
        </Group>
      </form>

      <Group title="Sign-in methods">
        <Row label={<span className="inline-flex items-center gap-2"><FcGoogle className="size-4" /> Google</span>} hint={providers.includes("google") ? "Connected. You can log in with Google." : "Not connected. Log in with Google using this email to connect it."}>
          <span className={providers.includes("google") ? "text-xs font-medium text-brand dark:text-[#6da2ff]" : "text-xs text-muted-foreground"}>{providers.includes("google") ? "Connected" : "Not connected"}</span>
        </Row>
        <PasswordRow hasPassword={providers.includes("email")} />
      </Group>

      <Group title="Email">
        <Row label="Product updates" hint="A short email when something new ships. Never more than once a month." htmlFor="settings-optin">
          <Switch id="settings-optin" checked={optIn} disabled={!profile} onCheckedChange={toggleOptIn} className="data-checked:bg-brand" />
        </Row>
        {(optInError || !profile) && (
          <p className="px-4 py-2 text-xs text-muted-foreground">{optInError ?? "Available once your profile finishes setting up."}</p>
        )}
      </Group>

      <Group title="Sessions">
        <SessionsRow />
        <Row label="Delete account" hint="Removes your account and everything in it. This can't be undone.">
          <Button variant="outline" size="sm" className="h-8 text-xs text-destructive hover:text-destructive" onClick={onOpenFeedback}>
            Request deletion
          </Button>
        </Row>
      </Group>
    </>
  )
}

function PasswordRow({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = React.useState(false)
  const [pw, setPw] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [state, setState] = React.useState<{ pending: boolean; error?: string; done?: boolean }>({ pending: false })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pw.length < 8) return setState({ pending: false, error: "Use at least 8 characters." })
    if (pw !== confirm) return setState({ pending: false, error: "The passwords don't match." })
    setState({ pending: true })
    const { error } = await createClient().auth.updateUser({ password: pw })
    if (error) return setState({ pending: false, error: authMessage(error) })
    setPw("")
    setConfirm("")
    setOpen(false)
    setState({ pending: false, done: true })
  }

  return (
    <div className="px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="grid gap-0.5">
          <span className="inline-flex items-center gap-2 text-[13px] font-medium">
            <KeyRoundIcon className="size-4 text-muted-foreground" /> Password
          </span>
          <p className="text-xs text-muted-foreground">
            {state.done ? "Password updated. Use it next time you log in." : hasPassword ? "Log in with your email and password." : "Add a password to log in without Google."}
          </p>
        </div>
        {!open && (
          <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={() => setOpen(true)}>
            {hasPassword || state.done ? "Change password" : "Set a password"}
          </Button>
        )}
      </div>
      {open && (
        <form onSubmit={submit} className="mt-3 grid gap-2.5 rounded-lg border bg-muted/20 p-3 sm:max-w-sm" noValidate>
          <div className="grid gap-1.5">
            <label htmlFor="settings-pw" className="text-xs text-foreground/80">
              New password
            </label>
            <PasswordInput id="settings-pw" autoComplete="new-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
            <PasswordMeter value={pw} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="settings-pw2" className="text-xs text-foreground/80">
              Confirm new password
            </label>
            <PasswordInput id="settings-pw2" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <FormAlert>{state.error}</FormAlert>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setOpen(false)
                setState({ pending: false })
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" className="h-8 text-xs" disabled={state.pending}>
              {state.pending && <LoaderCircleIcon className="animate-spin" />}
              {state.pending ? "Saving…" : "Save password"}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

function SessionsRow() {
  const [state, setState] = React.useState<"idle" | "pending" | "done" | "error">("idle")
  async function signOutOthers() {
    setState("pending")
    const { error } = await createClient().auth.signOut({ scope: "others" })
    setState(error ? "error" : "done")
  }
  return (
    <Row
      label={<span className="inline-flex items-center gap-2"><MonitorSmartphoneIcon className="size-4 text-muted-foreground" /> Other devices</span>}
      hint={state === "done" ? "Done. Every other device has been logged out." : state === "error" ? "Couldn't do that. Try again." : "Lost a phone, or logged in on a shared computer? Log out everywhere except here."}
    >
      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={state === "pending" || state === "done"} onClick={signOutOthers}>
        {state === "pending" ? <LoaderCircleIcon className="animate-spin" /> : <LogOutIcon />}
        Log out other devices
      </Button>
    </Row>
  )
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading profile">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="mt-2 h-3.5 w-56" />
      <Skeleton className="mt-6 h-[88px] w-full rounded-xl" />
      <Skeleton className="mt-6 h-36 w-full rounded-lg" />
      <Skeleton className="mt-6 h-28 w-full rounded-lg" />
    </div>
  )
}
