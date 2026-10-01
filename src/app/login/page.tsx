"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./login.module.css";

// Students are split across more than one college domain, so this is a list.
// A courtesy check only: the same rule belongs in Postgres too, because anyone
// can bypass client-side JavaScript.
const COLLEGE_DOMAINS = (process.env.NEXT_PUBLIC_COLLEGE_EMAIL_DOMAINS ?? "eastpoint.ac.in,epcet.ac.in")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

// The one students see in the placeholder and the first completion chip.
const PRIMARY_DOMAIN = COLLEGE_DOMAINS[0];

function listDomains(domains: string[]) {
  if (domains.length === 1) return `@${domains[0]}`;
  return domains.map((d) => `@${d}`).slice(0, -1).join(", ") + ` or @${domains.at(-1)}`;
}

type Theme = "light" | "dark";
type Notice = { kind: "error" | "ok"; text: string } | null;

/** Deterministic PRNG, so the weave is a designed object rather than a
 *  different picture on every visit. */
function seeded(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function LoginPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const brandRef = useRef<HTMLElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [theme, setTheme] = useState<Theme>("light");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [badField, setBadField] = useState<"email" | "password" | null>(null);
  const [shaking, setShaking] = useState(false);

  /* ---------------- woven background ---------------- */

  const drawWeave = useCallback(() => {
    const cv = canvasRef.current;
    const brand = brandRef.current;
    if (!cv || !brand) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = brand.getBoundingClientRect();
    const size = Math.ceil(Math.max(r.width, r.height) * 1.6) || 900;

    cv.width = size * dpr;
    cv.height = size * dpr;
    cv.style.width = cv.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cs = getComputedStyle(document.documentElement);
    const rgb = cs.getPropertyValue("--weave").trim();
    const base = parseFloat(cs.getPropertyValue("--weave-alpha")) || 0.3;

    const rnd = seeded(20260929);
    const cx = size / 2;
    const cy = size / 2;
    ctx.lineCap = "round";

    const strand = (
      count: number,
      minR: number,
      spanR: number,
      widthBase: number,
      widthVar: number,
      alphaMin: number,
      alphaVar: number,
      bowScale: number,
      steps: number,
    ) => {
      for (let i = 0; i < count; i++) {
        const start = rnd() * Math.PI * 2;
        const radius = minR + rnd() * spanR;
        const span = 0.45 + rnd() * 1.7;
        const bow = (rnd() - 0.5) * size * bowScale; // twigs aren't perfect arcs
        ctx.beginPath();
        ctx.lineWidth = widthBase + rnd() * widthVar;
        ctx.strokeStyle = `rgba(${rgb},${base * (alphaMin + rnd() * alphaVar)})`;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const th = start + span * t;
          const rr = radius + Math.sin(t * Math.PI) * bow;
          const x = cx + Math.cos(th) * rr;
          const y = cy + Math.sin(th) * rr * 0.86; // slightly elliptical, like a real nest
          if (s) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    };

    // the wall of the nest
    strand(240, size * 0.14, size * 0.34, 0.45, 1.45, 0.28, 0.72, 0.055, 30);
    // and its floor — a nest is woven across the middle, not left hollow
    strand(70, 0, size * 0.15, 0.35, 0.85, 0.14, 0.28, 0.04, 24);
  }, []);

  /* ---------------- theme ---------------- */

  useEffect(() => {
    const stamped = document.documentElement.getAttribute("data-theme") as Theme | null;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
    setTheme(stamped ?? (systemDark.matches ? "dark" : "light"));

    // follow the OS only while no choice has been pinned
    const onSystem = () => {
      if (!document.documentElement.getAttribute("data-theme")) {
        setTheme(systemDark.matches ? "dark" : "light");
      }
    };
    systemDark.addEventListener("change", onSystem);
    return () => systemDark.removeEventListener("change", onSystem);
  }, []);

  useEffect(() => {
    drawWeave();
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(drawWeave, 180);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [drawWeave, theme]); // the weave colour is theme-dependent

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("nest-theme", next);
    } catch {
      /* private window, blocked storage — the theme just won't persist */
    }
    setTheme(next);
  };

  /* ---------------- form ---------------- */

  const fail = (text: string, field: "email" | "password") => {
    setNotice({ kind: "error", text });
    setBadField(field);
    setShaking(false);
    requestAnimationFrame(() => setShaking(true));
    (field === "email" ? emailRef : passwordRef).current?.focus();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setBadField(null);

    const v = email.trim().toLowerCase();
    if (!v || !password) return fail("Enter your college email and password.", v ? "password" : "email");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return fail("That doesn't look like an email address.", "email");
    if (!COLLEGE_DOMAINS.some((d) => v.endsWith(`@${d}`)))
      return fail(`Use your college email — it ends in ${listDomains(COLLEGE_DOMAINS)}.`, "email");

    setBusy(true);
    const { error } = await createClient().auth.signInWithPassword({ email: v, password });
    setBusy(false);

    if (error) {
      // Deliberately vague: saying which half was wrong tells an attacker
      // which addresses are real accounts.
      return fail(
        error.message === "Invalid login credentials"
          ? "That email and password don't match."
          : error.message,
        "password",
      );
    }

    router.push("/dashboard");
    router.refresh(); // let the server re-read the new session cookie
  };

  const showHint = email.trim().length > 1 && !email.includes("@");
  const dark = theme === "dark";

  return (
    <div className={styles.page}>
      {/* ============ BRAND ============ */}
      <section className={styles.brand} ref={brandRef}>
        <canvas className={styles.weave} ref={canvasRef} aria-hidden="true" />

        <Image
          className={styles.logo}
          src="/nest-logo.png"
          alt="NEST — Nurturing Education and Student Tracking"
          width={274}
          height={246}
          priority
        />

        <h2 className={styles.statement}>
          Every class, every mark, every student — <em>in one place.</em>
        </h2>

        <p className={styles.brandFoot}>© 2026 NEST</p>
      </section>

      {/* ============ FORM ============ */}
      <section className={styles.side}>
        <button
          type="button"
          className={styles.theme}
          onClick={toggleTheme}
          aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
          title={dark ? "Light theme" : "Dark theme"}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {dark ? (
              <>
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4 17 7M7 17l-1.6 1.6M18.6 18.6 17 17M7 7 5.4 5.4" />
              </>
            ) : (
              <path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1Z" />
            )}
          </svg>
        </button>

        <div className={`${styles.formWrap} ${shaking ? styles.shake : ""}`}>
          <h1 className={`${styles.title} ${styles.rise}`}>Sign in</h1>
          <p className={`${styles.lede} ${styles.rise} ${styles.d1}`}>Welcome back.</p>

          <form className={styles.form} onSubmit={onSubmit} noValidate>
            {notice && (
              <div
                className={`${styles.alert} ${notice.kind === "ok" ? styles.ok : ""}`}
                role="alert"
                aria-live="polite"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 4.4v4.3M8 11.2v.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span>{notice.text}</span>
              </div>
            )}

            <div className={`${styles.field} ${styles.rise} ${styles.d1}`}>
              <label htmlFor="email">College email</label>
              <div className={styles.control}>
                <input
                  ref={emailRef}
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (badField === "email") {
                      setBadField(null);
                      setNotice(null);
                    }
                  }}
                  placeholder={`you@${PRIMARY_DOMAIN}`}
                  autoComplete="username"
                  spellCheck={false}
                  autoCapitalize="off"
                  aria-invalid={badField === "email"}
                  required
                />
              </div>
              {showHint && (
                <p className={styles.hint}>
                  {/* One chip per domain — auto-picking would be wrong for a third
                      of students, since the domain depends on their semester. */}
                  {COLLEGE_DOMAINS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setEmail(`${email.trim()}@${d}`);
                        passwordRef.current?.focus();
                      }}
                    >
                      @{d}
                    </button>
                  ))}
                </p>
              )}
            </div>

            <div className={`${styles.field} ${styles.rise} ${styles.d2}`}>
              <label htmlFor="password">Password</label>
              <div className={`${styles.control} ${styles.hasToggle}`}>
                <input
                  ref={passwordRef}
                  type={revealed ? "text" : "password"}
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  // caps lock is the most common cause of a "wrong password" that isn't one
                  onKeyUp={(e) => setCapsOn(e.getModifierState?.("CapsLock") ?? false)}
                  onKeyDown={(e) => setCapsOn(e.getModifierState?.("CapsLock") ?? false)}
                  onBlur={() => setCapsOn(false)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-invalid={badField === "password"}
                  required
                />
                <button
                  type="button"
                  className={styles.reveal}
                  onClick={() => {
                    setRevealed((r) => !r);
                    passwordRef.current?.focus();
                  }}
                  aria-label={revealed ? "Hide password" : "Show password"}
                >
                  {revealed ? "Hide" : "Show"}
                </button>
              </div>
              {capsOn && (
                <p className={styles.caps} aria-live="polite">
                  <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M8 2 L14 8 H11 V13 H5 V8 H2 Z" fill="currentColor" />
                  </svg>
                  Caps Lock is on
                </p>
              )}
            </div>

            <div className={`${styles.row} ${styles.rise} ${styles.d3}`}>
              <label className={styles.remember}>
                <input type="checkbox" name="remember" />
                Keep me signed in
              </label>
              <a href="#">Forgot password?</a>
            </div>

            <button
              type="submit"
              className={`${styles.submit} ${styles.rise} ${styles.d4}`}
              disabled={busy}
              aria-busy={busy}
            >
              {busy && <span className={styles.spinner} aria-hidden="true" />}
              {busy ? "Signing in" : "Log in"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
