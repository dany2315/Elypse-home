export function imageUrl(id: string | null | undefined) {
  return id ? `/api/images/${id}` : null;
}
