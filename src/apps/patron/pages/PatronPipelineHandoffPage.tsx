import React from 'react';
import { ArrowRight, Building2, Contact, Target } from 'lucide-react';
import { Link } from 'react-router-dom';

const PatronPipelineHandoffPage: React.FC = () => (
  <div className="mx-auto max-w-5xl space-y-5">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-boh-text-sub-light dark:text-boh-text-sub">Connected workspace</p>
      <h2 className="mt-1 text-2xl font-semibold text-boh-text-light dark:text-boh-text">Sales Opportunities are managed in Funnel</h2>
      <p className="mt-2 max-w-3xl text-sm text-boh-text-sub-light dark:text-boh-text-sub">Patron remains the source for people, organisations, relationships, activities, and customer history. Funnel manages Opportunity milestones, values, probabilities, next actions, and outcomes.</p>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-xl border border-boh-border-light bg-boh-surface-light p-5 dark:border-boh-border dark:bg-boh-surface">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-boh-primary/10 text-boh-primary"><Contact className="h-5 w-5" /></div>
        <h3 className="mt-4 font-semibold text-boh-text-light dark:text-boh-text">Patron</h3>
        <ul className="mt-3 space-y-2 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
          <li className="flex items-center gap-2"><Contact className="h-4 w-4" /> People and relationships</li>
          <li className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Organisations</li>
          <li className="flex items-center gap-2"><Contact className="h-4 w-4" /> Activities and customer history</li>
        </ul>
      </section>
      <section className="rounded-xl border border-boh-primary/40 bg-boh-primary/5 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-boh-primary text-white"><Target className="h-5 w-5" /></div>
        <h3 className="mt-4 font-semibold text-boh-text-light dark:text-boh-text">Funnel</h3>
        <ul className="mt-3 space-y-2 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
          <li>Opportunity stages and milestone criteria</li>
          <li>Values, probabilities, and forecast</li>
          <li>Next actions, Won, Lost, and loss reasons</li>
        </ul>
        <Link to="/funnel/pipeline" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-boh-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">Open Funnel Pipeline <ArrowRight className="h-4 w-4" /></Link>
      </section>
    </div>
  </div>
);

export default PatronPipelineHandoffPage;
