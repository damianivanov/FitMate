import api from "@/lib/api";
import { compressImageForUpload } from "@/lib/imageCompression";
import { unwrap } from "@/lib/unwrap";
import type {
  Exercise,
  ExerciseLookupModel,
  ExerciseLookupRequest,
  JsonData,
  CreateExerciseRequest,
  ImageUploadTicket,
  ImageUploadTicketRequest,
  ConfirmImageUploadRequest,
} from "@/types";

// Upload the image bytes straight to blob storage using a short-lived SAS URL, bypassing the API
// ingress. Streaming a large multipart body through the (scale-to-zero) ingress resets the request,
// so only the small control-plane calls (upload-url / confirm) go through the server.
async function putToBlobStorage(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "x-ms-blob-type": "BlockBlob",
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Image upload failed (${response.status}). Please try again.`);
  }
}

export const exerciseService = {
  async getAll(params: ExerciseLookupRequest) {
    return api.get<JsonData<ExerciseLookupModel[]>>("exercises/get-all", {
      params,
      paramsSerializer: { indexes: null },
    });
  },

  async getMine(params: ExerciseLookupRequest) {
    return api.get<JsonData<ExerciseLookupModel[]>>("exercises/mine", {
      params,
      paramsSerializer: { indexes: null },
    });
  },

  async create(payload: CreateExerciseRequest, file?: File) {
    const response = await api.post<JsonData<Exercise>>("exercises", payload);

    if (!file) {
      return response;
    }

    const created = unwrap(response.data, "Create failed.");

    try {
      return await exerciseService.uploadImage(created.id, file);
    } catch (imageError) {
      // Keep create atomic: if the image step fails, remove the just-created exercise so a retry
      // doesn't leave an orphan or create a duplicate (mirrors the old server-side behavior).
      try {
        await exerciseService.remove(created.id);
      } catch {
        // Ignore cleanup failures; surface the original image error.
      }

      throw imageError;
    }
  },

  async update(id: number, payload: CreateExerciseRequest) {
    return api.put<JsonData<Exercise>>(`exercises/${id}`, payload);
  },

  async remove(id: number) {
    return api.delete<JsonData<boolean>>(`exercises/${id}`);
  },

  async uploadImage(id: number, file: File) {
    const prepared = await compressImageForUpload(file);

    const ticketResponse = await api.post<JsonData<ImageUploadTicket>>(
      `exercises/${id}/image/upload-url`,
      { fileName: prepared.name, contentType: prepared.type } satisfies ImageUploadTicketRequest,
    );
    const ticket = unwrap(ticketResponse.data, "Could not start the image upload.");

    await putToBlobStorage(ticket.uploadUrl, prepared);

    return api.post<JsonData<Exercise>>(
      `exercises/${id}/image/confirm`,
      { blobName: ticket.blobName } satisfies ConfirmImageUploadRequest,
    );
  },
};
