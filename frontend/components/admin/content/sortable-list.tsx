"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Drag handle; pass the props you get from SortableList's render function. */
export function DragHandle(props: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={t.adminContent.dragToReorder}
      className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab touch-none rounded-md p-1 active:cursor-grabbing"
      {...props}
    >
      <GripVertical className="size-4" />
    </button>
  );
}

function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (handle: React.HTMLAttributes<HTMLButtonElement>) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "relative z-10 opacity-80 shadow-lg")}
    >
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

/**
 * Vertical drag-and-drop list. The new order is shown immediately (optimistic);
 * `onReorder` gets the full list of ids to save. If saving fails, the parent
 * refetches and the list follows `items` again.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  className,
}: {
  items: T[];
  onReorder: (ids: string[]) => void;
  renderItem: (item: T, handle: React.HTMLAttributes<HTMLButtonElement>) => React.ReactNode;
  className?: string;
}) {
  const [order, setOrder] = useState(items);
  useEffect(() => setOrder(items), [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = order.findIndex((i) => i.id === active.id);
    const to = order.findIndex((i) => i.id === over.id);
    const next = arrayMove(order, from, to);
    setOrder(next);
    onReorder(next.map((i) => i.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className={cn("grid gap-2", className)}>
          {order.map((item) => (
            <SortableRow key={item.id} id={item.id}>
              {(handle) => renderItem(item, handle)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
