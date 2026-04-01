export async function uploadImageToS3(file: File): Promise<string> {
  // 1. Get presigned URL from our API
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to get upload URL');
  }

  const { signedUrl, fileUrl } = await res.json();

  // 2. Upload the file directly to S3
  const uploadRes = await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });

  if (!uploadRes.ok) {
    throw new Error('Failed to upload file to S3');
  }

  return fileUrl;
}
