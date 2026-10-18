"use client"

// Rangoli Preloader — a loading gate drawn in coloured powder on a red-oxide
// floor. As the page loads, the rangoli pours itself from the centre outward,
// every fold at once the way two hands work a pattern: a turmeric core, a
// magenta lotus, rice-flour kolam dots, marigold petals with vermilion tips,
// an indigo band, green scallops and a crown of flame spikes. Every mark is
// thousands of jittered grains, so it reads as powder, not vector. At 100 it
// holds a beat, then a gust sweeps across the floor, lifts the powder into the
// air and opens onto whatever the gate was guarding.
//
// One file, React only. A 2D canvas for the floor and the grains;
// DOM for the type. Every rule in the scoped <style> is .rgp- prefixed and
// nothing is fetched.

import * as React from "react"

export interface RangoliPalette {
  floor: string
  rice: string
  vermilion: string
  marigold: string
  turmeric: string
  magenta: string
  indigo: string
  leaf: string
}

export type RangoliPreset = "oxide" | "slate" | "marble"

export interface RangoliPreloaderProps {
  /** Content revealed once the powder is swept away. Ignored while `loop` is set. */
  children?: React.ReactNode
  /** Run forever as a showcase: children are never revealed, onComplete never fires. */
  loop?: boolean
  /** Real loading progress, 0–100. Leave undefined to simulate over `durationMs`. */
  progress?: number
  /** Length of the simulated load. Defaults to 6200ms. */
  durationMs?: number
  /** Floor and powders. Defaults to "oxide" (a red-oxide floor). */
  preset?: RangoliPreset
  /** Colour overrides, merged over the preset. */
  palette?: { floor?: string; rice?: string; vermilion?: string; marigold?: string; turmeric?: string; magenta?: string; indigo?: string; leaf?: string }
  /** How many times the pattern repeats around the centre: 6, 8 or 12. Defaults to 8. */
  folds?: number
  /** Reshuffles the grains. */
  seed?: number
  /** Accessible name of the progress bar. */
  label?: string
  /** Top-right line. */
  meta?: string
  /** The small line above the closing message. */
  blessing?: string
  /** The closing line. Empty string skips it. */
  message?: string
  /** Corner type and the counter. Defaults to true. */
  hud?: boolean
  /** Face for the closing line. */
  serifFamily?: string
  /** Face for the corner type. */
  monoFamily?: string
  /** Root height. A definite length, never a percentage. */
  height?: string
  /** Fired once, after the gate has opened. */
  onComplete?: () => void
  className?: string
}

const PRESETS: { [K in RangoliPreset]: RangoliPalette } = {
  oxide: {
    floor: "#5c1a12", rice: "#f6eedd", vermilion: "#e8432a", marigold: "#f59e1b",
    turmeric: "#f7cf2a", magenta: "#c8246b", indigo: "#2c3a92", leaf: "#2f8f4e",
  },
  slate: {
    floor: "#1a1716", rice: "#f3ead8", vermilion: "#e5462e", marigold: "#f4a021",
    turmeric: "#f6d234", magenta: "#d02d78", indigo: "#3949ab", leaf: "#2e9a59",
  },
  marble: {
    floor: "#ece5d8", rice: "#2a211b", vermilion: "#d23a22", marigold: "#e98a12",
    turmeric: "#e6b80f", magenta: "#b51e5f", indigo: "#24307f", leaf: "#23784a",
  },
}

const SERIF_STACK = '"Instrument Serif", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif'
const MONO_STACK = '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace'

// Colour slots by index, as stored per grain.
const SLOTS = ["rice", "vermilion", "marigold", "turmeric", "magenta", "indigo", "leaf"] as const
const HOLD_MS = 350
const WIND_MS = 900
const CLEAR_MS = 700
const OPEN_MS = 400

// #region pattern
// Pure helpers, lifted out and executed by tests/rangoli-preloader.test.mjs.

/** Small fast seeded PRNG (mulberry32): same seed, same grains. */
export function rgpRandom(seed: number) {
  let a = (seed >>> 0) || 1
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The simulated load at time fraction t ∈ [0, 1]: eased, with stalls, monotonic, 0 → 100. */
export function rgpSimulated(t: number) {
  const k = t < 0 ? 0 : t > 1 ? 1 : t
  const ease = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
  const stall = 0.03 * Math.sin(k * Math.PI * 4) * Math.sin(k * Math.PI)
  return Math.max(0, Math.min(100, (ease - stall) * 100))
}

/** Half-width of a lens petal at fraction f ∈ [0, 1] of its length. */
export function rgpLens(f: number, w: number) {
  return f <= 0 || f >= 1 ? 0 : w * Math.pow(Math.sin(Math.PI * f), 0.8)
}

/** Half-width of a flame spike: full at the base, a sharp point at the tip. */
export function rgpSpike(f: number, w: number) {
  return f <= 0 || f >= 1 ? 0 : w * Math.pow(1 - f, 1.25) * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, f * 2)))
}

/** Angle folded into one sector, as a fraction 0–1 of the sector. */
export function rgpSector(angle: number, folds: number) {
  const step = (Math.PI * 2) / folds
  const a = ((angle % step) + step) % step
  return a / step
}

/**
 * Build every grain of the pattern in unit space (outer radius ≈ 1).
 * `density` is grains per unit². Returns flat arrays sorted in pour order:
 * x, y (unit), slot (colour index), shade (0.82–1.12) and size (0.7–1.3).
 */
export function rgpBuild(folds: number, density: number, seed: number) {
  const rand = rgpRandom(seed)
  const n = folds === 6 || folds === 12 ? folds : 8
  const TAU = Math.PI * 2
  const out = [] as number[][]

  // Polar helpers: (r, a) of a point, and its position along / across a ray.
  const along = (x: number, y: number, a: number) => x * Math.cos(a) + y * Math.sin(a)
  const across = (x: number, y: number, a: number) => -x * Math.sin(a) + y * Math.cos(a)

  // A sublayer: sample the annulus [r0, r1], keep what `hit` accepts.
  // hit returns -1 for a miss, else [slot, orderKey ∈ [0, 1)].
  const layer = (index: number, r0: number, r1: number, hit: (x: number, y: number, r: number, a: number) => number[] | null) => {
    const area = Math.PI * (r1 * r1 - r0 * r0)
    const tries = Math.round(area * density)
    for (let i = 0; i < tries; i++) {
      const r = Math.sqrt(r0 * r0 + rand() * (r1 * r1 - r0 * r0))
      const a = rand() * TAU
      const x = r * Math.cos(a)
      const y = r * Math.sin(a)
      const h = hit(x, y, r, a)
      if (!h) continue
      out.push([index + h[1], x, y, h[0], 0.82 + rand() * 0.3, 0.7 + rand() * 0.6])
    }
  }

  // Nearest petal of a family of `count` petals rotated by `offset` (in sectors).
  const petal = (a: number, count: number, offset: number) => {
    const step = TAU / count
    const k = Math.round((a - offset * step) / step)
    return k * step + offset * step
  }

  const ring = (a: number, count: number, offset: number, rr: number, x: number, y: number) => {
    const c = petal(a, count, offset)
    return Math.hypot(x - rr * Math.cos(c), y - rr * Math.sin(c))
  }
  const clamp = (f: number) => Math.max(0, Math.min(0.999, f))

  // 0 · core: turmeric bindu, vermilion ring, a rice-flour line.
  layer(0, 0, 0.088, (_x, _y, r) => [r < 0.05 ? 3 : r < 0.076 ? 1 : 0, r / 0.088])
  // 1 · inner lotus: small magenta lens petals edged in rice flour.
  layer(1, 0.08, 0.205, (x, y, r, a) => {
    const c = petal(a, n, 0)
    const f = (along(x, y, c) - 0.082) / 0.12
    const v = Math.abs(across(x, y, c))
    const hw = rgpLens(f, 0.052)
    if (v > hw) return null
    return [hw - v < 0.01 ? 0 : 4, clamp(f)]
  })
  // 2 · outer lotus, offset half a sector, vermilion with a turmeric heart.
  layer(2, 0.1, 0.285, (x, y, r, a) => {
    const c = petal(a, n, 0.5)
    const f = (along(x, y, c) - 0.105) / 0.175
    const v = Math.abs(across(x, y, c))
    const hw = rgpLens(f, 0.07)
    if (v > hw) return null
    return [hw - v < 0.011 ? 0 : v < hw * 0.32 && f > 0.25 && f < 0.75 ? 3 : 1, clamp(f)]
  })
  // 3 · a rice-flour circle and kolam dots on it.
  layer(3, 0.282, 0.335, (x, y, r, a) => {
    if (r > 0.286 && r < 0.294) return [0, rgpSector(a, n)]
    return ring(a, n * 2, 0.25, 0.315, x, y) < 0.012 ? [0, rgpSector(a, n)] : null
  })
  // 4 · marigold petals: pointed, a turmeric midrib, vermilion tips, rice edges.
  layer(4, 0.33, 0.53, (x, y, r, a) => {
    const c = petal(a, n, 0)
    const f = (along(x, y, c) - 0.335) / 0.19
    const v = Math.abs(across(x, y, c))
    if (f <= 0 || f >= 1) return null
    const hw = 0.118 * Math.pow(Math.sin(Math.PI * f), 0.6) * Math.pow(1 - f, 0.35)
    if (v > hw) return null
    const slot = hw - v < 0.011 ? 0 : v < 0.007 && f < 0.8 ? 3 : f > 0.7 ? 1 : 2
    return [slot, clamp(f)]
  })
  // 5 · leaves between the marigolds, with a turmeric bud at the base.
  layer(5, 0.335, 0.53, (x, y, r, a) => {
    const c = petal(a, n, 0.5)
    const bud = Math.hypot(x - 0.355 * Math.cos(c), y - 0.355 * Math.sin(c))
    if (bud < 0.02) return [bud < 0.008 ? 0 : 3, 0]
    const f = (along(x, y, c) - 0.37) / 0.155
    const v = Math.abs(across(x, y, c))
    const hw = rgpLens(f, 0.05)
    if (v > hw) return null
    return [hw - v < 0.009 || v < 0.004 ? 0 : 6, clamp(f)]
  })
  // 6 · rice-flour line.
  layer(6, 0.536, 0.544, (_x, _y, _r, a) => [0, rgpSector(a, n)])
  // 7 · indigo band with a rice-flour zigzag running round it.
  layer(7, 0.55, 0.603, (x, y, r, a) => {
    const t = rgpSector(a, n * 6)
    const tri = 1 - Math.abs(t * 2 - 1)
    const zz = 0.556 + tri * 0.041
    return [Math.abs(r - zz) < 0.0055 ? 0 : 5, rgpSector(a, n)]
  })
  // 8 · scallops, alternating leaf and magenta, rice edges and a rice dot.
  layer(8, 0.603, 0.668, (x, y, r, a) => {
    const step = (Math.PI * 2) / (n * 2)
    const k = Math.round((a - step / 2) / step)
    const c = k * step + step / 2
    const d = Math.hypot(x - 0.603 * Math.cos(c), y - 0.603 * Math.sin(c))
    if (d > 0.058) return null
    const dot = Math.hypot(x - 0.636 * Math.cos(c), y - 0.636 * Math.sin(c)) < 0.009
    return [dot || d > 0.047 ? 0 : ((k % 2) + 2) % 2 === 0 ? 6 : 4, rgpSector(a, n)]
  })
  // 9 · crown of flame spikes, alternating, each with a contrasting core.
  layer(9, 0.665, 0.975, (x, y, r, a) => {
    const step = (Math.PI * 2) / n
    const k = Math.round(a / step)
    const c = k * step
    const f = (along(x, y, c) - 0.67) / 0.3
    const v = Math.abs(across(x, y, c))
    const hw = rgpSpike(f, 0.088)
    if (v > hw) return null
    const even = ((k % 2) + 2) % 2 === 0
    const slot = hw - v < 0.011 ? 0 : v < hw * 0.3 && f < 0.82 ? (even ? 3 : 1) : even ? 1 : 3
    return [slot, clamp(f)]
  })
  // 10 · small marigold blooms between the spikes, a rice dot beyond each.
  layer(10, 0.76, 0.95, (x, y, r, a) => {
    const d = ring(a, n, 0.5, 0.8, x, y)
    if (d < 0.034) return [d < 0.011 ? 3 : d > 0.027 ? 0 : 2, rgpSector(a, n)]
    return ring(a, n, 0.5, 0.905, x, y) < 0.012 ? [0, rgpSector(a, n)] : null
  })
  // 11 · an outer necklace of fine rice-flour dots.
  layer(11, 0.99, 1.02, (x, y, r, a) => (ring(a, n * 8, 0, 1.005, x, y) < 0.0075 ? [0, rgpSector(a, n)] : null))

  out.sort((p, q) => p[0] - q[0])
  const count = out.length
  const xs = new Float32Array(count)
  const ys = new Float32Array(count)
  const slot = new Uint8Array(count)
  const shade = new Float32Array(count)
  const size = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const g = out[i]
    xs[i] = g[1]
    ys[i] = g[2]
    slot[i] = g[3]
    shade[i] = g[4]
    size[i] = g[5]
  }
  return { count, xs, ys, slot, shade, size }
}

/** Hex → [r, g, b], or a fallback for anything that isn't #rgb / #rrggbb. */
export function rgpHex(hex: string, fallback: number[]) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || "").trim())
  if (!m) return fallback
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
// #endregion



export default function RangoliPreloader({
  children,
  loop = false,
  progress,
  durationMs = 6200,
  preset = "oxide",
  palette,
  folds = 8,
  seed = 7,
  label = "Loading",
  meta = "Deepavali · 2026",
  blessing = "शुभ आरंभ",
  message = "Welcome home.",
  hud = true,
  serifFamily = SERIF_STACK,
  monoFamily = MONO_STACK,
  height = "100svh",
  onComplete,
  className = "",
}: RangoliPreloaderProps) {
  const colors = { ...(PRESETS[preset] || PRESETS.oxide), ...(palette || {}) }
  const typeColor = preset === "marble" && !(palette && palette.floor) ? "#2a211b" : "#f6eedd"
  const rootRef = React.useRef(null as HTMLDivElement | null)
  const canvasRef = React.useRef(null as HTMLCanvasElement | null)
  const [phase, setPhase] = React.useState("draw" as "draw" | "hold" | "wind" | "clear" | "open" | "done")
  const [pct, setPct] = React.useState(0)
  const [run, setRun] = React.useState(0)
  const phaseRef = React.useRef(phase)
  phaseRef.current = phase
  const progressRef = React.useRef(progress)
  progressRef.current = progress
  const onCompleteRef = React.useRef(onComplete)
  onCompleteRef.current = onComplete
  const rushRef = React.useRef(false)
  const optsRef = React.useRef({ colors, folds, seed, durationMs, loop })
  optsRef.current = { colors, folds, seed, durationMs, loop }
  const colorKey = SLOTS.map((s) => colors[s]).join("|") + "|" + colors.floor

  React.useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) { setPhase("open"); return }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) { setPct(100); setPhase("open"); return }
    const o = optsRef.current

    let w = 1
    let h = 1
    let dpr = 1
    let unit = 1
    let gpx = 1.6
    let cx = 0
    let cy = 0
    let raf = 0
    let grains = rgpBuild(o.folds, 1, o.seed)
    let drawn = 0
    let shown = 0
    let holdAt = -1
    let windAt = -1
    let clearAt = -1
    let started = performance.now()
    let floorTex = null as HTMLCanvasElement | null
    let powder = null as HTMLCanvasElement | null
    let pctLast = -1
    let localPhase = "draw"
    const rgb = SLOTS.map((s) => rgpHex(o.colors[s], [255, 255, 255]))
    const floorRgb = rgpHex(o.colors.floor, [92, 26, 18])
    const darkFloor = floorRgb[0] * 0.3 + floorRgb[1] * 0.59 + floorRgb[2] * 0.11 < 140

    const setLocal = (p: string) => {
      localPhase = p
      setPhase(p as "draw" | "hold" | "wind" | "clear" | "open" | "done")
    }

    const layout = () => {
      const rect = root.getBoundingClientRect()
      w = Math.max(1, Math.round(rect.width))
      h = Math.max(1, Math.round(rect.height))
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      cx = w / 2
      cy = h / 2
      unit = Math.min(w, h) * 0.46
      // Grain density: ~0.8 of the area covered by 1.9px grains, capped for big screens.
      // Grains grow with the pattern so big screens stay as dense as small ones.
      gpx = Math.max(1.6, Math.min(3.2, unit / 190))
      const density = Math.min(70000, ((unit * unit) / (gpx * gpx)) * 1.15)
      grains = rgpBuild(o.folds, density, o.seed)

      // Floor: the base colour, a soft vignette and stone grain, drawn once.
      floorTex = document.createElement("canvas")
      floorTex.width = canvas.width
      floorTex.height = canvas.height
      const f = floorTex.getContext("2d")
      if (f) {
        f.setTransform(dpr, 0, 0, dpr, 0, 0)
        f.fillStyle = o.colors.floor
        f.fillRect(0, 0, w, h)
        const v = f.createRadialGradient(cx, cy, unit * 0.4, cx, cy, Math.hypot(w, h) * 0.62)
        v.addColorStop(0, "rgba(255,255,255,0.05)")
        v.addColorStop(1, darkFloor ? "rgba(0,0,0,0.42)" : "rgba(60,40,20,0.16)")
        f.fillStyle = v
        f.fillRect(0, 0, w, h)
        const rand = rgpRandom(o.seed + 99)
        for (let i = 0; i < (w * h) / 9; i++) {
          f.fillStyle = rand() < 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.06)"
          f.fillRect(rand() * w, rand() * h, 1, 1)
        }
      }
      powder = document.createElement("canvas")
      powder.width = canvas.width
      powder.height = canvas.height
      // Redraw what was already poured at the new size.
      const target = drawn
      drawn = 0
      pour(target)
    }

    const grainColor = (i: number) => {
      const c = rgb[grains.slot[i]]
      const s = grains.shade[i]
      return "rgb(" + Math.min(255, Math.round(c[0] * s)) + "," + Math.min(255, Math.round(c[1] * s)) + "," + Math.min(255, Math.round(c[2] * s)) + ")"
    }

    // Lay grains [drawn, upto) onto the powder canvas; they stay there.
    const pour = (upto: number) => {
      if (!powder) return
      const p = powder.getContext("2d")
      if (!p) return
      p.setTransform(dpr, 0, 0, dpr, 0, 0)
      const end = Math.min(grains.count, upto)
      for (let i = drawn; i < end; i++) {
        const s = gpx * grains.size[i]
        p.fillStyle = grainColor(i)
        p.globalAlpha = 0.9
        p.fillRect(cx + grains.xs[i] * unit - s / 2, cy + grains.ys[i] * unit - s / 2, s, s)
      }
      p.globalAlpha = 1
      drawn = Math.max(drawn, end)
    }

    const frame = (now: number) => {
      if (localPhase === "open") return
      raf = requestAnimationFrame(frame)
      const opts = optsRef.current
      const ph = localPhase

      if (ph === "draw") {
        const real = progressRef.current
        const t = (now - started) / Math.max(800, opts.durationMs)
        let target = real === undefined ? rgpSimulated(t) : Math.max(0, Math.min(100, Number(real) || 0))
        if (rushRef.current) target = 100
        shown = reduced ? target : Math.max(shown, shown + (target - shown) * (rushRef.current ? 0.2 : 0.14))
        if (target >= 100 && shown > 99.7) shown = 100
        pour(Math.floor((grains.count * shown) / 100))
        const p = Math.floor(shown)
        if (p !== pctLast) {
          pctLast = p
          setPct(p)
        }
        if (shown >= 100) {
          pour(grains.count)
          holdAt = now
          setLocal("hold")
        }
      } else if (ph === "hold" && now - holdAt > HOLD_MS) {
        if (reduced) {
          setLocal("open")
        } else {
          windAt = now
          setLocal("wind")
        }
      } else if (ph === "wind" && now - windAt > WIND_MS) {
        clearAt = now
        setLocal("clear")
      } else if (ph === "clear" && now - clearAt > CLEAR_MS) {
        setLocal("open")
      }

      // Floor, then powder (swept away behind the gust), then flying grains, then the lamp.
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      if (floorTex) ctx.drawImage(floorTex, 0, 0)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (ph === "wind" || ph === "clear" || ph === "open") {
        const k = ph === "wind" ? Math.min(1, (now - windAt) / WIND_MS) : 1
        const sweep = -w * 0.25 + w * 1.6 * (k * k * (3 - 2 * k))
        const band = w * 0.35
        if (powder) {
          // Draw only the powder still ahead of the gust, feathered at its edge.
          ctx.save()
          ctx.beginPath()
          ctx.rect(sweep, 0, w - sweep + 1, h)
          ctx.clip()
          ctx.drawImage(powder, 0, 0, w, h)
          ctx.restore()
        }
        // Lifted grains: every third grain behind the gust, flying up and away.
        const rand = rgpRandom(opts.seed + 7)
        for (let i = 0; i < grains.count; i++) {
          const gx = cx + grains.xs[i] * unit
          const gy = cy + grains.ys[i] * unit
          const r1 = rand()
          const r2 = rand()
          const local = (sweep - gx) / band
          if (local <= 0 || local >= 1) continue
          const e = local * local
          const dx = e * (w * 0.35 + r1 * w * 0.3)
          const dy = -e * (h * 0.12 + r2 * h * 0.25) + Math.sin(local * 9 + r1 * 6) * 10 * local
          ctx.globalAlpha = (1 - local) * 0.92
          ctx.fillStyle = grainColor(i)
          const s = gpx * 0.94 * grains.size[i]
          ctx.fillRect(gx + dx, gy + dy, s, s)
        }
        ctx.globalAlpha = 1
      } else if (powder) {
        ctx.drawImage(powder, 0, 0, w, h)
      }
    }

    layout()
    started = performance.now()
    raf = requestAnimationFrame(frame)
    const ro = new ResizeObserver(() => layout())
    ro.observe(root)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [run, colorKey, folds, seed])

  // After the gust: open the gate (or replay the showcase).
  React.useEffect(() => {
    if (phase !== "open") return
    const t = setTimeout(() => {
      if (loop) {
        replay()
        return
      }
      setPhase("done")
      onCompleteRef.current?.()
    }, loop ? 900 : OPEN_MS)
    return () => clearTimeout(t)
  }, [phase, loop])

  const replay = () => {
    rushRef.current = false
    setPct(0)
    setPhase("draw")
    setRun((r) => r + 1)
  }

  const onActivate = () => {
    if (phaseRef.current === "draw") rushRef.current = true
    else if (loop && (phaseRef.current === "hold" || phaseRef.current === "clear")) replay()
  }

  const done = phase === "done"
  const showGate = loop || !done
  const count = (pct < 10 ? "00" : pct < 100 ? "0" : "") + pct

  return (
    <div
      ref={rootRef}
      className={"rgp-root " + className}
      style={
        {
          height,
          "--rgp-floor": colors.floor,
          "--rgp-type": typeColor,
          "--rgp-serif": serifFamily,
          "--rgp-mono": monoFamily,
        } as React.CSSProperties
      }
    >
      {loop ? null : children}
      {showGate ? (
        <div
          className="rgp-gate"
          data-phase={loop && phase === "open" ? "clear" : phase}
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          tabIndex={0}
          onClick={onActivate}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onActivate()
            }
          }}
        >
          <canvas ref={canvasRef} aria-hidden="true" />
          {hud ? (
            <>
              <div className="rgp-corner rgp-tr" aria-hidden="true">
                <span>{meta}</span>
              </div>
              <div className="rgp-corner rgp-br" aria-hidden="true">
                <span className="rgp-count">{count}%</span>
              </div>
            </>
          ) : null}
          {message ? (
            <div className="rgp-close" aria-hidden={phase === "draw"}>
              {blessing ? <span className="rgp-blessing">{blessing}</span> : null}
              <p className="rgp-message">{message}</p>
              {loop ? <span className="rgp-replay">Click to replay</span> : null}
            </div>
          ) : null}
          <span className="rgp-sr" aria-live="polite">
            {phase === "draw" ? "" : message || "Loaded"}
          </span>
        </div>
      ) : null}
    </div>
  )
}
