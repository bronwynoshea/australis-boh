import React, { useState } from "react";
import type { QuickServeFormat } from "../types/quickServe";

interface QuickServeFormProps {
  onGenerate: (options: {
    soundbyteId: string;
    personaId: string;
    format: QuickServeFormat;
    brief: string;
  }) => void;
}

const QuickServeForm: React.FC<QuickServeFormProps> = ({ onGenerate }) => {
  const [soundbyteId, setSoundbyteId] = useState("sb-1");
  const [personaId, setPersonaId] = useState("ai-1");
  const [format, setFormat] = useState<QuickServeFormat>("LinkedIn Post");
  const [brief, setBrief] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onGenerate({ soundbyteId, personaId, format, brief });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-boh-text-light dark:text-boh-text">Select Soundbyte</label>
        <select
          className="w-full rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
          value={soundbyteId}
          onChange={(e) => setSoundbyteId(e.target.value)}
        >
          <option value="sb-1">Jobz Cafe Origin Story</option>
          <option value="sb-2">Sunset the Resume</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-boh-text-light dark:text-boh-text">Select AI Persona</label>
        <select
          className="w-full rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
          value={personaId}
          onChange={(e) => setPersonaId(e.target.value)}
        >
          <option value="ai-1">Harper (Campaign Chef)</option>
          <option value="ai-2">Sadie (Support Maestro)</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-boh-text-light dark:text-boh-text">Content format</label>
        <select
          className="w-full rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
          value={format}
          onChange={(e) => setFormat(e.target.value as QuickServeFormat)}
        >
          <option value="LinkedIn Post">LinkedIn Post</option>
          <option value="Meme Caption">Meme Caption</option>
          <option value="Short Video Script">Short Video Script</option>
          <option value="Email Snippet">Email Snippet</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-boh-text-light dark:text-boh-text">
          Brief prompt
        </label>
        <textarea
          className="min-h-[100px] w-full resize-y rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
          placeholder="What do you want this piece to say?"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
        />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/80"
        >
          Generate Draft
        </button>
      </div>
    </form>
  );
};

export default QuickServeForm;
