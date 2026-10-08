import { QuizClient } from "./QuizClient";

export default function QuizPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Editorial Header matching NEST Standard */}
      <div className="border-b border-stone-200 pb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-mono tracking-widest uppercase text-stone-500 bg-stone-100 border border-stone-200 px-2.5 py-0.5 rounded">
            AI Assessment Engine
          </span>
        </div>
        <h1 className="text-3xl font-serif text-stone-900 tracking-tight">
          Knowledge Diagnostic & Skill Check
        </h1>
        <p className="text-sm text-stone-600 mt-1.5 max-w-2xl leading-relaxed">
          Evaluate subject comprehension with rigorous, AI-generated multiple-choice assessments. Review rationale breakdowns and benchmark your technical proficiency.
        </p>
      </div>

      <QuizClient />
    </div>
  );
}