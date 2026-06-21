import React, { useEffect, useState } from 'react';
import type { TablezProject } from '../types';
import Alert from './Alert';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: { name: string; description: string | null; color: string | null }) => Promise<void>;
  project?: TablezProject | null;
  onArchive?: (() => Promise<void>) | null;
}

const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, onSave, project, onArchive }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setDescription(project.description || '');
      setColor(project.color || '');
    } else {
      setName('');
      setDescription('');
      setColor('');
    }
    setError('');
  }, [project, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    setIsLoading(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
        color: color.trim() ? color.trim() : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project');
    } finally {
      setIsLoading(false);
    }
  };

  const isEditing = Boolean(project);

  return (
    <div
      className={`modal-backdrop ${isOpen ? 'visible' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content mx-4" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            <div className="modal-header" style={{ textAlign: 'left' }}>
              <h3>{isEditing ? 'Edit Project' : 'New Project'}</h3>
              <p>{isEditing ? 'Update project details' : 'Create a new project'}</p>
            </div>

            <div className="modal-body" style={{ gap: 0 }}>
              {error && <Alert variant="error" className="mb-4">{error}</Alert>}

              <div className="form-group">
                <label htmlFor="project-name">Project Name *</label>
                <input
                  id="project-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full"
                />
              </div>

              <div className="form-group">
                <label htmlFor="project-description">Description</label>
                <textarea
                  id="project-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full p-2 border border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border rounded-lg bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text-sub"
                />
              </div>

              <div className="form-group">
                <label htmlFor="project-color">Color</label>
                <input
                  id="project-color"
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#635CCD"
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <div className="pt-4 flex justify-between gap-3">
              <div>
                {isEditing && onArchive && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={async () => {
                      setError('');
                      setIsLoading(true);
                      try {
                        await onArchive();
                        onClose();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to archive project');
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading}
                  >
                    Archive
                  </button>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ backgroundColor: 'var(--boh-primary)' }}>
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectModal;
