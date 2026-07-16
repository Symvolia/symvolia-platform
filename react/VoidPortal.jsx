/**
 * VoidPortal — "dive into the void" transition.
 *
 * Stack:
 *   - React (hooks)
 *   - Tailwind CSS (utility classes)
 *   - framer-motion (animation orchestration)
 *
 * Behaviour:
 *   - Renders an initial button.
 *   - On click, plays a 2.5s "dive into the void" animation:
 *       · particles / sfumature converging toward the center
 *       · an expanding purple vortex
 *       · a gradient morphing from black → purple → white
 *       · depth (scale + blur) so it feels like sinking
 *       · pulsing purple glow
 *   - Click again to reverse the animation back to the initial state.
 *
 * Palette: #000000 · #4a148c · #7c3aed · #ffffff
 *
 * Requirements to run:
 *   npm i framer-motion
 *   + Tailwind CSS configured in the host app.
 *
 * Usage:
 *   import VoidPortal from "./VoidPortal";
 *   <VoidPortal label="Sound Archive" onEnter={() => {}} onExit={() => {}}>
 *     <YourRevealedContent />
 *   </VoidPortal>
 */

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Total dive duration in seconds (kept in the 2–3s range).
const DIVE_SECONDS = 2.5;

// Deterministic-enough particle field generated once per mount.
function useParticles(count = 30) {
  return useMemo(
    () =>
      Array.from({ length: count }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 32 + Math.random() * 58; // vmax from center
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          size: 3 + Math.random() * 6,
          delay: Math.random() * 0.45,
        };
      }),
    [count]
  );
}

export default function VoidPortal({
  label = "Enter the Void",
  sublabel = "Click to dive in",
  onEnter,
  onExit,
  children,
}) {
  // `open` drives both the overlay visibility and the revealed content.
  const [open, setOpen] = useState(false);
  // `diving` is true while the transition animation is playing (locks clicks).
  const [diving, setDiving] = useState(false);
  const particles = useParticles();

  const toggle = () => {
    if (diving) return;
    setDiving(true);
    if (open) onExit?.();
    else onEnter?.();
    setOpen((v) => !v);
    // Release the lock once the dive finishes.
    window.setTimeout(() => setDiving(false), DIVE_SECONDS * 1000);
  };

  return (
    <div className="relative w-full">
      {/* ── Initial button ── */}
      {!open && (
        <div className="flex justify-center py-8">
          <motion.button
            type="button"
            onClick={toggle}
            whileHover={{ scale: 1.02, y: -3 }}
            whileTap={{ scale: 0.98 }}
            className="relative flex min-h-[13rem] w-[min(88vw,30rem)] flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-violet-500/30 bg-[radial-gradient(120%_120%_at_50%_40%,rgba(74,20,140,0.28)_0%,rgba(8,5,12,0.9)_62%,rgba(2,1,3,0.96)_100%)] px-8 py-10 text-white shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
          >
            {/* Pulsing purple aura */}
            <motion.span
              aria-hidden
              className="pointer-events-none absolute -inset-x-10 -inset-y-16 -z-10 rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.45)_0%,rgba(74,20,140,0.18)_38%,transparent_70%)] blur-2xl"
              animate={{ opacity: [0.4, 0.75, 0.4], scale: [1, 1.08, 1] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Rotating ring */}
            <motion.span
              aria-hidden
              className="pointer-events-none absolute -z-10 h-36 w-36 rounded-full border border-violet-500/35 shadow-[inset_0_0_40px_rgba(124,58,237,0.25)]"
              animate={{ rotate: 360 }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            />
            <span className="font-serif text-3xl italic tracking-widest [text-shadow:0_0_26px_rgba(124,58,237,0.5)]">
              {label}
            </span>
            <span className="font-serif text-xs italic uppercase tracking-[0.24em] text-white/70">
              {sublabel}
            </span>
          </motion.button>
        </div>
      )}

      {/* ── Revealed content (after the dive) ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0, transition: { delay: DIVE_SECONDS * 0.5, duration: 0.8 } }}
            exit={{ opacity: 0, y: 24, transition: { duration: 0.4 } }}
          >
            <div className="mb-6 flex justify-end">
              <motion.button
                type="button"
                onClick={toggle}
                whileHover={{ rotate: 90 }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-violet-500/30 bg-black/50 text-white/85"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5">
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    d="M6 6l12 12M18 6L6 18"
                  />
                </svg>
              </motion.button>
            </div>
            {children}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Void dive overlay ── */}
      <AnimatePresence>
        {diving && (
          <motion.div
            key="void"
            className="fixed inset-0 z-[250] grid place-items-center overflow-hidden bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: DIVE_SECONDS, times: [0, 0.12, 0.8, 1], ease: "easeInOut" }}
          >
            {/* Depth gradient: black → purple → white, scaling toward the viewer */}
            <motion.div
              className="absolute h-[120vmax] w-[120vmax] rounded-full"
              style={{
                background:
                  "radial-gradient(circle at center,#ffffff 0%,#7c3aed 16%,#4a148c 40%,#150a24 62%,#000 78%)",
              }}
              initial={{ scale: open ? 3.6 : 0.12, rotate: 0, filter: "blur(16px)", opacity: 0 }}
              animate={{
                scale: open ? 0.12 : 3.6,
                rotate: open ? 0 : 40,
                filter: open ? "blur(16px)" : "blur(3px)",
                opacity: 1,
              }}
              transition={{ duration: DIVE_SECONDS, ease: "easeInOut" }}
            />

            {/* Expanding purple vortex */}
            <motion.div
              className="absolute h-[100vmax] w-[100vmax] rounded-full mix-blend-screen"
              style={{
                background:
                  "conic-gradient(from 0deg,transparent 0deg,rgba(124,58,237,0.55) 40deg,transparent 90deg,rgba(74,20,140,0.6) 150deg,transparent 200deg,rgba(124,58,237,0.5) 270deg,transparent 320deg,rgba(74,20,140,0.55) 360deg)",
              }}
              initial={{ scale: open ? 2.9 : 0.2, rotate: open ? 460 : 0, opacity: open ? 0.12 : 0 }}
              animate={{ scale: open ? 0.2 : 2.9, rotate: open ? 0 : 460, opacity: [0, 0.95, 0.12] }}
              transition={{ duration: DIVE_SECONDS, ease: [0.4, 0, 0.2, 1] }}
            />

            {/* Pulsing purple glow */}
            <motion.div
              className="absolute h-[40vmax] w-[40vmax] rounded-full mix-blend-screen blur-3xl"
              style={{
                background:
                  "radial-gradient(circle at center,rgba(124,58,237,0.9) 0%,rgba(74,20,140,0.35) 45%,transparent 72%)",
              }}
              animate={{ opacity: [0.35, 0.85, 0.35], scale: [1, 1.3, 1] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Bright core: the point you sink into */}
            <motion.div
              className="absolute h-[8vmax] w-[8vmax] rounded-full shadow-[0_0_60px_rgba(255,255,255,0.5),0_0_120px_rgba(124,58,237,0.6)]"
              style={{
                background:
                  "radial-gradient(circle at center,#ffffff 0%,#d8b4fe 30%,#7c3aed 60%,transparent 78%)",
              }}
              initial={{ scale: open ? 7 : 0, opacity: 0 }}
              animate={{ scale: open ? 0 : [0, 1, 7], opacity: [0, 1, 0] }}
              transition={{ duration: DIVE_SECONDS, ease: [0.65, 0, 0.35, 1] }}
            />

            {/* Particles converging toward (or exploding from) the center */}
            {particles.map((p, i) => (
              <motion.span
                key={i}
                className="absolute rounded-full"
                style={{
                  width: p.size,
                  height: p.size,
                  background:
                    "radial-gradient(circle at center,#ffffff 0%,#7c3aed 55%,transparent 100%)",
                }}
                initial={{ x: open ? 0 : `${p.x}vmax`, y: open ? 0 : `${p.y}vmax`, scale: open ? 0.15 : 1, opacity: 0 }}
                animate={{
                  x: open ? `${p.x}vmax` : 0,
                  y: open ? `${p.y}vmax` : 0,
                  scale: open ? 1 : 0.15,
                  opacity: [0, 1, 0],
                }}
                transition={{ duration: DIVE_SECONDS, delay: p.delay, ease: [0.5, 0, 0.3, 1] }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
