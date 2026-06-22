import React from 'react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel" }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[101] flex items-end md:items-stretch md:justify-end animate-fade-in">
            {/* Backdrop */}
            <div className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative z-[1] flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl border border-primary-border bg-white shadow-xl dark:border-white/10 dark:bg-darkcard md:h-full md:max-h-none md:w-[28rem] md:!rounded-none">
                <div className="p-6 md:p-8">
                    <h3 className="text-xl font-semibold tracking-tight text-[var(--text-secondary)] dark:text-white mb-3">{title}</h3>
                    <p className="text-sm text-primary-text-muted dark:text-white/60 leading-relaxed">{message}</p>
                </div>

                <div className="mt-auto flex flex-col-reverse gap-3 border-t border-primary-border bg-primary-light/50 p-4 dark:border-white/5 dark:bg-white/[0.02] sm:flex-row sm:justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-3 rounded-xl bg-white dark:bg-darkcard border border-primary-border dark:border-white/10 font-semibold text-sm text-center text-[var(--text-secondary)] dark:text-white hover:bg-primary-light dark:hover:bg-white/5 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="slotz-danger-button px-5 py-3 rounded-xl font-semibold text-sm text-center transition-colors"
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
