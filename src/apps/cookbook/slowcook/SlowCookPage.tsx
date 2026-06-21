import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ContentProject, ContentSection } from "../types/content";
import { fetchSlowCookProjects, fetchProjectSections } from "./services/slowCookApi";

const VIEW_MODE_KEY = "cookbook_slowcook_view_mode";
const TYPE_FILTER_KEY = "cookbook_slowcook_filter_type";
const STATUS_FILTER_KEY = "cookbook_slowcook_filter_status";

type TypeFilterOption = {
  id: string;
  label: string;
  types: string[];
};

const TYPE_FILTERS: TypeFilterOption[] = [
  { id: "all", label: "All", types: [] },
  { id: "book", label: "Books", types: ["book"] },
  { id: "long_article", label: "Articles", types: ["long_article"] },
  { id: "landing_page", label: "Pages", types: ["landing_page"] },
  { id: "email_sequence", label: "Email", types: ["email_sequence"] },
  { id: "whitepaper", label: "Whitepapers", types: ["whitepaper"] },
  { id: "webinar_script", label: "Scripts", types: ["webinar_script"] },
];

const STATUS_FILTERS = [
  { id: "active", label: "Active" },
  { id: "archived", label: "Archived" },
] as const;

const TYPE_LABELS: Record<string, string> = {
  book: "Book",
  long_article: "Article",
  landing_page: "Landing page",
  email_sequence: "Email sequence",
  whitepaper: "Whitepaper",
  webinar_script: "Webinar/script",
};

const TYPE_ROUTE_MAP: Record<string, string> = {
  book: "/boh/cookbook/slow-cook/books",
  long_article: "/boh/cookbook/slow-cook/long-articles",
  landing_page: "/boh/cookbook/slow-cook/landing-pages",
  email_sequence: "/boh/cookbook/slow-cook/email-sequences",
  whitepaper: "/boh/cookbook/slow-cook/whitepapers",
  webinar_script: "/boh/cookbook/slow-cook/webinars",
};

type ViewMode = "cards" | "list";

const SlowCookPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ContentProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [drawerProject, setDrawerProject] = useState<ContentProject | null>(null);
  const [drawerSections, setDrawerSections] = useState<ContentSection[]>([]);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);
  const [menuProjectId, setMenuProjectId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setViewMode((window.localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || "cards");
    setTypeFilter(window.localStorage.getItem(TYPE_FILTER_KEY) || "all");
    setStatusFilter(window.localStorage.getItem(STATUS_FILTER_KEY) || "active");
  }, []);

  useEffect(() => {
    window.localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    window.localStorage.setItem(TYPE_FILTER_KEY, typeFilter);
  }, [typeFilter]);

  useEffect(() => {
    window.localStorage.setItem(STATUS_FILTER_KEY, statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    setIsLoading(true);
    void (async () => {
      const rows = await fetchSlowCookProjects();
      setProjects(rows);
      setIsLoading(false);
    })();
  }, []);

  const filteredProjects = useMemo(() => {
    const typeConfig = TYPE_FILTERS.find((f) => f.id === typeFilter);
    const statusIsArchived = statusFilter === "archived";
    return projects.filter((project) => {
      const matchesStatus = statusIsArchived ? project.status === "archived" : project.status !== "archived";
      const matchesType =
        !typeConfig || typeConfig.types.length === 0 || typeConfig.types.includes(project.content_type);
      return matchesStatus && matchesType;
    });
  }, [projects, typeFilter, statusFilter]);

  const createMenuRef = useRef<HTMLDivElement | null>(null);
  const overflowMenuRef = useRef<HTMLDivElement | null>(null);

  const closeCreateMenu = () => setCreateMenuOpen(false);

  const renameProjectStub = (project: ContentProject) => {
    window.alert(`Rename coming soon for ${project.title}`);
  };

  const archiveProjectStub = (project: ContentProject) => {
    window.alert(`Archive coming soon for ${project.title}`);
  };

  const duplicateProjectStub = (project: ContentProject) => {
    window.alert(`Duplicate coming soon for ${project.title}`);
  };

  const handleCreateSelect = (type: string) => {
    closeCreateMenu();
    if (type !== "book") {
      window.alert("Coming soon.");
      return;
    }

    function renderStatusChip(status: string) {
      const base =
        status === "archived"
          ? "bg-slate-200 text-slate-600"
          : status === "draft"
            ? "bg-amber-100 text-amber-700"
            : "bg-emerald-100 text-emerald-700";
      const label =
        status === "archived" ? "Archived" : status === "draft" ? "Draft" : "In progress";
      return (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${base}`}>
          {label}
        </span>
      );
    }

    function renameProjectStub(project: ContentProject) {
      window.alert(`Rename coming soon for ${project.title}`);
    }

    function archiveProjectStub(project: ContentProject) {
      window.alert(`Archive coming soon for ${project.title}`);
    }

    function duplicateProjectStub(project: ContentProject) {
      window.alert(`Duplicate coming soon for ${project.title}`);
    }
    window.localStorage.removeItem("cookbook_slowcook_last_project_book");
    navigate(TYPE_ROUTE_MAP.book);
  };

  const handleEdit = (project: ContentProject) => {
    const route = TYPE_ROUTE_MAP[project.content_type] ?? TYPE_ROUTE_MAP.book;
    const url = `${route}?projectId=${project.id}`;
    navigate(url);
  };

  const handleView = async (project: ContentProject) => {
    setDrawerProject(project);
    setIsDrawerLoading(true);
    const sections = await fetchProjectSections(project.id);
    setDrawerSections(sections);
    setIsDrawerLoading(false);
  };

  const closeDrawer = () => {
    setDrawerProject(null);
    setDrawerSections([]);
  };

  const renderOverflowMenu = () => {
    if (!menuProjectId || !menuAnchor) return null;
    const project = projects.find((p) => p.id === menuProjectId);
    if (!project) return null;

    return (
      <div
        ref={overflowMenuRef}
        className="fixed z-30 w-48 rounded-lg border border-primary-200 bg-boh-surface-light dark:bg-boh-surface p-2 shadow-xl dark:border-primary-200 dark:bg-boh-bg"
        style={{ top: menuAnchor.y + 8, left: menuAnchor.x - 192 }}
      >
        <button
          type="button"
          onClick={() => {
            renameProjectStub(project);
            setMenuProjectId(null);
            setMenuAnchor(null);
          }}
          className="flex w-full items-center rounded-md px-2 py-2 text-sm text-boh-text-light hover:bg-primary-100 dark:text-boh-text dark:hover:bg-boh-bg/60"
        >
          Rename
        </button>
        <button
          type="button"
          onClick={() => {
            archiveProjectStub(project);
            setMenuProjectId(null);
            setMenuAnchor(null);
          }}
          className="flex w-full items-center rounded-md px-2 py-2 text-sm text-boh-text-light hover:bg-primary-100 dark:text-boh-text dark:hover:bg-boh-bg/60"
        >
          Archive
        </button>
        <button
          type="button"
          onClick={() => {
            duplicateProjectStub(project);
            setMenuProjectId(null);
            setMenuAnchor(null);
          }}
          className="flex w-full items-center rounded-md px-2 py-2 text-sm text-boh-text-light hover:bg-primary-100 dark:text-boh-text dark:hover:bg-boh-bg/60"
        >
          Duplicate
        </button>
      </div>
    );
  };

  const renderCreateMenu = () => {
    if (!createMenuOpen) return null;
    return (
      <div
        ref={createMenuRef}
        className="absolute right-0 z-20 mt-2 w-60 rounded-lg border border-primary-200 bg-boh-surface-light dark:bg-boh-surface p-2 shadow-lg dark:border-primary-200 dark:bg-boh-bg"
      >
        {[
          { id: "book", label: "Book", enabled: true },
          { id: "long_article", label: "Long-form article", enabled: false },
          { id: "landing_page", label: "Landing page", enabled: false },
          { id: "email_sequence", label: "Email sequence", enabled: false },
          { id: "whitepaper", label: "Whitepaper", enabled: false },
          { id: "webinar_script", label: "Webinar or script", enabled: false },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={!item.enabled}
            onClick={() => handleCreateSelect(item.id)}
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-boh-text-light hover:bg-primary-100 disabled:text-boh-text-sub-light disabled:hover:bg-transparent dark:text-boh-text dark:hover:bg-boh-bg/60"
          >
            {item.label}
            {!item.enabled && <span className="text-[11px] text-boh-text-sub-light">Soon</span>}
          </button>
        ))}
      </div>
    );
  };

  const renderCards = () => (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filteredProjects.map((project) => (
        <div
          key={project.id}
          className="flex h-full flex-col rounded-lg border border-primary-200 bg-boh-surface-light dark:bg-boh-surface p-4 shadow-sm dark:border-primary-200 dark:bg-boh-bg"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
              {TYPE_LABELS[project.content_type] ?? "Project"}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setMenuProjectId(project.id);
                  const rect = event.currentTarget.getBoundingClientRect();
                  setMenuAnchor({ x: rect.right, y: rect.bottom });
                }}
                className="rounded-full border border-transparent p-1 text-sm text-boh-text-sub-light hover:border-primary-200 hover:text-boh-text-light"
              >
                ⋯
              </button>
              {renderStatusChip(project.status)}
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-base font-semibold text-boh-text-light dark:text-boh-text">{project.title}</p>
            {project.subtitle && (
              <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">{project.subtitle}</p>
            )}
          </div>
          <p className="mt-3 text-[11px] text-boh-text-sub-light dark:text-boh-text-sub">
            Updated {formatUpdated(project.updated_at)}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => handleEdit(project)}
              className="flex-1 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary/80"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => handleView(project)}
              className="flex-1 rounded-md border border-primary-200 px-3 py-1.5 text-sm font-semibold text-boh-text-light hover:bg-primary-100 dark:border-primary-200 dark:text-boh-text dark:hover:bg-boh-bg/50"
            >
              View
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderList = () => (
    <div className="overflow-hidden rounded-lg border border-primary-200 bg-boh-surface-light dark:bg-boh-surface shadow-sm dark:border-primary-200 dark:bg-boh-bg">
      <div className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr] border-b border-primary-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-boh-text-sub-light dark:border-primary-200 dark:bg-boh-bg/60 dark:text-boh-text-sub">
        <span>Type</span>
        <span>Title</span>
        <span>Status</span>
        <span>Updated</span>
        <span>Actions</span>
      </div>
      {filteredProjects.map((project) => (
        <div
          key={project.id}
          className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr] items-center border-b border-primary-200 px-4 py-3 text-sm last:border-b-0 dark:border-primary-200"
        >
          <div className="text-[11px] font-semibold text-primary">
            {TYPE_LABELS[project.content_type] ?? "Project"}
          </div>
          <div>
            <p className="font-medium text-boh-text-light dark:text-boh-text">{project.title}</p>
            {project.subtitle && <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">{project.subtitle}</p>}
          </div>
          <div className="text-xs capitalize text-boh-text-sub-light dark:text-boh-text-sub">{project.status}</div>
          <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">{formatUpdated(project.updated_at)}</div>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleEdit(project)}
              className="rounded border border-primary-200 px-2 py-1 font-semibold text-boh-text-light hover:bg-primary-100 dark:border-primary-200 dark:text-boh-text dark:hover:bg-boh-bg/70"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => handleView(project)}
              className="rounded border border-primary-200 px-2 py-1 font-semibold text-boh-text-light hover:bg-primary-100 dark:border-primary-200 dark:text-boh-text dark:hover:bg-boh-bg/70"
            >
              View
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderDrawer = () => {
    if (!drawerProject) return null;
    const stats = computeProgress(drawerSections);

    return (
      <div className="fixed inset-0 z-30 flex">
        <div className="flex-1 bg-black/40" onClick={closeDrawer} />
        <div className="h-full w-full max-w-md overflow-y-auto bg-boh-surface-light dark:bg-boh-surface p-5 shadow-2xl dark:bg-boh-bg">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {TYPE_LABELS[drawerProject.content_type] ?? "Project"}
              </p>
              <h2 className="text-lg font-bold text-boh-text-light dark:text-boh-text">{drawerProject.title}</h2>
              <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">Status: {drawerProject.status}</p>
            </div>
            <button
              type="button"
              onClick={closeDrawer}
              className="rounded-full border border-primary-200 p-1 text-boh-text-sub-light hover:text-boh-text-light dark:border-primary-200 dark:text-boh-text dark:hover:text-boh-text"
            >
              ✕
            </button>
          </div>

          {drawerProject.subtitle && (
            <p className="mb-4 text-sm text-boh-text-sub-light dark:text-boh-text-sub">{drawerProject.subtitle}</p>
          )}

          <div className="space-y-3 rounded-lg border border-primary-200 p-3 dark:border-primary-200">
            <h3 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">Progress</h3>
            {isDrawerLoading ? (
              <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Loading progress…</p>
            ) : (
              <>
                <p className="text-sm text-boh-text-light dark:text-boh-text">Outline created: {stats.totalChapters > 0 ? "Yes" : "No"}</p>
                <p className="text-sm text-boh-text-light dark:text-boh-text">
                  Interviews (raw transcripts): {stats.withRaw}/{stats.totalChapters}
                </p>
                <p className="text-sm text-boh-text-light dark:text-boh-text">
                  Drafted: {stats.withDraft}/{stats.totalChapters}
                </p>
              </>
            )}
            <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
              Updated {formatUpdated(drawerProject.updated_at)}
            </p>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                handleEdit(drawerProject);
                closeDrawer();
              }}
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/80"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard
                  .writeText(drawerProject.title)
                  .catch(() => window.alert("Unable to copy title right now"));
              }}
              className="flex-1 rounded-md border border-primary-200 px-4 py-2 text-sm font-semibold text-boh-text-light hover:bg-primary-100 dark:border-primary-200 dark:text-boh-text dark:hover:bg-boh-bg/50"
            >
              Copy title
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-full w-full px-4 py-6 lg:px-8 lg:py-8">
      <button
        type="button"
        onClick={() => navigate("/cookbook")}
        className="mb-3 text-xs font-medium text-boh-text-sub-light hover:text-boh-text-light dark:text-boh-text-sub dark:hover:text-boh-text"
      >
        ← Back to Cookbook
      </button>

      <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-boh-text-light dark:text-boh-text">Slow Cook</h1>
          <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
            Long-form content, interviews, and chaptered assets.
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setCreateMenuOpen((prev) => !prev)}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/80"
          >
            Create new
            <span className="ml-2 text-xs">▾</span>
          </button>
          {renderCreateMenu()}
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TYPE_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setTypeFilter(filter.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              typeFilter === filter.id
                ? "bg-primary text-white"
                : "bg-boh-surface-light dark:bg-boh-surface text-boh-text-sub-light hover:text-boh-text-light dark:bg-boh-bg dark:text-boh-text-sub dark:hover:text-boh-text"
            }`}
          >
            {filter.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatusFilter(filter.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                statusFilter === filter.id
                  ? "bg-slate-900 text-white dark:bg-boh-surface-light dark:bg-boh-surface dark:text-boh-text"
                  : "bg-boh-surface-light dark:bg-boh-surface text-boh-text-sub-light hover:text-boh-text-light dark:bg-boh-bg dark:text-boh-text-sub dark:hover:text-boh-text"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-full border border-primary-200 px-1 py-1 dark:border-primary-200">
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={`rounded-full px-2 py-1 text-xs font-semibold ${
              viewMode === "cards" ? "bg-primary text-white" : "text-boh-text-sub-light hover:text-boh-text-light"
            }`}
          >
            Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`rounded-full px-2 py-1 text-xs font-semibold ${
              viewMode === "list" ? "bg-primary text-white" : "text-boh-text-sub-light hover:text-boh-text-light"
            }`}
          >
            List
          </button>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">Your Slow Cook Projects</h2>
          <p className="text-[11px] text-boh-text-sub-light dark:text-boh-text-sub">
            {filteredProjects.length} project{filteredProjects.length === 1 ? "" : "s"}
          </p>
        </div>
        {isLoading ? (
          <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Loading projects…</p>
        ) : filteredProjects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-primary-200 p-6 text-center dark:border-primary-200">
            <p className="mb-3 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
              No projects yet. Start a new one to see it here.
            </p>
            <button
              type="button"
              onClick={() => setCreateMenuOpen(true)}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary/80"
            >
              Create new project
            </button>
          </div>
        ) : viewMode === "cards" ? (
          renderCards()
        ) : (
          renderList()
        )}
      </section>

      {renderDrawer()}
      {renderOverflowMenu()}
    </div>
  );
};

function formatUpdated(ts: string): string {
  const updated = new Date(ts);
  const now = Date.now();
  const diffMs = now - updated.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return "today";
  }
  if (diffDays === 1) {
    return "1 day ago";
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  return updated.toLocaleDateString("en-AU", { dateStyle: "medium" });
}

function computeProgress(sections: ContentSection[]) {
  const chapters = sections.filter(
    (section) => section.label !== "Harper Interview" && (section.section_type ?? "").toLowerCase() === "chapter",
  );
  const totalChapters = chapters.length;
  const withRaw = chapters.filter((section) => Boolean(section.raw_md?.trim())).length;
  const withDraft = chapters.filter((section) => Boolean(section.draft_md?.trim())).length;

  return { totalChapters, withRaw, withDraft };
}

function renderStatusChip(status: string) {
  const base =
    status === "archived"
      ? "bg-slate-200 text-slate-600"
      : status === "draft"
        ? "bg-amber-100 text-amber-700"
        : "bg-emerald-100 text-emerald-700";
  const label =
    status === "archived" ? "Archived" : status === "draft" ? "Draft" : "In progress";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${base}`}>
      {label}
    </span>
  );
}

export default SlowCookPage;
