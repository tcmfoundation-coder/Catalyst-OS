import "server-only";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { StudyResource, type IStudyResource, type IStudyResourceSource, type StudyResourceType } from "@/models/StudyResource";

/**
 * Read/lifecycle operations for generated resources — same ownership
 * pattern as lib/tutor/conversations.ts: every function takes `userId`
 * first and filters by it at the database layer, and findOwnedStudyResource
 * returns null identically for "doesn't exist" and "belongs to someone
 * else" so a resourceId can't be used to enumerate which IDs are real.
 */

export interface StudyResourceSummary {
  id: string;
  type: StudyResourceType;
  title: string;
  materialId: string;
  courseId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudyResourceDetail extends StudyResourceSummary {
  content: Record<string, unknown>;
  sources: IStudyResourceSource[];
}

function toSummary(resource: IStudyResource): StudyResourceSummary {
  return {
    id: resource._id.toString(),
    type: resource.type,
    title: resource.title,
    materialId: resource.materialId.toString(),
    courseId: resource.courseId ? resource.courseId.toString() : null,
    createdAt: resource.createdAt.toISOString(),
    updatedAt: resource.updatedAt.toISOString(),
  };
}

function toDetail(resource: IStudyResource): StudyResourceDetail {
  return { ...toSummary(resource), content: resource.content, sources: resource.sources };
}

export async function findOwnedStudyResource(userId: string, resourceId: string): Promise<IStudyResource | null> {
  if (!Types.ObjectId.isValid(resourceId)) return null;
  await connectToDatabase();
  return StudyResource.findOne({ _id: resourceId, userId });
}

export interface ListStudyResourcesOptions {
  materialId?: string;
  type?: StudyResourceType;
}

export async function listStudyResources(userId: string, options: ListStudyResourcesOptions = {}): Promise<StudyResourceSummary[]> {
  await connectToDatabase();
  const query: Record<string, unknown> = { userId };
  if (options.materialId) query.materialId = options.materialId;
  if (options.type) query.type = options.type;
  const resources = await StudyResource.find(query).sort({ createdAt: -1 });
  return resources.map(toSummary);
}

export async function getStudyResource(userId: string, resourceId: string): Promise<StudyResourceDetail | null> {
  const resource = await findOwnedStudyResource(userId, resourceId);
  return resource ? toDetail(resource) : null;
}

export async function deleteStudyResource(userId: string, resourceId: string): Promise<boolean> {
  const resource = await findOwnedStudyResource(userId, resourceId);
  if (!resource) return false;
  await resource.deleteOne();
  return true;
}
