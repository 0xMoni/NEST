"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import type { Me } from "@/lib/session";
import type { ResumeReviewData } from "@/app/api/ai/resume/schemas";
import styles from "./resume.module.css";

const ROLE_CHIPS = [
  "Full Stack Developer",
  "Frontend Engineer (React / Next.js)",
  "Backend Engineer (Python / Java / Node)",
  "Cloud & DevOps Engineer",
  "AI / ML & Data Science Engineer",
  "Product Engineering Intern",
];

const SAMPLE_STUDENT_RESUME = `ROHAN SHARMA
Bengaluru, India | rohan.sharma@gmail.com | +91 9876543210 | github.com/rohansharma

CAREER OBJECTIVE
Hardworking and passionate 5th semester Computer Science student looking for an entry-level software engineering internship in a challenging environment to utilize my technical skills and learn new technologies.

EDUCATION
• East Point College of Engineering & Technology, Bengaluru
  B.E. in Computer Science & Engineering (2021 – 2025)
  CGPA: 7.9 / 10.0
• St. Joseph's Pre-University College (2021) — 84%

TECHNICAL SKILLS
• Programming: Java, Python, C++, JavaScript
• Web Technologies: React, HTML5, CSS3, Node.js, Express
• Databases: MySQL, MongoDB
• Tools: Git, VS Code, Postman

PROJECTS
• Online Book Store Website
  - Built an online bookstore web application using React.js and Node.js.
  - Designed the user login page, product catalog, and shopping cart.
  - Used MongoDB to store books and order details.
  - Worked with friends in a 3-member team to finish the college project.

• Student Attendance Management System
  - Created a desktop app using Python and SQLite to take attendance for classes.
  - Added buttons for marking student present or absent.
  - Tested application and fixed various bugs reported by college teachers.

• Weather Forecast App
  - Simple React application fetching data from OpenWeatherMap public API.
  - Shows current temperature, humidity, and weather conditions.

EXPERIENCE
• Web Development Intern — ABC Softwares (1 Month, June 2024)
  - Assisted senior software engineers in everyday front-end bugs.
  - Learned about React component hierarchy and Agile practices.
  - Documented API endpoints in Postman.

EXTRA-CURRICULAR
• Member of College Coding Club
• Participated in Intra-college Hackathon 2023
• Volunteer for Annual Cultural Fest`;

export function ResumeClient({ me }: { me: Me }) {
  const [tab, setTab] = useState<"upload" | "paste">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [targetRole, setTargetRole] = useState("Full Stack Developer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResumeReviewData | null>(null);
  const [checkedTasks, setCheckedTasks] = useState<Record<number, boolean>>({});
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    setError(null);

    if (tab === "upload" && !file && !resumeText) {
      setError("Please select a PDF/text file or paste your resume content.");
      return;
    }

    if (tab === "paste" && resumeText.trim().length < 50) {
      setError("Please paste a more complete resume (at least 50 characters).");
      return;
    }

    setLoading(true);

    try {
      let res: Response;

      if (tab === "upload" && file) {
        const formData = new FormData();
        formData.append("resume_file", file);
        formData.append("target_role", targetRole);
        formData.append("candidate_name", me.full_name);
        if (resumeText) formData.append("resume_text", resumeText);

        res = await fetch("/api/ai/resume", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/ai/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resume_text: resumeText,
            target_role: targetRole,
            candidate_name: me.full_name,
          }),
        });
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze resume.");
      }

      setResult(data.data);
      setCheckedTasks({});
      // Scroll to results
      setTimeout(() => {
        window.scrollTo({ top: 400, behavior: "smooth" });
      }, 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const loadSample = () => {
    setTab("paste");
    setResumeText(SAMPLE_STUDENT_RESUME);
    setTargetRole("Full Stack Developer");
    setError(null);
  };

  const toggleCheck = (idx: number) => {
    setCheckedTasks((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const completedCount = Object.values(checkedTasks).filter(Boolean).length;
  const totalTasks = result?.action_checklist.length || 0;
  const checklistPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  // Score badge helper
  const getBadgeClass = (score: number) => {
    if (score >= 85) return styles.badgeEmerald;
    if (score >= 70) return styles.badgeTeal;
    if (score >= 50) return styles.badgeAmber;
    return styles.badgeRose;
  };

  const getMetricFillColor = (score: number) => {
    if (score >= 80) return "#10b981";
    if (score >= 65) return "#3b82f6";
    if (score >= 45) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className={styles.wrap}>
      {/* ---------------- INPUT CARD ---------------- */}
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.h2}>Upload or Paste Your Resume</h2>
          <p className={styles.hint}>
            Our AI recruiter evaluates your resume across ATS parsability, impact metrics, vocabulary, and market placement package potential.
          </p>
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tabBtn} ${tab === "upload" ? styles.tabBtnActive : ""}`}
            onClick={() => setTab("upload")}
          >
            Upload Document (PDF / TXT)
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${tab === "paste" ? styles.tabBtnActive : ""}`}
            onClick={() => setTab("paste")}
          >
            Paste Resume Text
          </button>
        </div>

        {tab === "upload" ? (
          <div>
            {!file ? (
              <div
                className={`${styles.dropzone} ${isDragOver ? styles.dropzoneActive : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  accept=".pdf,.txt,.md"
                  onChange={handleFileChange}
                />
                <span className={styles.dropIcon}>📄</span>
                <p className={styles.dropTitle}>Click to browse or drag and drop your resume file</p>
                <p className={styles.dropSub}>PDF, TXT, or Markdown (under 10 MB)</p>
              </div>
            ) : (
              <div className={styles.filePreview}>
                <span className={styles.fileName}>
                  📎 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </span>
                <button
                  type="button"
                  className={styles.fileRemove}
                  onClick={() => setFile(null)}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        ) : (
          <textarea
            className={styles.textarea}
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Paste your complete resume text here (Education, Projects, Skills, Experience, Contact)..."
          />
        )}

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Target Role / Placement Track</label>
          <input
            className={styles.input}
            type="text"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="e.g. Full Stack Developer, Backend Engineer, Cloud Intern..."
          />
          <div className={styles.roleChips}>
            {ROLE_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                className={`${styles.chip} ${targetRole === chip ? styles.chipActive : ""}`}
                onClick={() => setTargetRole(chip)}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {error && <div className={styles.errorAlert}>{error}</div>}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleAnalyze}
            disabled={loading}
          >
            {loading ? (
              <>
                <span>Analyzing with Groq AI...</span>
              </>
            ) : (
              <>
                <span>🚀 Run In-Depth ATS Review</span>
              </>
            )}
          </button>

          <button type="button" className={styles.sampleBtn} onClick={loadSample}>
            Try Sample College Resume
          </button>
        </div>
      </section>

      {/* ---------------- RESULTS DASHBOARD ---------------- */}
      {result && (
        <div className={styles.reportWrap}>
          {/* 1. HERO OVERALL SCORE CARD */}
          <section className={styles.heroCard}>
            <div className={styles.gaugeBlock}>
              <div
                className={styles.gaugeCircle}
                style={
                  {
                    "--score-deg": `${(result.overall_score / 100) * 360}deg`,
                  } as React.CSSProperties
                }
              >
                <div className={styles.gaugeInner}>
                  <span className={styles.gaugeScore}>{result.overall_score}</span>
                  <span className={styles.gaugeMax}>/ 100</span>
                </div>
              </div>
              <span className={`${styles.badgePill} ${getBadgeClass(result.overall_score)}`}>
                {result.score_badge}
              </span>
            </div>

            <div className={styles.heroContent}>
              <p className={styles.heroCandidate}>
                {result.candidate_name} · {result.target_role}
              </p>
              <h1 className={styles.heroTitle}>
                {result.overall_score >= 80
                  ? "Top-Tier Competitive Profile"
                  : result.overall_score >= 65
                  ? "Strong Foundation with Clear Upgrades"
                  : "Promising Raw Material — Needs Key Fixes"}
              </h1>
              <p className={styles.heroSummary}>{result.summary_critique}</p>

              <div className={styles.heroActions}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => window.print()}
                >
                  🖨️ Print / Save PDF Report
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => {
                    setResult(null);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  🔄 Analyze Another Resume
                </button>
              </div>
            </div>
          </section>

          {/* 2. FOUR SUB-PILLARS METRICS */}
          <section className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricTop}>
                <span className={styles.metricName}>ATS Parsability &amp; Format</span>
                <span className={styles.metricScore}>{result.metrics.ats_formatting.score}%</span>
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${result.metrics.ats_formatting.score}%`,
                    backgroundColor: getMetricFillColor(result.metrics.ats_formatting.score),
                  }}
                />
              </div>
              <p className={styles.metricFeedback}>{result.metrics.ats_formatting.feedback}</p>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricTop}>
                <span className={styles.metricName}>Content &amp; Engineering Depth</span>
                <span className={styles.metricScore}>{result.metrics.content_impact.score}%</span>
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${result.metrics.content_impact.score}%`,
                    backgroundColor: getMetricFillColor(result.metrics.content_impact.score),
                  }}
                />
              </div>
              <p className={styles.metricFeedback}>{result.metrics.content_impact.feedback}</p>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricTop}>
                <span className={styles.metricName}>Keyword Depth &amp; Match</span>
                <span className={styles.metricScore}>{result.metrics.keyword_depth.score}%</span>
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${result.metrics.keyword_depth.score}%`,
                    backgroundColor: getMetricFillColor(result.metrics.keyword_depth.score),
                  }}
                />
              </div>
              <p className={styles.metricFeedback}>{result.metrics.keyword_depth.feedback}</p>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricTop}>
                <span className={styles.metricName}>Quantified Metrics &amp; Scale</span>
                <span className={styles.metricScore}>{result.metrics.quantified_results.score}%</span>
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${result.metrics.quantified_results.score}%`,
                    backgroundColor: getMetricFillColor(result.metrics.quantified_results.score),
                  }}
                />
              </div>
              <p className={styles.metricFeedback}>{result.metrics.quantified_results.feedback}</p>
            </div>
          </section>

          {/* 3. PLACEMENT PACKAGE & CTC BRACKET PREDICTION */}
          <section className={styles.packageSection}>
            <div className={styles.cardHead}>
              <h2 className={styles.h2}>💰 Market Placement Package Potential</h2>
              <p className={styles.hint}>
                Algorithmic projection of what annual package (LPA) your demonstrated skills and projects can command right now vs. with our targeted upgrades.
              </p>
            </div>

            <div className={styles.packageGrid}>
              <div className={styles.packageCardCurrent}>
                <span className={styles.packageBadgeCurrent}>Current Placement Value</span>
                <div className={styles.packageAmount}>{result.package_prediction.current_bracket}</div>
                <div className={styles.packageTier}>Target Tier: {result.package_prediction.current_tier}</div>
                <p className={styles.packageDesc}>{result.package_prediction.current_rationale}</p>
              </div>

              <div className={styles.packageCardPotential}>
                <span className={styles.packageBadgePotential}>Potential Unlocked Bracket</span>
                <div className={styles.packagePotentialAmount}>
                  {result.package_prediction.potential_bracket}
                </div>
                <div className={styles.packageTier}>
                  Target Tier: {result.package_prediction.potential_tier}
                </div>
                <p className={styles.packageDesc}>
                  <b>How to bridge this salary jump:</b>
                </p>
                <ul className={styles.unlockList}>
                  {result.package_prediction.unlock_requirements.map((req, i) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* 4. VISUAL MARKET COMPARISON (WITH 2 COMPARISON GRAPHICS) */}
          <section className={styles.visualSection}>
            <div className={styles.cardHead}>
              <h2 className={styles.h2}>Visual Comparison: Average Resume vs. Top 1% Market Benchmark</h2>
              <p className={styles.hint}>
                See exactly why average resumes get filtered out by ATS algorithms and how FAANG-caliber resumes structure their impact, single-column hierarchy, and verified links.
              </p>
            </div>

            <div className={styles.imageGrid}>
              <div className={styles.imageCard}>
                <div className={styles.imageHeader}>
                  <span className={styles.imageTitle}>❌ Typical Average College Resume</span>
                  <span className={`${styles.badgePill} ${styles.badgeRose}`}>Score: 44/100</span>
                </div>
                <div className={styles.imageWrapper}>
                  <Image
                    src="/resume-average.svg"
                    alt="Average college resume showing common ATS red flags"
                    width={700}
                    height={920}
                    priority
                  />
                </div>
              </div>

              <div className={styles.imageCard}>
                <div className={styles.imageHeader}>
                  <span className={styles.imageTitle}>✅ Top 1% Shortlisted Market Benchmark</span>
                  <span className={`${styles.badgePill} ${styles.badgeEmerald}`}>Score: 98/100</span>
                </div>
                <div className={styles.imageWrapper}>
                  <Image
                    src="/resume-benchmark.svg"
                    alt="Top 1% benchmark resume showing single-column ATS layout and X-Y-Z formula"
                    width={700}
                    height={920}
                    priority
                  />
                </div>
              </div>
            </div>

            {/* Gap Analysis Table */}
            <div>
              <h3 style={{ fontSize: "1.1rem", margin: "16px 0 8px 0", color: "var(--ink)" }}>
                Detailed Structural Gap Breakdown
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table className={styles.comparisonTable}>
                  <thead>
                    <tr>
                      <th>Aspect</th>
                      <th>Your Resume</th>
                      <th>Top 1% Standard</th>
                      <th>Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.market_comparison.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <b>{item.aspect}</b>
                        </td>
                        <td style={{ color: "var(--ink-2)" }}>{item.your_resume}</td>
                        <td style={{ color: "var(--ink)" }}>{item.top_1_percent_standard}</td>
                        <td>
                          <span
                            className={`${styles.badgePill} ${
                              item.gap_severity === "Critical"
                                ? styles.badgeRose
                                : item.gap_severity === "Moderate"
                                ? styles.badgeAmber
                                : styles.badgeEmerald
                            }`}
                          >
                            {item.gap_severity}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* 5. STRENGTHS & LOOPHOLES */}
          <div className={styles.twoColGrid}>
            <div className={styles.strengthCard}>
              <h2 className={styles.h2} style={{ color: "#065f46" }}>
                🌟 Strong Points &amp; Competitive Edges
              </h2>
              {result.strong_points.map((sp, idx) => (
                <div key={idx} className={styles.itemBlock}>
                  <div className={styles.itemTitle}>
                    <span>{sp.title}</span>
                    <span className={styles.itemTag}>{sp.tag}</span>
                  </div>
                  <p className={styles.itemDesc}>{sp.description}</p>
                </div>
              ))}
            </div>

            <div className={styles.loopholeCard}>
              <h2 className={styles.h2} style={{ color: "#991b1b" }}>
                🔍 Loopholes &amp; Missing Scope
              </h2>
              {result.loopholes.map((lh, idx) => (
                <div key={idx} className={styles.itemBlock}>
                  <div className={styles.itemTitle}>
                    <span>{lh.loophole}</span>
                    <span className={styles.itemTagWarn}>Loophole</span>
                  </div>
                  <p className={styles.itemDesc}>
                    <b>Why recruiters flag this:</b> {lh.why_it_matters}
                  </p>
                  <div className={styles.howToFix}>
                    <b>Fix:</b> {lh.how_to_fix}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 6. VOCABULARY & GOOGLE X-Y-Z BULLET POINT REWRITES */}
          <section className={styles.vocabSection}>
            <div className={styles.cardHead}>
              <h2 className={styles.h2}>⚡ High-Impact Vocabulary &amp; Bullet Rewrites</h2>
              <p className={styles.hint}>
                Transform passive student phrasing into active engineering leadership statements using Google&apos;s proven X-Y-Z framework.
              </p>
            </div>

            <div>
              <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
                Passive / Overused Words Detected in Your Resume:
              </p>
              <div className={styles.buzzwordsWrap}>
                {result.word_analysis.overused_buzzwords.map((w, idx) => (
                  <span key={idx} className={styles.buzzword}>
                    {w}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
                High-Impact Bullet Point Transformations:
              </p>
              <div className={styles.rewriteGrid}>
                {result.word_analysis.bullet_rewrites.map((rw, idx) => (
                  <div key={idx} className={styles.rewriteCard}>
                    <div className={styles.rewriteRow}>
                      <span className={styles.rewriteLabelBefore}>Original</span>
                      <span className={styles.rewriteTextBefore}>&ldquo;{rw.original_bullet}&rdquo;</span>
                    </div>
                    <div className={styles.rewriteRow}>
                      <span className={styles.rewriteLabelAfter}>Rewritten</span>
                      <span className={styles.rewriteTextAfter}>&ldquo;{rw.rewritten_bullet}&rdquo;</span>
                    </div>
                    <div className={styles.rewriteMeta}>
                      <span>
                        <b>Framework:</b> {rw.formula_applied}
                      </span>
                      <span>·</span>
                      <span>{rw.why_it_wins}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 7. SECTION-BY-SECTION IMPROVEMENT AREAS */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.h2}>🛠️ Section-by-Section Improvement Plan</h2>
              <p className={styles.hint}>Specific architectural guidance for each part of your resume.</p>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              {result.improvement_areas.map((area, idx) => (
                <div key={idx} className={styles.itemBlock}>
                  <div className={styles.itemTitle}>
                    <span>{area.section}</span>
                  </div>
                  <p className={styles.itemDesc}>
                    <span style={{ color: "#b91c1c", fontWeight: 600 }}>Current Issue:</span> {area.critique}
                  </p>
                  <p className={styles.itemDesc} style={{ color: "var(--ink)" }}>
                    <span style={{ color: "#047857", fontWeight: 600 }}>Action Plan:</span> {area.action_plan}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* 8. 48-HOUR QUICK WINS CHECKLIST */}
          <section className={styles.checklistSection}>
            <div className={styles.cardHead}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 className={styles.h2}>⏱️ 48-Hour Action Checklist</h2>
                <span className={styles.badgePill} style={{ background: "var(--field-2)", color: "var(--ink)" }}>
                  {completedCount} of {totalTasks} completed ({checklistPercent}%)
                </span>
              </div>
              <p className={styles.hint}>
                Check off each item as you edit your resume document. Completing these 5 items typically raises an ATS score by 15–25 points.
              </p>
              <div className={styles.progressBar} style={{ height: 8, marginTop: 4 }}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${checklistPercent}%`, backgroundColor: "#10b981" }}
                />
              </div>
            </div>

            <div className={styles.checklistGrid}>
              {result.action_checklist.map((task, idx) => {
                const isChecked = Boolean(checkedTasks[idx]);
                return (
                  <label key={idx} className={styles.checkItem} onClick={() => toggleCheck(idx)}>
                    <input
                      type="checkbox"
                      className={styles.checkInput}
                      checked={isChecked}
                      onChange={() => toggleCheck(idx)}
                    />
                    <span className={`${styles.checkText} ${isChecked ? styles.checkDone : ""}`}>
                      {task}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* 9. MOTIVATIONAL BOOST */}
          <section className={styles.motivationCard}>
            <p className={styles.motivationTitle}>A Word From Your Mentors</p>
            <p className={styles.motivationQuote}>&ldquo;{result.motivation_boost}&rdquo;</p>
          </section>
        </div>
      )}
    </div>
  );
}
