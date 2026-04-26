import {
  defaultAnimateLayoutChanges,
  useSortable,
  type AnimateLayoutChanges,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export type SortableHandleRenderProps = {
  dragHandleProps: HTMLAttributes<HTMLElement>;
  setDragHandleRef: (element: HTMLElement | null) => void;
  isDragging: boolean;
};

type SortableHandleItemProps = {
  id: string;
  children: (props: SortableHandleRenderProps) => ReactNode;
  className?: string;
  disabled?: boolean;
};

const SORTABLE_TRANSITION = {
  duration: 260,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
};

const animateSortableLayoutChanges: AnimateLayoutChanges = (args) => {
  if (args.isSorting) {
    return true;
  }

  if (args.wasDragging) {
    return false;
  }

  return defaultAnimateLayoutChanges(args);
};

export function SortableHandleItem({
  id,
  children,
  className,
  disabled = false,
}: SortableHandleItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    animateLayoutChanges: animateSortableLayoutChanges,
    id,
    disabled,
    transition: SORTABLE_TRANSITION,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 40 : undefined,
    willChange: transform ? "transform" : undefined,
  } satisfies CSSProperties;

  const dragHandleProps = {
    ...attributes,
    ...listeners,
  } as HTMLAttributes<HTMLElement>;

  return (
    <div ref={setNodeRef} style={style} className={className}>
      {children({
        dragHandleProps,
        setDragHandleRef: setActivatorNodeRef,
        isDragging,
      })}
    </div>
  );
}
