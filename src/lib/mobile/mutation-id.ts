import { Types } from "mongoose";

export function readMobileMutationId(request: Request): string | null | false {
  const mutationId = request.headers.get("x-catalysts-mutation-id");
  if (!mutationId) return null;
  if (!/^[\da-f]{24}$/i.test(mutationId)) return false;
  return mutationId.toLowerCase();
}

export function mobileMutationObjectId(mutationId: string | null) {
  return mutationId ? new Types.ObjectId(mutationId) : undefined;
}
