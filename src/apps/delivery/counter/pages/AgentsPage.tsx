import React, { useState } from 'react';
import type { Agent } from '../types';
import AgentFormModal from '../components/AgentFormModal';
import { PlusCircleIcon } from '../components/Icons';

interface AgentsPageProps {
    agents: Agent[];
    onAddAgent: (newAgent: Omit<Agent, 'id'>) => void;
    onUpdateAgent: (updatedAgent: Agent) => void;
}

const AgentStatusBadge: React.FC<{ isActive: boolean }> = ({ isActive }) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    const activeClasses = "bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100";
    const inactiveClasses = "bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text dark:bg-boh-bg dark:text-boh-text";

    return (
        <span className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}>
            {isActive ? 'Active' : 'Inactive'}
        </span>
    );
};


const AgentsPage: React.FC<AgentsPageProps> = ({ agents, onAddAgent, onUpdateAgent }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

    const handleOpenAddModal = () => {
        setEditingAgent(null);
        setIsModalOpen(true);
    };
    
    const handleOpenEditModal = (agent: Agent) => {
        setEditingAgent(agent);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingAgent(null);
    };

    const handleSaveAgent = (agentData: Omit<Agent, 'id'> | Agent) => {
        if ('id' in agentData) {
            // TODO: Real API call will update the agent in BOH.
            onUpdateAgent(agentData);
        } else {
            // TODO: Real API call will create the agent in BOH.
            onAddAgent(agentData);
        }
        handleCloseModal();
    };

    return (
        <div>
            <div className="border-b border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border">
                <div className="px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-boh-text-light dark:text-boh-text dark:text-boh-text">Agents</h1>
                            <p className="mt-1 text-md text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub">Manage who can be assigned tickets.</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleOpenAddModal}
                            className="primary-button inline-flex items-center gap-2 justify-center"
                        >
                            <PlusCircleIcon className="w-5 h-5" />
                            <span>Add agent</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4 sm:p-6 lg:p-8">
                {/* Desktop Table */}
                <div className="hidden lg:block bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-surface rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-boh-border-light dark:divide-boh-border dark:divide-boh-border-light dark:divide-boh-border">
                        <thead className="bg-boh-bg-light dark:bg-boh-bg dark:bg-boh-bg">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub uppercase tracking-wider">Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub uppercase tracking-wider">Email</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub uppercase tracking-wider">Role</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub uppercase tracking-wider">Can receive tickets</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {agents.map((agent) => (
                                <tr key={agent.id} className="hover:bg-boh-bg-light dark:hover:bg-boh-bg dark:hover:bg-boh-bg/50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-boh-text-light dark:text-boh-text dark:text-boh-text">{agent.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub">{agent.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub">{agent.role}</td>
                                    <td className="px-6 py-4 whitespace-nowrap"><AgentStatusBadge isActive={agent.isActive} /></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub text-center">{agent.canReceiveTickets ? 'Yes' : 'No'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => handleOpenEditModal(agent)} className="edit-btn">Edit</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile & Tablet Cards */}
                <div className="lg:hidden space-y-4">
                    {agents.map((agent) => (
                        <div key={agent.id} className="bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-surface rounded-lg shadow p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold text-boh-text-light dark:text-boh-text dark:text-boh-text">{agent.name}</p>
                                    <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub">{agent.email}</p>
                                </div>
                                <AgentStatusBadge isActive={agent.isActive} />
                            </div>
                            <div className="mt-4 pt-4 border-t border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border flex flex-col gap-2">
                                <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub"><strong>Role:</strong> {agent.role}</div>
                                <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub"><strong>Can receive tickets:</strong> {agent.canReceiveTickets ? 'Yes' : 'No'}</div>
                                <button onClick={() => handleOpenEditModal(agent)} className="mt-2 text-sm text-center w-full px-4 py-2 font-medium text-primary border border-primary rounded-md hover:bg-primary/10">
                                    Edit
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {isModalOpen && (
                <AgentFormModal
                    agent={editingAgent}
                    agents={agents}
                    bohUsers={[]}
                    onClose={handleCloseModal}
                    onSave={handleSaveAgent}
                />
            )}
        </div>
    );
};

export default AgentsPage;