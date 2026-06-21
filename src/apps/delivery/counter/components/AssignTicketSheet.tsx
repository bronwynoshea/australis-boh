import React, { useEffect } from 'react';
import type { Ticket, Agent } from '../types';

interface AssignTicketSheetProps {
  ticket: Ticket | null;
  agents: Agent[];
  onAssign: (ticketId: string, agentId: string) => void;
  onClose: () => void;
}

export const AssignTicketSheet: React.FC<AssignTicketSheetProps> = ({ 
  ticket, 
  agents, 
  onAssign, 
  onClose 
}) => {
  const assignableAgents = agents.filter(a => a.canReceiveTickets);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (ticket) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [ticket]);

  if (!ticket) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-50 lg:hidden"
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-boh-surface-light dark:bg-boh-surface border-t border-boh-border-light dark:border-boh-border rounded-t-xl shadow-lg max-h-[80vh] flex flex-col z-50 lg:hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-boh-border-light dark:border-boh-border flex-shrink-0">
          <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">
            Assign Ticket
          </h3>
          <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">
            {ticket.id} · {ticket.subject}
          </p>
        </div>
        
        {/* Agent List */}
        <div className="flex-1 overflow-y-auto boh-hide-scrollbars px-6 py-4">
          <div className="space-y-2">
            {assignableAgents.map(agent => (
              <button
                key={agent.id}
                type="button"
                onClick={() => {
                  onAssign(ticket.id, agent.id);
                  onClose();
                }}
                className="block w-full text-left px-4 py-3 rounded-lg text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light/50 dark:hover:bg-boh-bg/50 transition-colors"
              >
                {agent.name}
              </button>
            ))}
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-boh-border-light dark:border-boh-border flex-shrink-0">
          <button 
            onClick={onClose} 
            className="w-full text-center px-4 py-2 text-sm font-medium text-boh-text-light dark:text-boh-text bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-md shadow-sm hover:bg-boh-bg-light/50 dark:hover:bg-boh-bg/50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
};



