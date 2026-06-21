import React, { useState, useEffect, useMemo } from 'react';
import type { Agent, AgentRole, BohUser } from '../types';
import ThemeToggle from './ThemeToggle'; // Reusing for the toggle style

interface AgentFormModalProps {
    agent: Agent | null;
    agents: Agent[];
    bohUsers: BohUser[];
    onClose: () => void;
    onSave: (agentData: Omit<Agent, 'id'> | Agent) => void;
}

const AgentFormModal: React.FC<AgentFormModalProps> = ({ agent, agents, bohUsers, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        bohUserId: agent?.bohUserId || null,
        role: agent?.role || ('Support' as AgentRole),
        isActive: agent?.isActive ?? true,
        canReceiveTickets: agent?.canReceiveTickets ?? true,
    });
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        // If an agent is made inactive, they cannot be assigned tickets.
        if (!formData.isActive && formData.canReceiveTickets) {
            setFormData(prev => ({ ...prev, canReceiveTickets: false }));
        }
    }, [formData.isActive]);

    const existingAgentBohUserIds = useMemo(() => 
        new Set(agents.map(a => a.bohUserId).filter(Boolean)), 
        [agents]
    );

    const availableBohUsers = useMemo(() => 
        bohUsers, // All BOH users are available (no status field in BohUser type)
        [bohUsers]
    );

    const selectedBohUser = useMemo(() => {
        if (!formData.bohUserId) return null;
        return bohUsers.find(u => u.id === formData.bohUserId);
    }, [formData.bohUserId, bohUsers]);

    const validate = () => {
        const newErrors: { [key: string]: string } = {};
        if (!agent && !formData.bohUserId) newErrors.bohUserId = 'Please select a team member.';
        if (!formData.role) newErrors.role = 'Role is required.';
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    const handleUserSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, bohUserId: e.target.value }));
        if (errors.bohUserId) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.bohUserId;
                return newErrors;
            });
        }
    };
    
    const handleRoleSelect = (role: AgentRole) => {
        setFormData(prev => ({ ...prev, role }));
        if (errors.role) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.role;
                return newErrors;
            });
        }
    };

    const handleToggleChange = (field: 'isActive' | 'canReceiveTickets') => {
        setFormData(prev => ({ ...prev, [field]: !prev[field] }));
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            if (agent) {
                // Edit mode
                onSave({ 
                    ...agent, 
                    role: formData.role,
                    isActive: formData.isActive,
                    canReceiveTickets: formData.canReceiveTickets
                });
            } else {
                // Add mode
                // TODO: This will later call Supabase to insert/update a counter_agents table.
                onSave({
                    bohUserId: formData.bohUserId!,
                    name: selectedBohUser!.fullName,
                    email: selectedBohUser!.email,
                    role: formData.role,
                    isActive: formData.isActive,
                    canReceiveTickets: formData.canReceiveTickets,
                });
            }
        }
    };
    
    const roleOptions: AgentRole[] = ['Support', 'Lead', 'Bot', 'Other'];

    return (
        <div 
            className="form-modal-overlay" 
            onClick={onClose}
            data-state="open"
        >
            <div className="form-modal-panel" onClick={(e) => e.stopPropagation()}>
                <div className="form-modal-header">
                    <h2>{agent ? 'Edit Agent' : 'Add Agent'}</h2>
                    <button type="button" className="filters-close" onClick={onClose} title="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-modal-body space-y-6">
                        <div>
                            <label htmlFor="bohUserId" className="form-label">Team member</label>
                            <select
                                id="bohUserId"
                                name="bohUserId"
                                value={formData.bohUserId || ''}
                                onChange={handleUserSelect}
                                disabled={!!agent}
                                className={`form-input ${errors.bohUserId ? 'border-red-500 dark:border-red-500' : ''} ${!!agent ? 'cursor-not-allowed bg-boh-surface-light dark:bg-boh-surface' : ''}`}
                            >
                                <option value="" disabled>Select a team member...</option>
                                {availableBohUsers.map(user => {
                                    const isAlreadyAgent = existingAgentBohUserIds.has(user.id);
                                    const isCurrentAgent = agent?.bohUserId === user.id;
                                    return (
                                        <option 
                                            key={user.id} 
                                            value={user.id} 
                                            disabled={isAlreadyAgent && !isCurrentAgent}
                                        >
                                            {user.fullName} {isAlreadyAgent && !isCurrentAgent ? '(Already an agent)' : ''}
                                        </option>
                                    );
                                })}
                            </select>
                            {errors.bohUserId && <p className="field-error">{errors.bohUserId}</p>}
                            <p className="mt-2 text-xs text-boh-text-sub-light dark:text-boh-text-sub">Agents are selected from BOH team members. Manage team in BOH.</p>
                        </div>

                        {(agent || selectedBohUser) && (
                            <div className="space-y-4 rounded-lg border border-boh-border-light dark:border-boh-border p-4">
                                <div>
                                    <label className="form-label text-xs text-boh-text-sub-light dark:text-boh-text-sub">Name</label>
                                    <p className="text-sm font-medium">{agent ? agent.name : selectedBohUser?.fullName}</p>
                                </div>
                                <div>
                                    <label className="form-label text-xs text-boh-text-sub-light dark:text-boh-text-sub">Email</label>
                                    <p className="text-sm font-medium">{agent ? agent.email : selectedBohUser?.email}</p>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="form-label">Role</label>
                            <div className="pill-group" role="radiogroup" aria-label="Select an agent role">
                                {roleOptions.map(role => (
                                    <button
                                        key={role}
                                        type="button"
                                        onClick={() => handleRoleSelect(role)}
                                        className={`pill pill-role ${formData.role === role ? 'is-active' : ''}`}
                                    >
                                        {role}
                                    </button>
                                ))}
                            </div>
                            {errors.role && <p className="field-error">{errors.role}</p>}
                        </div>
                        <div className="space-y-4">
                            <div className="form-toggle-group">
                                <label className="form-label m-0">Active</label>
                                <ThemeToggle theme={formData.isActive ? 'dark' : 'light'} toggleTheme={() => handleToggleChange('isActive')} />
                            </div>
                             <div className="form-toggle-group">
                                <label className="form-label m-0">Can receive tickets</label>
                                <ThemeToggle theme={formData.canReceiveTickets ? 'dark' : 'light'} toggleTheme={() => handleToggleChange('canReceiveTickets')} />
                            </div>
                        </div>
                    </div>

                    <div className="form-modal-footer">
                        <button type="button" onClick={onClose} className="filters-reset-btn">Cancel</button>
                        <button type="submit" className="primary-button">Save Agent</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AgentFormModal;