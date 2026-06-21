import React, { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { PlusIcon, BrainIcon, XIcon, TrashIcon } from '../components/Icons';
import { BohSelect } from '../../../components/boh';
import {
  useWhiteboardBoard,
  createWhiteboardItem,
  updateWhiteboardItem,
  moveWhiteboardItem,
  deleteWhiteboardItem,
} from '../hooks/useWhiteboardItems';
import { getCurrentBohUserId } from '../../../boh/api/bohApi';
import type { WhiteboardCard, WhiteboardItem } from '../types';
import { getCardStyle, getEmptyStateMessage, COLOR_BAR_COLORS } from '../utils/whiteboardColors';
import { supabase } from '../../../lib/supabase';

// Format date - compact style
function formatDate(dateString: string): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Truncate text helper
function truncate(text: string | null, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// Whiteboard Card Component
interface WhiteboardCardProps {
  key?: React.Key;
  card: WhiteboardCard;
  items: WhiteboardItem[];
  onAddClick: (card: WhiteboardCard) => void;
  onEditClick: (item: WhiteboardItem, cardId: string) => void;
}

function WhiteboardCardComponent({ card, items, onAddClick, onEditClick }: WhiteboardCardProps) {
  const style = getCardStyle(card.color_token);
  const colorBarClass = COLOR_BAR_COLORS[card.color_token as keyof typeof COLOR_BAR_COLORS] || '';

  return (
    <div className="relative flex rounded-lg overflow-hidden h-full min-h-0">
      {/* Left Color Bar - Primary Identity Indicator */}
      <div className={`w-1 shrink-0 ${colorBarClass}`} />
      
      {/* Main Card Content */}
      <div className={`flex-1 flex flex-col ${style.card} h-full min-h-0`}>
      {/* Card Header */}
      <div className={`${style.header} px-3 py-2.5 flex items-center justify-between shrink-0 border-b-2 ${style.headerBorder}`}>
        <div className="min-w-0 flex-1">
          <h3 className={`font-semibold ${style.headerTitle} truncate`}>{card.label}</h3>
          {card.description && (
            <p className={`text-xs ${style.headerDescription} mt-0.5 truncate`}>
              {card.description}
            </p>
          )}
        </div>
        <button
          onClick={() => onAddClick(card)}
          className={`p-1.5 rounded-lg ${style.addButton} ${style.addButtonHover} transition-colors shrink-0 ml-2`}
          title={`Add to ${card.label}`}
        >
          <PlusIcon className={`w-4 h-4 ${style.addButtonIcon}`} />
        </button>
      </div>

      {/* Card Body - Scrollable Item List */}
      <div className={`flex-1 overflow-y-auto ${style.body} p-2.5 min-h-0`}>
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 min-h-[120px]">
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
              {getEmptyStateMessage(card.key)}
            </p>
            <button
              onClick={() => onAddClick(card)}
              className="mt-3 text-xs font-medium text-boh-primary hover:underline"
            >
              Add your first {card.label.toLowerCase()}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <WhiteboardItemCard
                key={item.id}
                item={item}
                cardId={card.id}
                style={style}
                onEditClick={onEditClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

// Whiteboard Item Card - Clean, elevated card sitting above the lane
interface WhiteboardItemCardProps {
  key?: React.Key;
  item: WhiteboardItem;
  cardId: string;
  style: ReturnType<typeof getCardStyle>;
  onEditClick: (item: WhiteboardItem, cardId: string) => void;
}

function WhiteboardItemCard({ item, cardId, style, onEditClick }: WhiteboardItemCardProps) {
  const handleClick = () => {
    onEditClick(item, cardId);
  };

  return (
    <div
      onClick={handleClick}
      className={`rounded-lg p-3 cursor-pointer transition-all duration-200 ${style.itemCard} ${style.itemCardHover}`}
    >
      {/* Title - Strong contrast, always visible */}
      <h4 className={`text-sm leading-tight mb-1.5 ${style.itemTitle}`}>
        {item.title}
      </h4>

      {/* Description - Secondary text, truncated */}
      {item.description && (
        <p className={`text-xs leading-relaxed mb-2 ${style.itemDescription}`}>
          {truncate(item.description, 100)}
        </p>
      )}

      {/* Date - Subtle metadata at bottom */}
      <p className={`text-xs ${style.itemDate}`}>
        {formatDate(item.created_at)}
      </p>
    </div>
  );
}

// Create Item Modal
interface CreateModalProps {
  isOpen: boolean;
  card: WhiteboardCard | null;
  onClose: () => void;
  onSubmit: (title: string, description: string, cardId: string) => void;
}

function CreateItemModal({ isOpen, card, onClose, onSubmit }: CreateModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  if (!isOpen || !card) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    onSubmit(title.trim(), description.trim(), card.id);
    setTitle('');
    setDescription('');
    setError('');
    onClose();
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-boh-border-light dark:border-boh-border">
          <h3 className="text-lg font-medium text-boh-text-light dark:text-boh-text">
            Add to {card.label}
          </h3>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-boh-bg-light dark:hover:bg-boh-bg text-boh-text-sub-light dark:text-boh-text-sub"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Enter ${card.key} title...`}
              className="w-full px-3 py-2 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details (optional)..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-boh-text-sub-light dark:text-boh-text-sub hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-boh-primary text-white hover:bg-boh-primary-dark transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// New Card Modal
interface NewCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function NewCardModal({ isOpen, onClose, onSuccess }: NewCardModalProps) {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [variant, setVariant] = useState<string>('primary-accent');
  const [sortOrder, setSortOrder] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const generateKey = (label: string): string => {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setError('Card name is required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const key = generateKey(label);
      const order = sortOrder ? parseInt(sortOrder, 10) : 100;

      const { error: insertError } = await supabase
        .from('keep_whiteboard_card')
        .insert({
          key,
          label: label.trim(),
          description: description.trim() || null,
          color_token: variant,
          sort_order: order,
          is_active: true,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          setError('A card with this name already exists. Please choose a different name.');
        } else {
          setError(insertError.message);
        }
        setIsSubmitting(false);
        return;
      }

      setLabel('');
      setDescription('');
      setVariant('primary-accent');
      setSortOrder('');
      setError('');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create card');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setLabel('');
    setDescription('');
    setVariant('primary-accent');
    setSortOrder('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-boh-border-light dark:border-boh-border">
          <h3 className="text-lg font-medium text-boh-text-light dark:text-boh-text">
            Create New Card
          </h3>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-boh-bg-light dark:hover:bg-boh-bg text-boh-text-sub-light dark:text-boh-text-sub"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-1">
              Card Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Action Items, Decisions, Risks"
              className="w-full px-3 py-2 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary"
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this card's purpose (optional)"
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary resize-none"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <BohSelect
              label="Style Variant"
              value={variant}
              onChange={(value) => setVariant(value)}
              options={[
                { value: 'primary-accent', label: 'Primary Accent (Purple)' },
                { value: 'success-accent', label: 'Success Accent (Blue)' },
                { value: 'neutral-accent', label: 'Neutral Accent (Plum)' },
                { value: 'surface-accent', label: 'Surface Accent (Violet)' },
              ]}
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-1">
              Sort Order
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="Default: 100"
              className="boh-number-input"
              disabled={isSubmitting}
            />
            <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1">
              Lower numbers appear first. Leave empty for default.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-boh-primary text-white hover:bg-boh-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Card'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Item Modal
interface EditItemModalProps {
  isOpen: boolean;
  item: WhiteboardItem | null;
  cards: WhiteboardCard[];
  currentCardId: string | null;
  onClose: () => void;
  onSave: (itemId: string, title: string, description: string, targetCardId: string | null) => void;
  onDelete: (itemId: string) => void;
}

function EditItemModal({ isOpen, item, cards, currentCardId, onClose, onSave, onDelete }: EditItemModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');

  // Reset form when item changes
  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description || '');
      setSelectedCardId(item.card_id);
      setShowDeleteConfirm(false);
      setError('');
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    onSave(item.id, title.trim(), description.trim(), selectedCardId);
    onClose();
  };

  const handleClose = () => {
    setShowDeleteConfirm(false);
    setError('');
    onClose();
  };

  const handleDeleteClick = () => {
    if (showDeleteConfirm) {
      onDelete(item.id);
      onClose();
    } else {
      setShowDeleteConfirm(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-boh-border-light dark:border-boh-border">
          <h3 className="text-lg font-medium text-boh-text-light dark:text-boh-text">
            Edit Item
          </h3>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-boh-bg-light dark:hover:bg-boh-bg text-boh-text-sub-light dark:text-boh-text-sub"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter item title..."
              className="w-full px-3 py-2 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details (optional)..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary resize-none"
            />
          </div>

          <div>
            <BohSelect
              label="Card / Lane"
              value={selectedCardId || ''}
              onChange={(value) => setSelectedCardId(value || null)}
              options={cards.map((card) => ({ value: card.id, label: card.label }))}
            />
            <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1">
              Move this item to a different card
            </p>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={handleDeleteClick}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showDeleteConfirm
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
              }`}
            >
              <TrashIcon className="w-4 h-4" />
              <span>{showDeleteConfirm ? 'Confirm Delete' : 'Delete'}</span>
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-lg text-boh-text-sub-light dark:text-boh-text-sub hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-boh-primary text-white hover:bg-boh-primary-dark transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// Main Page Component
export default function KeepWhiteboardPage() {
  const { cards, itemsByCard, loading, error, refresh, deleteItem } = useWhiteboardBoard();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isNewCardModalOpen, setIsNewCardModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeCard, setActiveCard] = useState<WhiteboardCard | null>(null);
  const [editingItem, setEditingItem] = useState<WhiteboardItem | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentBohUserId().then(setCurrentUserId);
  }, []);

  const handleAddClick = (card: WhiteboardCard) => {
    setActiveCard(card);
    setIsCreateModalOpen(true);
  };

  const handleCreate = async (title: string, description: string, cardId: string) => {
    if (!currentUserId) return;

    const newItem = await createWhiteboardItem(
      { title, description, cardId },
      currentUserId
    );
    if (newItem) {
      refresh();
    }
  };

  const handleEditClick = (item: WhiteboardItem, cardId: string) => {
    setEditingItem(item);
    setEditingCardId(cardId);
    setIsEditModalOpen(true);
  };

  const handleSaveItem = async (
    itemId: string,
    title: string,
    description: string,
    targetCardId: string | null
  ) => {
    // Update title and description
    const updated = await updateWhiteboardItem(itemId, { title, description });
    if (!updated) return;

    // Move to different card if needed
    if (targetCardId !== editingItem?.card_id) {
      const moved = await moveWhiteboardItem(itemId, targetCardId);
      if (!moved) return;
    }

    refresh();
  };

  const handleDeleteItem = async (itemId: string) => {
    // Optimistic update - remove from UI immediately (synchronously)
    flushSync(() => {
      deleteItem(itemId);
    });
    // Then delete from backend
    await deleteWhiteboardItem(itemId);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header - Matching Keep module pattern */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 border-b border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg">
        <header className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wide mb-1">
                Keep
              </div>
              <h2 className="text-2xl font-bold text-boh-text-light dark:text-boh-text mb-1">
                Whiteboard
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsNewCardModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-boh-primary text-white rounded-lg hover:bg-boh-primary/90 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                <span>New Card</span>
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Board Grid */}
      <div className="flex-1 min-h-0 px-4 sm:px-6 lg:px-8 py-6 bg-boh-bg-light dark:bg-boh-bg">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg bg-boh-bg-light dark:bg-boh-bg animate-pulse min-h-0"
              />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <button
              onClick={refresh}
              className="px-4 py-2 rounded-lg bg-boh-primary text-white hover:bg-boh-primary-dark transition-colors"
            >
              Try again
            </button>
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <BrainIcon className="w-16 h-16 text-boh-text-sub-light dark:text-boh-text-sub mb-4" />
            <p className="text-boh-text-sub-light dark:text-boh-text-sub mb-2">
              No whiteboard cards yet
            </p>
            <button
              onClick={() => setIsNewCardModalOpen(true)}
              className="mt-3 px-4 py-2 rounded-lg bg-boh-primary text-white hover:bg-boh-primary/90 transition-colors text-sm font-medium"
            >
              Create Your First Card
            </button>
          </div>
        ) : (
          <div className="h-full grid grid-cols-1 md:grid-cols-2 gap-3 auto-rows-fr">
            {cards.map((card) => (
              <WhiteboardCardComponent
                key={card.id}
                card={card}
                items={itemsByCard[card.id] || []}
                onAddClick={handleAddClick}
                onEditClick={handleEditClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Item Modal */}
      <CreateItemModal
        isOpen={isCreateModalOpen}
        card={activeCard}
        onClose={() => {
          setIsCreateModalOpen(false);
          setActiveCard(null);
        }}
        onSubmit={handleCreate}
      />

      {/* New Card Modal */}
      <NewCardModal
        isOpen={isNewCardModalOpen}
        onClose={() => setIsNewCardModalOpen(false)}
        onSuccess={refresh}
      />

      {/* Edit Item Modal */}
      <EditItemModal
        isOpen={isEditModalOpen}
        item={editingItem}
        cards={cards}
        currentCardId={editingCardId}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingItem(null);
          setEditingCardId(null);
        }}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
      />
    </div>
  );
}
