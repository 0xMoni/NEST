"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { 
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  Check,
  ChevronRight
} from "lucide-react";
import { QuizData } from "@/app/api/ai/roadmap/schemas";
import styles from "./quiz.module.css";

const SUGGESTED_TOPICS = [
  "PYTHON ADVANCED FEATURES",
  "REACT SERVER COMPONENTS",
  "LINEAR ALGEBRA DEPTH",
  "SYSTEM ARCHITECTURE & CACHING",
  "DATABASE INDEXING & LOCKS",
];

const QUESTION_LIMIT_SECONDS = 30;

export function QuizClient() {
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active examination state
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Assessment results
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_LIMIT_SECONDS);
  const [answersLog, setAnswersLog] = useState<{ selected: number | null; correct: number }[]>([]);
  const [completed, setCompleted] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTimeOut = useCallback(() => {
    setShowResult(true);
    setSelectedOption(null);
    setAnswersLog((prev) => [
      ...prev,
      { selected: null, correct: quiz?.questions[currentIndex].correct_answer_index ?? 0 },
    ]);
  }, [quiz, currentIndex]);

  // Held in a ref so the countdown below does not have to list it as a
  // dependency — naming it there would restart the clock every time the
  // question or the answer log changed, which is every second of a quiz.
  const timeOutRef = useRef(handleTimeOut);
  useEffect(() => {
    timeOutRef.current = handleTimeOut;
  }, [handleTimeOut]);

  // Two timers, deliberately. The interval only counts down for the display.
  // Running out is a timeout of its own, so it fires once, as an event —
  // setting state from inside an effect is what makes renders cascade, and
  // reaching into the interval's updater to do it is worse.
  //
  // Resetting the clock belongs to whatever moved the question on, not here.
  useEffect(() => {
    if (!quiz || showResult || completed) return;

    const tick = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    const expire = setTimeout(() => timeOutRef.current(), QUESTION_LIMIT_SECONDS * 1000);
    timerRef.current = tick;

    return () => {
      clearInterval(tick);
      clearTimeout(expire);
    };
  }, [currentIndex, quiz, showResult, completed]);

  const handleGenerateQuiz = async (selectedTopic?: string) => {
    const targetTopic = selectedTopic || topic;
    if (!targetTopic.trim()) return;

    setLoading(true);
    setError(null);
    setQuiz(null);
    setCurrentIndex(0);
    setScore(0);
    setAnswersLog([]);
    setCompleted(false);
    setSelectedOption(null);
    setShowResult(false);
    setTimeLeft(QUESTION_LIMIT_SECONDS);

    try {
      const res = await fetch("/api/ai/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: targetTopic, difficulty, count: 5 }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate evaluation");

      setQuiz(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not generate the quiz.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (idx: number) => {
    if (showResult) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setSelectedOption(idx);
    setShowResult(true);

    const isCorrect = idx === quiz?.questions[currentIndex].correct_answer_index;
    if (isCorrect) {
      setScore((prev) => prev + 1);
    }

    setAnswersLog((prev) => [
      ...prev,
      { selected: idx, correct: quiz?.questions[currentIndex].correct_answer_index ?? 0 },
    ]);
  };

  const handleNext = async () => {
    if (!quiz) return;

    if (currentIndex + 1 < quiz.questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setShowResult(false);
      setTimeLeft(QUESTION_LIMIT_SECONDS);
    } else {
      setCompleted(true);

      // Persist final score to database
      try {
        await fetch("/api/ai/quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_score",
            topic: quiz.topic,
            score,
            total_questions: quiz.questions.length,
            difficulty: quiz.difficulty,
            quiz_data: quiz,
          }),
        });
      } catch (err) {
        console.error("Failed to record score:", err);
      }
    }
  };

  const handleReset = () => {
    setQuiz(null);
    setCompleted(false);
    setScore(0);
    setCurrentIndex(0);
  };

  return (
    <div className={styles.wrap}>
      {/* configure */}
      {!quiz && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.h2}>Set up a quiz</h2>
            <p className={styles.hint}>
              Pick a subject and how hard it should be. Five questions, thirty seconds each.
            </p>
          </div>

          <div>
            <span className={styles.label}>Suggested</span>
            <div className={styles.pills}>
              {SUGGESTED_TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={styles.pill}
                  onClick={() => {
                    setTopic(t);
                    handleGenerateQuiz(t);
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              handleGenerateQuiz();
            }}
          >
            <div className={styles.field}>
              <span className={styles.label}>Subject</span>
              <input
                type="text"
                placeholder="Distributed systems, Calculus III, the Next.js App Router…"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
              />
            </div>

            <div>
              <span className={styles.label}>How hard</span>
              <div className={styles.tiers}>
                {[
                  { id: "Beginner", label: "Fundamentals", desc: "Core terms and syntax" },
                  { id: "Intermediate", label: "Standard", desc: "Applied problem solving" },
                  { id: "Advanced", label: "Advanced", desc: "Edge cases and architecture" },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setDifficulty(tier.id)}
                    className={`${styles.tier} ${difficulty === tier.id ? styles.tierOn : ""}`}
                  >
                    <b>{tier.label}</b>
                    <span>{tier.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className={styles.go} disabled={loading || !topic.trim()}>
              {loading ? "Writing your questions…" : "Start"}
            </button>
          </form>

          {error && <p className={styles.error}>{error}</p>}
        </section>
      )}

      {/* in progress */}
      {quiz && !completed && (
        <section className={styles.card}>
          <div className={styles.bar}>
            <span className={styles.count}>
              Question {currentIndex + 1} of {quiz.questions.length}
              <span className={styles.subject}>  ·  {quiz.topic}</span>
            </span>
            <span className={`${styles.clock} ${timeLeft <= 10 ? styles.clockLow : ""}`}>
              <Clock size={14} aria-hidden="true" />
              {timeLeft}s
            </span>
          </div>

          <div className={styles.meter} aria-hidden="true">
            <i style={{ width: `${((currentIndex + 1) / quiz.questions.length) * 100}%` }} />
          </div>

          <h3 className={styles.question}>{quiz.questions[currentIndex].question}</h3>

          <div className={styles.options}>
            {quiz.questions[currentIndex].options.map((opt, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const isSelected = selectedOption === idx;
              const isCorrect = idx === quiz.questions[currentIndex].correct_answer_index;

              let tone = "";
              let letterTone = "";
              if (showResult) {
                if (isCorrect) {
                  tone = styles.right;
                  letterTone = styles.letterRight;
                } else if (isSelected) {
                  tone = styles.wrong;
                  letterTone = styles.letterWrong;
                } else {
                  tone = styles.muted;
                }
              }

              return (
                <button
                  key={idx}
                  className={`${styles.option} ${tone}`}
                  onClick={() => handleSelectOption(idx)}
                  disabled={showResult}
                >
                  <span className={`${styles.letter} ${letterTone}`}>{letter}</span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>

          {showResult && (
            <div className={styles.verdict}>
              <div className={styles.verdictHead}>
                {selectedOption === quiz.questions[currentIndex].correct_answer_index ? (
                  <span className={styles.tagOk}>
                    <CheckCircle2 size={15} aria-hidden="true" /> Correct
                  </span>
                ) : (
                  <span className={styles.tagBad}>
                    <XCircle size={15} aria-hidden="true" />
                    {selectedOption === null ? "Time up" : "Not quite"}
                  </span>
                )}

                <button className={styles.next} onClick={handleNext}>
                  {currentIndex + 1 < quiz.questions.length ? "Next question" : "See how you did"}
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>

              <p className={styles.why}>
                <b>Why: </b>
                {quiz.questions[currentIndex].explanation}
              </p>
            </div>
          )}
        </section>
      )}

      {/* report */}
      {completed && quiz && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.label}>How you did</span>
            <h2 className={styles.h2}>{quiz.topic}</h2>
            <p className={styles.hint}>{quiz.difficulty}</p>
          </div>

          <div className={styles.scores}>
            <div className={styles.score}>
              <span className={styles.label}>Score</span>
              <b>
                {score} / {quiz.questions.length}
              </b>
            </div>
            <div className={styles.score}>
              <span className={styles.label}>Accuracy</span>
              <b>{Math.round((score / quiz.questions.length) * 100)}%</b>
            </div>
            <div className={styles.score}>
              <span className={styles.label}>Standing</span>
              <span className={styles.standing}>
                {score >= 4 ? "Proficient" : score >= 3 ? "Competent" : "Worth another look"}
              </span>
            </div>
          </div>

          <div>
            <span className={styles.label}>Question by question</span>
            <ul className={styles.audit}>
              {quiz.questions.map((q, idx) => {
                const attempt = answersLog[idx];
                const isCorrect = attempt?.selected === q.correct_answer_index;
                return (
                  <li key={idx} className={styles.auditRow}>
                    <div className={styles.auditTop}>
                      {isCorrect ? (
                        <Check size={15} className={styles.tick} aria-hidden="true" />
                      ) : (
                        <XCircle size={15} className={styles.cross} aria-hidden="true" />
                      )}
                      <span className={styles.auditQ}>{q.question}</span>
                    </div>
                    <div className={styles.auditBody}>
                      <span className={styles.auditAnswer}>
                        Answer: <b>{q.options[q.correct_answer_index]}</b>
                      </span>
                      <p className={styles.auditWhy}>{q.explanation}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className={styles.foot}>
            <button className={styles.again} onClick={handleReset}>
              <RotateCcw size={14} aria-hidden="true" />
              Try another topic
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
