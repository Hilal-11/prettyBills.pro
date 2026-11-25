import Image from "next/image"
import { cn } from "cn"

export const APP_NAME = "PrettyBills"

/** The app icon. The light and dark artwork swap with the theme, so there's no flash on load. */
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  const img = "shrink-0 rounded-[22%] ring-1 ring-black/5 dark:ring-white/10"
  return (
    <span className={cn("relative inline-grid shrink-0", className)} style={{ width: size, height: size }}>
      <Image src="/light-icon.png" alt="" width={size} height={size} className={cn(img, "dark:hidden")} style={{ width: size, height: size }} priority />
      <Image src="/dark-icon.png" alt="" width={size} height={size} className={cn(img, "hidden dark:block")} style={{ width: size, height: size }} priority />
    </span>
  )
}

/** Icon + name, for headers. */
export function BrandLockup({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrandMark size={size} />
      <span className="text-[15px] font-semibold tracking-[-0.02em]">{APP_NAME}</span>
    </span>
  )
}
