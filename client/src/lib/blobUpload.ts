// Uploads the image bytes straight to blob storage using a short-lived SAS URL, bypassing the API
// ingress. Streaming a large body through the (scale-to-zero) ingress resets the request, so only
// the small control-plane calls — upload-url and confirm — go through the server.
export async function putToBlobStorage(uploadUrl: string, file: File): Promise<void> {
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
