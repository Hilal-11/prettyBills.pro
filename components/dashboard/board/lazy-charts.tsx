"use client"

import dynamic from "next/dynamic"

import { Skeleton } from "@/components/ui/skeleton"

/**
 * The charts, loaded on demand: recharts is the single biggest piece of the
 * dashboard's JavaScript, so it downloads after the page shows, with a
 * placeholder of the same size meanwhile.
 */
const loading = () => <Skeleton className="m-3 h-[calc(100%-1.5rem)] min-h-40 rounded-lg" aria-label="Loading chart" />

export const CashflowChart = dynamic(() => import("./charts").then((m) => m.CashflowChart), { loading })
export const AgeingChart = dynamic(() => import("./charts").then((m) => m.AgeingChart), { loading })
export const StatusChart = dynamic(() => import("./charts").then((m) => m.StatusChart), { loading })
export const MethodsChart = dynamic(() => import("./charts").then((m) => m.MethodsChart), { loading })
export const TopClientsChart = dynamic(() => import("./charts").then((m) => m.TopClientsChart), { loading })
export const ForecastChart = dynamic(() => import("./charts").then((m) => m.ForecastChart), { loading })
export const DaysToPayChart = dynamic(() => import("./charts").then((m) => m.DaysToPayChart), { loading })
export { Quiet } from "./quiet"
