import React from 'react';
import { useDraggable } from '@dnd-kit/core';

export interface DraggableCardProps {
  /** Unique ID for the draggable item */
  id: string;
  /** Data associated with the item (passed to drag events) */
  data?: Record<string, unknown>;
  /** Card title/content header */
  title: React.ReactNode;
  /** Optional subtitle or secondary info */
  subtitle?: React.ReactNode;
  /** Main content area */
  children?: React.ReactNode;
  /** Footer content (metadata, badges, etc.) */
  footer?: React.ReactNode;
  /** Click handler for opening the card */
  onClick?: () => void;
  /** Custom CSS classes */
  className?: string;
  /** Whether dragging is enabled for this card */
  isDragEnabled?: boolean;
  /** Whether this card is currently being dragged (for external control) */
  isDragging?: boolean;
  /** Whether this is a drag overlay (lifted preview) */
  isDragOverlay?: boolean;
  /** Custom drag handle icon (defaults to grip lines) */
  dragHandleIcon?: React.ReactNode;
  /** Custom open button icon (defaults to external link) */
  openIcon?: React.ReactNode;
  /** Tooltip text for drag handle */
  dragHandleTooltip?: string;
  /** Tooltip text for open button */
  openButtonTooltip?: string;
}

/**
 * A reusable draggable card component with:
 * - Dedicated drag handle (left side)
 * - Click-to-open functionality
 * - Visual feedback during drag
 * - Consistent styling with BOH design system
 * 
 * Usage with @dnd-kit:
 * ```tsx
 * import { DndContext, useDraggable } from '@dnd-kit/core';
 * 
 * <DndContext onDragEnd={handleDragEnd}>
 *   <DraggableCard
 *     id="item-1"
 *     title="Item Name"
 *     onClick={() => navigate('/item/1')}
 *     data={{ item }}
 *   >
 *     Content here
 *   </DraggableCard>
 * </DndContext>
 * ```
 */
const DraggableCard: React.FC<DraggableCardProps> = ({
  id,
  data,
  title,
  subtitle,
  children,
  footer,
  onClick,
  className = '',
  isDragEnabled = true,
  isDragging: externalIsDragging,
  isDragOverlay = false,
  dragHandleIcon,
  openIcon,
  dragHandleTooltip = 'Drag to move',
  openButtonTooltip = 'Open',
}) => {
  // Set up dnd-kit draggable
  const {
    attributes,
    listeners,
    setNodeRef: setDragHandleRef,
    isDragging: internalIsDragging,
  } = useDraggable({
    id,
    data,
    disabled: !isDragEnabled,
  });

  // Use external isDragging if provided, otherwise use internal
  const isDragging = externalIsDragging ?? internalIsDragging;

  // Handle card click - don't trigger if we were dragging
  const handleCardClick = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick?.();
  };

  // Handle open button click
  const handleOpenClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.();
  };

  // Default icons
  const defaultDragIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
    </svg>
  );

  const defaultOpenIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );

  // Drag overlay styles (when card is being dragged)
  const overlayStyles = isDragOverlay
    ? {
        transform: 'translate(0, 0) scale(1.05) rotate(2deg)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        cursor: 'grabbing',
      }
    : undefined;

  return (
    <div
      onClick={handleCardClick}
      style={overlayStyles}
      className={`
        p-3 rounded-lg bg-boh-bg-light dark:bg-boh-bg 
        border border-boh-border-light dark:border-boh-border 
        hover:border-boh-primary dark:hover:border-boh-primary 
        transition-all cursor-pointer flex flex-col justify-between
        ${isDragging ? 'opacity-30' : ''}
        ${isDragOverlay ? 'ring-2 ring-boh-primary' : ''}
        ${className}
      `}
    >
      {/* Top: Title row with drag handle and open button */}
      <div className="flex items-start gap-2">
        {/* Drag Handle - only draggable element */}
        {isDragEnabled && (
          <div
            ref={setDragHandleRef}
            {...listeners}
            {...attributes}
            className="flex-shrink-0 p-1 rounded cursor-grab active:cursor-grabbing text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-primary transition-colors"
            title={dragHandleTooltip}
            onClick={(e) => e.stopPropagation()}
          >
            {dragHandleIcon ?? defaultDragIcon}
          </div>
        )}

        {/* Title - clickable */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-boh-text-light dark:text-boh-text truncate leading-tight">
            {title}
          </div>
          {subtitle && (
            <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-0.5 truncate">
              {subtitle}
            </div>
          )}
        </div>

        {/* Open button */}
        {onClick && (
          <button
            onClick={handleOpenClick}
            className="flex-shrink-0 p-1 rounded text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-primary hover:bg-boh-primary/10 transition-colors"
            title={openButtonTooltip}
          >
            {openIcon ?? defaultOpenIcon}
          </button>
        )}
      </div>

      {/* Middle: Custom content */}
      {children && (
        <div className={`mt-2 ${isDragEnabled ? 'pl-6' : ''}`}>
          {children}
        </div>
      )}

      {/* Bottom: Footer */}
      {footer && (
        <div className={`flex items-center justify-between mt-3 ${isDragEnabled ? 'pl-6' : ''}`}>
          {footer}
        </div>
      )}
    </div>
  );
};

export default DraggableCard;
