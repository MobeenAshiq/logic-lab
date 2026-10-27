import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppException } from '../common/app-exception';

type OrderedTable = 'tracks' | 'courses' | 'modules' | 'lessons';

/**
 * Saves a drag-and-drop order. `ids` must contain exactly the current children
 * of the parent; positions become 1..n in that order, in one statement.
 */
export async function applyOrder(
  tx: Prisma.TransactionClient,
  table: OrderedTable,
  currentIds: string[],
  ids: string[],
) {
  const current = new Set(currentIds);
  if (ids.length !== current.size || !ids.every((id) => current.has(id))) {
    throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_ORDER');
  }
  await tx.$executeRaw`
    UPDATE ${Prisma.raw(`"${table}"`)} AS t
    SET position = o.ord, updated_at = now()
    FROM unnest(${ids}::uuid[]) WITH ORDINALITY AS o(id, ord)
    WHERE t.id = o.id`;
}

/** Position for a new item appended after its siblings. */
export function nextPosition(max: { _max: { position: number | null } }) {
  return (max._max.position ?? 0) + 1;
}
