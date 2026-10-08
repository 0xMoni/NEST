"use client";

import { useState } from "react";
import { Shell } from "@/components/Shell";
import { ui, Empty, Tile, Badge } from "@/components/ui";
import type { RoadmapResponse } from "@/app/api/ai/roadmap/schemas";
import type { Me } from "@/lib/session";

export function RoadmapClient({ me }: { me: Me }) {
  const [goal, setGoal] = useState("");
  const [skills, setSkills] = useState("");
  const [loading, setLoading] = useState(false);
  const [roadmap, setRoadmap] = useState<RoadmapResponse | null>(null);
  const [error, setError] = useState("");

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setRoadmap(null);

    try {
      const res = await fetch("/api/ai/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ career_goal: goal, current_skills: skills }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setRoadmap(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell me={me} title="Career Roadmap" sub="Generate a personalized learning path with AI.">
      
      {!roadmap ? (
        <form onSubmit={handleGenerate} className={ui.tiles} style={{ display: 'flex', flexDirection: 'column', maxWidth: '500px' }}>
          <div className={ui.tile}>
            <label className={ui.label}>Target Career Goal</label>
            <input 
              required
              type="text" 
              placeholder="e.g. AI Engineer, Full Stack Developer..."
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              style={{ width: '100%', padding: '8px', marginTop: '8px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--field)', color: 'var(--ink)' }}
            />
          </div>
          <div className={ui.tile}>
            <label className={ui.label}>Current Skills (Optional)</label>
            <input 
              type="text" 
              placeholder="e.g. Basic Python, HTML, CSS..."
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              style={{ width: '100%', padding: '8px', marginTop: '8px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--field)', color: 'var(--ink)' }}
            />
          </div>
          <button type="submit" disabled={loading} style={{ padding: '10px', background: 'var(--ink)', color: 'var(--panel)', borderRadius: '8px', cursor: 'pointer', border: 'none', fontWeight: 500 }}>
            {loading ? "Generating Roadmap..." : "Generate AI Roadmap"}
          </button>
          {error && <p style={{ color: "var(--danger)", marginTop: "10px", fontSize: '0.9rem' }}>{error}</p>}
        </form>
      ) : (
        <div>
          <button onClick={() => setRoadmap(null)} style={{ marginBottom: '20px', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--ink-2)', textDecoration: 'underline' }}>← Generate New</button>
          
          <h2 className={ui.h2}>{roadmap.career_goal}</h2>
          <p className={ui.sub}>{roadmap.summary}</p>
          
          <div className={ui.tiles}>
            <Tile label="Estimated Time" value={roadmap.estimated_duration} />
            <Tile label="Current Level" value={roadmap.current_level} />
          </div>

          <h3 className={ui.h2}>Missing Skills to Acquire</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
            {roadmap.missing_skills.map((skill, i) => (
              <Badge key={i} tone="bad">{skill}</Badge>
            ))}
          </div>

          <h3 className={ui.h2}>Learning Phases</h3>
          {roadmap.phases.map((phase, i) => (
            <div key={i} className={ui.tile} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={ui.label}>Phase {i + 1}: {phase.title}</span>
                <Badge tone="ok">{phase.duration}</Badge>
              </div>
              <ul style={{ marginTop: '12px', paddingLeft: '20px', fontSize: '0.9375rem', color: 'var(--ink)' }}>
                {phase.topics.map((topic, j) => <li key={j}>{topic}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}