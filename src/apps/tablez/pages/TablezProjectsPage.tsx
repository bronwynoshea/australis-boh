import React, { useEffect, useMemo, useState } from 'react';
import type { TablezProject } from '../types';
import Alert from '../components/Alert';
import ProjectModal from '../components/ProjectModal';
import { getCurrentBohUserId } from '../../../boh/api/bohApi';
import { archiveProject, createProject, fetchProjectsForOwner, updateProject } from '../api/tablezProjectsApi';

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const TablezProjectsPage: React.FC = () => {
  const [bohUserId, setBohUserId] = useState<string | null>(null);
  const [projects, setProjects] = useState<TablezProject[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedProject, setSelectedProject] = useState<TablezProject | null>(null);

  const reload = async (ownerId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchProjectsForOwner(ownerId);
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function load() {
      setIsLoading(true);
      setError(null);

      const id = await getCurrentBohUserId();
      if (!mounted) return;

      if (!id) {
        setBohUserId(null);
        setProjects([]);
        setError('Unable to determine BOH user');
        setIsLoading(false);
        return;
      }

      setBohUserId(id);
      await reload(id);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      const haystack = `${p.name || ''} ${p.description || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [projects, search]);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      <header className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wide mb-1">Tablez</div>
            <h2 className="text-2xl font-bold text-boh-text-light dark:text-boh-text mb-1">Projects</h2>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Manage your projects for Tablez & Chairz.</p>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ backgroundColor: 'var(--boh-primary)' }}
            onClick={() => {
              setSelectedProject(null);
              setIsModalOpen(true);
            }}
            disabled={!bohUserId}
          >
            New Project
          </button>
        </div>

        <div className="mt-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="w-full sm:max-w-md p-2 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text"
          />
        </div>
      </header>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {isLoading ? (
        <div className="text-boh-text-sub-light dark:text-boh-text-sub">Loading projects…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-lg p-6">
          <div className="text-boh-text-light dark:text-boh-text font-medium">No projects yet</div>
          <div className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">Create your first project to organise tasks.</div>
        </div>
      ) : (
        <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-boh-bg-light dark:bg-boh-bg">
                <tr className="text-left text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Updated</th>
                  <th className="px-4 py-3 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-boh-border-light dark:border-boh-border">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-left w-full"
                        onClick={() => {
                          setSelectedProject(p);
                          setIsModalOpen(true);
                        }}
                      >
                        <div className="font-medium text-boh-text-light dark:text-boh-text">
                          {p.name}
                        </div>
                        {p.description && (
                          <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1 line-clamp-2">{p.description}</div>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                      {formatDate((p as any).updated_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-xs px-3 py-1.5 rounded-md border border-boh-border-light dark:border-boh-border text-boh-text-light dark:text-boh-text-sub hover:bg-boh-bg-light dark:hover:bg-boh-bg"
                        onClick={() => {
                          setSelectedProject(p);
                          setIsModalOpen(true);
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedProject(null);
        }}
        project={selectedProject}
        onSave={async (payload) => {
          if (!bohUserId) throw new Error('Missing required context');
          if (selectedProject) {
            await updateProject(selectedProject.id, payload);
          } else {
            await createProject(bohUserId, payload);
          }
          await reload(bohUserId);
        }}
        onArchive={
          selectedProject && bohUserId
            ? async () => {
                await archiveProject(selectedProject.id);
                await reload(bohUserId);
              }
            : null
        }
      />
    </div>
  );
};

export default TablezProjectsPage;
