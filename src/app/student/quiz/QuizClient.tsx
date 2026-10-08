"use client";

import { useState, useEffect, useRef } from "react";
import { 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  RotateCcw, 
  Clock, 
  Check, 
  FileCheck,
  ChevronRight
} from "lucide-react";
import { QuizData } from "@/app/api/ai/roadmap/schemas";

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

  // Pacing countdown per question
  useEffect(() => {
    if (!quiz || showResult || completed) return;

    setTimeLeft(QUESTION_LIMIT_SECONDS);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, quiz, showResult, completed]);

  const handleTimeOut = () => {
    if (showResult) return;
    setShowResult(true);
    setSelectedOption(null);
    setAnswersLog((prev) => [
      ...prev,
      { selected: null, correct: quiz?.questions[currentIndex].correct_answer_index ?? 0 },
    ]);
  };

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

    try {
      const res = await fetch("/api/ai/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: targetTopic, difficulty, count: 5 }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate evaluation");

      setQuiz(data);
    } catch (err: any) {
      setError(err.message);
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
    <div className="space-y-6">
      {/* 1. ASSESSMENT CONFIGURATION */}
      {!quiz && (
        <div className="bg-white rounded-lg border border-stone-200 p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-xl font-serif text-stone-900">Configure Examination</h2>
            <p className="text-xs text-stone-500 mt-1">
              Select or specify a subject domain to generate an adaptive benchmark test.
            </p>
          </div>

          {/* Preset Topics styled like NEST pills */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400">
              Suggested Curricula
            </span>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTopic(t);
                    handleGenerateQuiz(t);
                  }}
                  className="px-3 py-1 rounded-full text-xs font-mono tracking-wider border border-stone-200 bg-stone-50 hover:bg-stone-100 hover:border-stone-400 text-stone-700 transition"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleGenerateQuiz();
            }}
            className="space-y-6 pt-2"
          >
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-stone-600 mb-2">
                Subject or Topic Domain
              </label>
              <input
                type="text"
                placeholder="e.g. Distributed Systems, Calculus III, Next.js App Router"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-md border border-stone-300 focus:outline-none focus:border-stone-900 text-sm font-sans text-stone-900 placeholder:text-stone-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-stone-600 mb-2">
                Proficiency Level
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: "Beginner", label: "Fundamental", desc: "Core terms & syntax" },
                  { id: "Intermediate", label: "Standard", desc: "Applied problem solving" },
                  { id: "Advanced", label: "Advanced", desc: "Edge cases & architecture" },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setDifficulty(tier.id)}
                    className={`py-3 px-3 rounded-md border text-left transition-all ${
                      difficulty === tier.id
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-200 bg-white hover:bg-stone-50 text-stone-700"
                    }`}
                  >
                    <div className="text-xs font-semibold">{tier.label}</div>
                    <div className={`text-[10px] mt-0.5 ${difficulty === tier.id ? "text-stone-300" : "text-stone-400"}`}>
                      {tier.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !topic.trim()}
              className="w-full py-2.5 bg-stone-900 text-white text-xs font-medium uppercase tracking-wider rounded-md hover:bg-stone-800 disabled:opacity-50 transition"
            >
              {loading ? "Generating Examination..." : "Begin Diagnostic Assessment"}
            </button>
          </form>

          {error && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-md">
              {error}
            </div>
          )}
        </div>
      )}

      {/* 2. ACTIVE DIAGNOSTIC TEST */}
      {quiz && !completed && (
        <div className="bg-white rounded-lg border border-stone-200 p-6 sm:p-8 space-y-6">
          {/* Diagnostic Top Status Bar */}
          <div className="flex items-center justify-between border-b border-stone-100 pb-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-semibold text-stone-900">
                QUESTION {String(currentIndex + 1).padStart(2, "0")} / {String(quiz.questions.length).padStart(2, "0")}
              </span>
              <span className="text-stone-300">|</span>
              <span className="text-xs text-stone-500 font-mono uppercase">
                {quiz.topic}
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs text-stone-600 bg-stone-50 px-2.5 py-1 rounded border border-stone-200">
              <Clock className="w-3.5 h-3.5 text-stone-400" />
              <span>{timeLeft}s</span>
            </div>
          </div>

          {/* Thin Progress Rule */}
          <div className="w-full bg-stone-100 h-1 rounded-full overflow-hidden">
            <div
              className="bg-stone-900 h-full transition-all duration-300"
              style={{
                width: `${((currentIndex + 1) / quiz.questions.length) * 100}%`,
              }}
            />
          </div>

          {/* Question Statement */}
          <div className="py-2">
            <h3 className="text-xl sm:text-2xl font-serif text-stone-900 leading-snug">
              {quiz.questions[currentIndex].question}
            </h3>
          </div>

          {/* Structured Multiple Choice Options */}
          <div className="space-y-2.5 pt-1">
            {quiz.questions[currentIndex].options.map((opt, idx) => {
              const letter = String.fromCharCode(65 + idx); // A, B, C, D
              const isSelected = selectedOption === idx;
              const isCorrectAnswer = idx === quiz.questions[currentIndex].correct_answer_index;

              let cardStyle = "group w-full flex items-start gap-3.5 p-4 rounded-md border text-left transition-all font-sans text-sm ";

              if (!showResult) {
                cardStyle += "border-stone-200 bg-white hover:border-stone-900 hover:bg-stone-50/60 text-stone-800 cursor-pointer";
              } else if (isCorrectAnswer) {
                cardStyle += "border-emerald-700 bg-emerald-50/70 text-emerald-950 font-medium";
              } else if (isSelected && !isCorrectAnswer) {
                cardStyle += "border-rose-700 bg-rose-50/70 text-rose-950";
              } else {
                cardStyle += "border-stone-100 bg-stone-50 text-stone-400 opacity-50 pointer-events-none";
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(idx)}
                  disabled={showResult}
                  className={cardStyle}
                >
                  <span
                    className={`w-6 h-6 flex items-center justify-center rounded text-xs font-mono shrink-0 transition-colors ${
                      showResult && isCorrectAnswer
                        ? "bg-emerald-700 text-white"
                        : showResult && isSelected && !isCorrectAnswer
                        ? "bg-rose-700 text-white"
                        : "border border-stone-300 text-stone-600 group-hover:border-stone-900 group-hover:text-stone-900"
                    }`}
                  >
                    {letter}
                  </span>
                  <span className="flex-1 pt-0.5 leading-relaxed">{opt}</span>
                </button>
              );
            })}
          </div>

          {/* Instructive Post-Answer Analysis */}
          {showResult && (
            <div className="p-4 rounded-md border border-stone-200 bg-stone-50/70 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectedOption === quiz.questions[currentIndex].correct_answer_index ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold uppercase text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Correct Assessment
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold uppercase text-rose-800">
                      <XCircle className="w-4 h-4 text-rose-600" />
                      {selectedOption === null ? "Time Expired" : "Incorrect Response"}
                    </span>
                  )}
                </div>

                <button
                  onClick={handleNext}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-stone-900 text-white text-xs font-medium uppercase tracking-wider rounded-md hover:bg-stone-800 transition"
                >
                  {currentIndex + 1 < quiz.questions.length ? "Proceed" : "View Assessment Report"}
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="pt-1 border-t border-stone-200/60">
                <p className="text-xs text-stone-600 leading-relaxed">
                  <span className="font-semibold text-stone-800">Rationale: </span>
                  {quiz.questions[currentIndex].explanation}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. FINAL EVALUATION REPORT */}
      {completed && quiz && (
        <div className="bg-white rounded-lg border border-stone-200 p-6 sm:p-8 space-y-6">
          <div className="border-b border-stone-100 pb-5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400">
              Evaluation Outcome
            </span>
            <h3 className="text-2xl font-serif text-stone-900 mt-1">Diagnostic Report</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Subject: <strong className="text-stone-800">{quiz.topic}</strong> • Tier: {quiz.difficulty}
            </p>
          </div>

          {/* Quantitative Metrics */}
          <div className="grid grid-cols-3 gap-4 border border-stone-200 rounded-md p-4 bg-stone-50/50">
            <div>
              <div className="text-[10px] font-mono uppercase text-stone-500">Score</div>
              <div className="text-2xl font-serif text-stone-900 mt-0.5">
                {score} / {quiz.questions.length}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase text-stone-500">Accuracy</div>
              <div className="text-2xl font-serif text-stone-900 mt-0.5">
                {Math.round((score / quiz.questions.length) * 100)}%
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase text-stone-500">Standing</div>
              <div className="text-xs font-semibold text-stone-800 mt-2">
                {score >= 4 ? "Proficient" : score >= 3 ? "Competent" : "Needs Review"}
              </div>
            </div>
          </div>

          {/* Question-by-Question Audit */}
          <div className="space-y-3 pt-2">
            <h4 className="text-[11px] font-mono uppercase tracking-wider text-stone-500">
              Question Audit Log
            </h4>
            <div className="space-y-2">
              {quiz.questions.map((q, idx) => {
                const attempt = answersLog[idx];
                const isCorrect = attempt?.selected === q.correct_answer_index;
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-md border border-stone-200 bg-stone-50/30 text-xs space-y-1.5"
                  >
                    <div className="flex items-start gap-2">
                      {isCorrect ? (
                        <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                      ) : (
                        <span className="w-3.5 h-3.5 text-rose-700 font-bold shrink-0 mt-0.5 leading-none">✕</span>
                      )}
                      <span className="font-medium text-stone-900">{q.question}</span>
                    </div>
                    <div className="pl-5 text-stone-500 space-y-0.5">
                      <div>
                        Correct Answer: <span className="font-semibold text-stone-800">{q.options[q.correct_answer_index]}</span>
                      </div>
                      <p className="text-[11px] text-stone-500">{q.explanation}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-stone-100 flex justify-end">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-5 py-2 bg-stone-900 text-white text-xs font-medium uppercase tracking-wider rounded-md hover:bg-stone-800 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retake or Select New Topic
            </button>
          </div>
        </div>
      )}
    </div>
  );
}